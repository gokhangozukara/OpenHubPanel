import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import type { Database } from "@openhubpanel/db";
import { generate, generateSecret } from "otplib";
import { contentService } from "../../../../../scripts/fixtures/content-service";
import { generalAuth } from "./auth";
import { generalConnections } from "./connections";
import { digest, secretBox, token } from "./crypto";
import { generalWorkspaces } from "./workspaces";

export async function checkIndependentHttp(
  admin: Database,
  app: Database,
  check: (name: string, run: () => Promise<void>) => Promise<void>,
) {
  const directory = path.resolve(".local", `general-http-${randomUUID()}`);
  await mkdir(directory, { recursive: true });
  const remote = await contentService(directory);
  try {
    const key = randomBytes(32).toString("hex");
    const user = randomUUID();
    const raw = token();
    const secret = generateSecret();
    const auth = generalAuth(app, key, async () => {});
    await admin`INSERT INTO users(id,display_name) VALUES(${user},'Independent HTTP fixture')`;
    await admin`INSERT INTO hub_identity.accounts(id,email,password_hash) VALUES(${user},'http-fixture@example.test',${await auth.passwordHash(token())})`;
    await admin`INSERT INTO hub_identity.factors(user_id,secret) VALUES(${user},${secretBox(key).seal(secret, `factor:${user}`)})`;
    await admin`INSERT INTO hub_identity.sessions(hash,user_id) VALUES(${digest(raw)},${user})`;
    const workspaces = generalWorkspaces(app, key);
    const workspace = await workspaces.create(raw, "Independent HTTP workspace");
    const application = await workspaces.application(raw, workspace.id, { name: "Independent content" });
    const connections = generalConnections(app, key, remote.transport);
    // Independent integration assertions reuse the current clock step by resetting fixture state.
    // Replay behavior remains tested separately with concurrent real PostgreSQL challenges.
    async function code() {
      await admin`UPDATE hub_identity.factors SET last_step=-1 WHERE user_id=${user}`;
      return generate({ secret });
    }
    let id = "";
    let revision = "";
    await check(
      "independent HTTPS process connects, lists real articles and enables writes separately",
      async () => {
        id = (
          await connections.add(raw, workspace.id, {
            applicationId: application.id,
            name: "Independent TLS",
            url: remote.base,
            credential: remote.credential,
            approveTarget: true,
            code: await code(),
          })
        ).id;
        assert.equal((await connections.test(raw, workspace.id, id)).status, "connected");
        const read = await connections.read(raw, workspace.id, id);
        assert.equal(read.items[0]?.version, 1);
        assert.equal(read.writeEnabled, false);
        await connections.change(raw, workspace.id, id, read.revision, "enable-writes", await code());
        revision = (await connections.read(raw, workspace.id, id)).revision;
      },
    );
    const first = {
      title: "Independent HTTPS title",
      expectedVersion: 1,
      idempotencyKey: randomUUID(),
      revision,
      code: "",
    };
    await check(
      "real HTTPS title write commits independent SQLite article, operation and both audits",
      async () => {
        first.code = await code();
        const result = await connections.update(raw, workspace.id, id, "welcome", first);
        assert.equal(result.ok, true);
        assert.equal(result.version, 2);
        const stored = remote.inspect();
        assert.equal(stored.article?.title, first.title);
        assert.equal(stored.article?.version, 2);
        assert.equal(stored.operations.length, 1);
        assert.equal(stored.audit.length, 1);
        const events =
          await admin`SELECT action FROM audit_events WHERE workspace_id=${workspace.id} AND target_id=${`${id}/${first.idempotencyKey}`} ORDER BY created_at`;
        assert.deepEqual(
          events.map((event) => event.action),
          ["connection.write.intent", "connection.write.dispatched", "connection.write.completed"],
        );
      },
    );
    await check("real HTTP replay is once-only and changed replay or stale version conflicts", async () => {
      assert.equal((await connections.update(raw, workspace.id, id, "welcome", first)).version, 2);
      assert.equal(remote.patchRequests, 1);
      await assert.rejects(
        connections.update(raw, workspace.id, id, "welcome", { ...first, title: "Changed replay" }),
        /CONFLICT/,
      );
      await assert.rejects(
        connections.update(raw, workspace.id, id, "welcome", {
          ...first,
          idempotencyKey: randomUUID(),
          code: await code(),
        }),
        /CONFLICT/,
      );
      assert.equal(remote.inspect().operations.length, 1);
      assert.equal(remote.inspect().audit.length, 1);
    });
    await check("lost real HTTP reply reconciles by GET without a second PATCH", async () => {
      const unknown = {
        ...first,
        title: "Reconciled HTTPS title",
        expectedVersion: 2,
        idempotencyKey: randomUUID(),
        code: await code(),
      };
      remote.loseNextReply();
      await assert.rejects(connections.update(raw, workspace.id, id, "welcome", unknown), /UNKNOWN_OUTCOME/);
      const count = remote.patchRequests;
      assert.equal(remote.inspect().article?.version, 3);
      const result = await connections.update(raw, workspace.id, id, "welcome", unknown);
      assert.equal(result.ok, true);
      assert.equal(result.version, 3);
      assert.equal(remote.patchRequests, count);
      assert.equal(remote.inspect().operations.length, 2);
      assert.equal(remote.inspect().audit.length, 2);
    });
    await check("stopped independent process produces safe failure rather than success", async () => {
      await remote.stopService();
      await assert.rejects(connections.read(raw, workspace.id, id), /CONNECTION_UNAVAILABLE/);
      assert.equal((await connections.test(raw, workspace.id, id)).status, "unavailable");
      assert.equal(remote.inspect().article?.title, "Reconciled HTTPS title");
    });
  } finally {
    await remote.close();
  }
}
