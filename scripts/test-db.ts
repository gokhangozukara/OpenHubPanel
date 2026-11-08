import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createServer } from "node:net";
import path from "node:path";
import EmbeddedPostgres from "embedded-postgres";
import { checkGeneralIdentity } from "../apps/web/src/server/general/auth.integration";
import { checkIndependentHttp } from "../apps/web/src/server/general/http.integration";
import { checkTrustedDevices } from "../apps/web/src/server/general/trusted-devices.integration";
import { checkGeneralWorkspaces } from "../apps/web/src/server/general/workspaces.integration";
import { createDatabase, withWorkspace } from "../packages/db/src/index";

async function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") return reject(new Error("No test port"));
      server.close(() => resolve(address.port));
    });
  });
}

const port = await freePort();
const password = randomBytes(32).toString("hex");
const appPassword = randomBytes(32).toString("hex");
const engine = new EmbeddedPostgres({
  databaseDir: path.resolve(".local", `pg-test-${randomUUID()}`),
  user: "postgres",
  password,
  port,
  persistent: true,
  authMethod: "scram-sha-256",
  postgresFlags: ["-h", "127.0.0.1"],
  initdbFlags: ["--encoding=UTF8", "--locale=C"],
  onLog: () => {},
  onError: () => {},
});

let adminCleanup: ReturnType<typeof createDatabase> | undefined;
let appCleanup: ReturnType<typeof createDatabase> | undefined;
try {
  await engine.initialise();
  await engine.start();
  await engine.createDatabase("openhub_test");
  const admin = createDatabase(`postgresql://postgres:${password}@127.0.0.1:${port}/openhub_test`);
  adminCleanup = admin;
  await admin.unsafe(await readFile("packages/db/migrations/0001_workspace_foundation.sql", "utf8"));
  // Generated hexadecimal password, never supplied by a user and never logged.
  await admin.unsafe(`ALTER ROLE openhub_app LOGIN PASSWORD '${appPassword}'`);
  const app = createDatabase(`postgresql://openhub_app:${appPassword}@127.0.0.1:${port}/openhub_test`);
  appCleanup = app;
  const actorA = randomUUID();
  const actorB = randomUUID();
  const workspaceA = randomUUID();
  const workspaceB = randomUUID();
  const appA = randomUUID();
  const appB = randomUUID();
  await admin`INSERT INTO users (id, display_name) VALUES (${actorA}, 'A'), (${actorB}, 'B')`;
  await admin`INSERT INTO workspaces (id, name) VALUES (${workspaceA}, 'A'), (${workspaceB}, 'B')`;
  await admin`INSERT INTO workspace_memberships (workspace_id, user_id, role) VALUES (${workspaceA}, ${actorA}, 'owner'), (${workspaceB}, ${actorB}, 'viewer')`;
  await admin`INSERT INTO applications (workspace_id, id, name, connector_id) VALUES (${workspaceA}, ${appA}, 'App A', 'http'), (${workspaceB}, ${appB}, 'App B', 'http')`;
  let passed = 0;
  async function check(name: string, run: () => Promise<void>) {
    await run();
    passed++;
    console.log(`PASS ${name}`);
  }

  await check("application connection is neither superuser nor BYPASSRLS", async () => {
    const roles = await app`SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user`;
    assert.equal(roles[0]?.rolsuper, false);
    assert.equal(roles[0]?.rolbypassrls, false);
  });
  await check("missing workspace context cannot read tenant data", async () => {
    assert.equal((await app`SELECT * FROM applications`).length, 0);
  });
  await check("member A sees only workspace A", async () => {
    await withWorkspace(app, { actorId: actorA, workspaceId: workspaceA }, async (tx) => {
      const rows = await tx`SELECT id FROM applications`;
      assert.equal(rows.length, 1);
      assert.equal(rows[0]?.id, appA);
      assert.equal((await tx`SELECT * FROM users`).length, 1);
    });
  });
  await check("forging workspace B does not grant A membership", async () => {
    await assert.rejects(
      withWorkspace(app, { actorId: actorA, workspaceId: workspaceB }, async (tx) => {
        await tx`SELECT * FROM applications`;
      }),
      /WORKSPACE_ACCESS_DENIED/,
    );
  });
  await check("transaction-local context does not leak into pooled requests", async () => {
    assert.equal((await app`SELECT * FROM applications`).length, 0);
    await withWorkspace(app, { actorId: actorB, workspaceId: workspaceB }, async (tx) => {
      const rows = await tx`SELECT id FROM applications`;
      assert.equal(rows.length, 1);
      assert.equal(rows[0]?.id, appB);
    });
  });
  await check("audit actor cannot be forged", async () => {
    await assert.rejects(
      withWorkspace(app, { actorId: actorA, workspaceId: workspaceA }, async (tx) => {
        await tx`INSERT INTO audit_events (workspace_id, id, actor_id, action) VALUES (${workspaceA}, ${randomUUID()}, ${actorB}, 'test')`;
      }),
    );
  });
  await check("cross-workspace application reference is rejected", async () => {
    await assert.rejects(
      withWorkspace(app, { actorId: actorA, workspaceId: workspaceA }, async (tx) => {
        await tx`INSERT INTO audit_events (workspace_id, id, actor_id, application_id, action) VALUES (${workspaceA}, ${randomUUID()}, ${actorA}, ${appB}, 'test')`;
      }),
    );
  });
  await check("failed business transaction cannot leave a successful audit event", async () => {
    await assert.rejects(
      withWorkspace(app, { actorId: actorA, workspaceId: workspaceA }, async (tx) => {
        await tx`INSERT INTO audit_events (workspace_id, id, actor_id, action) VALUES (${workspaceA}, ${randomUUID()}, ${actorA}, 'rolled-back')`;
        throw new Error("SIMULATED_FAILURE");
      }),
      /SIMULATED_FAILURE/,
    );
    assert.equal((await admin`SELECT * FROM audit_events WHERE action = 'rolled-back'`).length, 0);
  });
  await check("application cannot update or delete audit events", async () => {
    await assert.rejects(app`UPDATE audit_events SET action = 'changed'`);
    await assert.rejects(app`DELETE FROM audit_events`);
  });
  await check("revoked membership is denied on the next request", async () => {
    await admin`UPDATE workspace_memberships SET active = false WHERE workspace_id = ${workspaceA} AND user_id = ${actorA}`;
    await assert.rejects(
      withWorkspace(app, { actorId: actorA, workspaceId: workspaceA }, async (tx) => {
        await tx`SELECT * FROM applications`;
      }),
      /WORKSPACE_ACCESS_DENIED/,
    );
  });
  await admin.unsafe(await readFile("packages/db/migrations/0002_general_identity.sql", "utf8"));

  await admin.unsafe(await readFile("packages/db/migrations/0003_workspace_management.sql", "utf8"));
  await admin.unsafe(await readFile("packages/db/migrations/0004_workspace_connections.sql", "utf8"));
  await admin.unsafe(await readFile("packages/db/migrations/0005_trusted_devices.sql", "utf8"));
  await checkGeneralIdentity(admin, app, check);
  await checkTrustedDevices(admin, app, check);
  await checkGeneralWorkspaces(admin, app, check);
  await checkIndependentHttp(admin, app, check);
  console.log(`PostgreSQL integration: ${passed} checks passed.`);
} finally {
  await appCleanup?.end({ timeout: 5 });
  await adminCleanup?.end({ timeout: 5 });
  await engine.stop();
}
