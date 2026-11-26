import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { type Database, withWorkspace } from "@openhubpanel/db";
import { generate } from "otplib";
import { generalConnections } from "./connections";
import { secretBox, token } from "./crypto";

export async function checkGeneralConnections(
  admin: Database,
  app: Database,
  check: (name: string, run: () => Promise<void>) => Promise<void>,
  key: string,
  workspace: string,
  foreignWorkspace: string,
  application: string,
  foreignApplication: string,
  owner: { id: string; session: string; secret: string },
  other: { id: string; session: string; secret: string },
) {
  let version = 1;
  let effects = 0;
  let offline = false;
  let timeout = false;
  let reflectSecret = false;
  const credential = token();
  const operations = new Map<string, { ok: boolean; idempotencyKey: string; version: number }>();
  const transport = async (
    _base: string,
    route: string,
    supplied: string,
    method = "GET",
    payload?: unknown,
  ): Promise<Record<string, unknown>> => {
    assert.equal(supplied, credential);
    if (offline) throw new Error("CONNECTION_UNAVAILABLE");
    if (route === "/health") return { status: "ok", contractVersion: "1.0" };
    if (route === "/manifest")
      return {
        id: "test-api",
        name: reflectSecret ? credential : "Test API",
        contractVersion: "1.0",
        resources: [{ id: "articles", name: "Articles", capabilities: ["list", "read", "update"] }],
      };
    if (route === "/articles")
      return {
        items: [
          {
            id: "article",
            title: reflectSecret ? credential : "Title",
            status: "published",
            version,
            secret: token(),
          },
        ],
      };
    if (route.startsWith("/operations/")) {
      const found = operations.get(route.split("/").at(-1) ?? "");
      if (!found) throw new Error("REMOTE_NOT_FOUND");
      return found;
    }
    assert.equal(method, "PATCH");
    const body = payload as { expectedVersion: number; idempotencyKey: string };
    if (body.expectedVersion !== version) throw new Error("CONFLICT");
    effects++;
    const result = { ok: true, idempotencyKey: body.idempotencyKey, version: ++version };
    operations.set(body.idempotencyKey, result);
    if (timeout) throw new Error("CONNECTION_UNAVAILABLE");
    return result;
  };
  const service = generalConnections(app, key, transport);
  async function code() {
    await admin`UPDATE hub_identity.factors SET last_step=-1 WHERE user_id=${owner.id}`;
    return generate({ secret: owner.secret });
  }
  let id = "";
  await check(
    "connection credentials bind workspace and ID; foreign applications and IDs are denied",
    async () => {
      id = (
        await service.add(owner.session, workspace, {
          applicationId: application,
          name: "API",
          url: "https://api.example.test",
          credential,
          approveTarget: true,
          code: await code(),
        })
      ).id;
      const row = (await admin`SELECT * FROM workspace_connections WHERE id=${id}`)[0];
      assert.ok(row);
      assert.notEqual(row.secret, credential);
      assert.throws(() => secretBox(key).open(String(row.secret), `connection:${foreignWorkspace}:${id}`));
      assert.throws(() => secretBox(key).open(String(row.secret), `connection:${workspace}:${randomUUID()}`));
      const listed = await service.list(owner.session, workspace);
      assert.ok(!JSON.stringify(listed).includes(credential));
      assert.equal(listed[0]?.write_enabled, false);
      await assert.rejects(
        service.add(owner.session, workspace, {
          applicationId: foreignApplication,
          name: "Foreign",
          url: "https://api.example.test",
          credential,
          approveTarget: true,
          code: await code(),
        }),
        /NOT_FOUND/,
      );
      await assert.rejects(service.read(other.session, foreignWorkspace, id), /FORBIDDEN/);
      await assert.rejects(service.read(owner.session, foreignWorkspace, id), /CONNECTION_NOT_FOUND/);
    },
  );
  await check(
    "connection test records safe failures and read-only responses strip private fields",
    async () => {
      offline = true;
      assert.equal((await service.test(owner.session, workspace, id)).status, "unavailable");
      offline = false;
      assert.equal((await service.test(owner.session, workspace, id)).status, "connected");
      const read = await service.read(owner.session, workspace, id);
      assert.equal(read.writeEnabled, false);
      assert.deepEqual(Object.keys(read.items[0] ?? {}).sort(), ["id", "status", "title", "version"]);
      await assert.rejects(
        service.update(owner.session, workspace, id, "article", {
          title: "Denied",
          expectedVersion: 1,
          idempotencyKey: randomUUID(),
          revision: read.revision,
          code: await code(),
        }),
        /REMOTE_READ_ONLY/,
      );
      assert.equal(effects, 0);
    },
  );
  await check(
    "title write checks revision, idempotency, conflict and uncertain-result reconciliation",
    async () => {
      const initial = await service.read(owner.session, workspace, id);
      await service.change(owner.session, workspace, id, initial.revision, "enable-writes", await code());
      const read = await service.read(owner.session, workspace, id);
      const input = {
        title: "Changed",
        expectedVersion: 1,
        idempotencyKey: randomUUID(),
        revision: read.revision,
        code: await code(),
      };
      assert.equal((await service.update(owner.session, workspace, id, "article", input)).version, 2);
      assert.equal((await service.update(owner.session, workspace, id, "article", input)).version, 2);
      assert.equal(effects, 1);
      await assert.rejects(
        service.update(owner.session, workspace, id, "article", { ...input, title: "Changed replay" }),
        /CONFLICT/,
      );
      await assert.rejects(
        service.update(owner.session, workspace, id, "article", {
          ...input,
          idempotencyKey: randomUUID(),
          revision: randomUUID(),
        }),
        /CONFLICT/,
      );
      await assert.rejects(
        service.update(owner.session, workspace, id, "article", {
          ...input,
          idempotencyKey: randomUUID(),
          code: await code(),
        }),
        /CONFLICT/,
      );
      assert.equal(effects, 1);
      const uncertain = { ...input, expectedVersion: 2, idempotencyKey: randomUUID(), code: await code() };
      timeout = true;
      await assert.rejects(
        service.update(owner.session, workspace, id, "article", uncertain),
        /UNKNOWN_OUTCOME/,
      );
      assert.equal(effects, 2);
      timeout = false;
      assert.equal((await service.update(owner.session, workspace, id, "article", uncertain)).version, 3);
      assert.equal(effects, 2);
    },
  );
  await check("connection and operation RLS stay scoped even for an actor in both workspaces", async () => {
    await withWorkspace(app, { actorId: owner.id, workspaceId: foreignWorkspace }, async (tx) => {
      assert.equal((await tx`SELECT id FROM workspace_connections WHERE id=${id}`).length, 0);
      assert.equal((await tx`SELECT id FROM connection_operations WHERE connection_id=${id}`).length, 0);
      assert.equal(
        (await tx`SELECT user_id FROM workspace_memberships WHERE workspace_id=${workspace}`).length,
        0,
      );
      assert.equal((await tx`SELECT id FROM audit_events WHERE workspace_id=${workspace}`).length, 0);
    });
    await assert.rejects(app.unsafe("SET ROLE openhub_policy"));
  });
  await check(
    "a malicious remote cannot reflect the saved credential in manifests or article responses",
    async () => {
      reflectSecret = true;
      await assert.rejects(service.read(owner.session, workspace, id), /INCOMPATIBLE_CONNECTION/);
      assert.equal((await service.test(owner.session, workspace, id)).status, "unavailable");
      const rows = await admin`SELECT manifest FROM workspace_connections WHERE id=${id}`;
      assert.ok(!JSON.stringify(rows).includes(credential));
      reflectSecret = false;
      await service.test(owner.session, workspace, id);
    },
  );
  await check("authority revoked after write intent prevents remote dispatch", async () => {
    const read = await service.read(owner.session, workspace, id);
    await admin`UPDATE workspace_memberships SET role='editor' WHERE workspace_id=${workspace} AND user_id=${other.id}`;
    await admin`UPDATE hub_identity.factors SET last_step=-1 WHERE user_id=${other.id}`;
    await admin.unsafe(
      `CREATE FUNCTION revoke_intent_actor() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$ BEGIN IF NEW.action='connection.write.intent' THEN UPDATE workspace_memberships SET role='viewer' WHERE workspace_id=NEW.workspace_id AND user_id=NEW.actor_id; END IF; RETURN NEW; END $$; CREATE TRIGGER revoke_intent_actor AFTER INSERT ON audit_events FOR EACH ROW EXECUTE FUNCTION revoke_intent_actor()`,
    );
    try {
      await assert.rejects(
        service.update(other.session, workspace, id, "article", {
          title: "Revoked",
          expectedVersion: 3,
          idempotencyKey: randomUUID(),
          revision: read.revision,
          code: await generate({ secret: other.secret }),
        }),
        /FORBIDDEN/,
      );
      assert.equal(effects, 2);
    } finally {
      await admin.unsafe(
        "DROP TRIGGER revoke_intent_actor ON audit_events; DROP FUNCTION revoke_intent_actor()",
      );
      await admin`UPDATE workspace_memberships SET role='admin' WHERE workspace_id=${workspace} AND user_id=${other.id}`;
    }
  });
  await check(
    "audit failure prevents dispatch; disabled connection denies new reads and writes",
    async () => {
      const read = await service.read(owner.session, workspace, id);
      await admin.unsafe(
        "CREATE FUNCTION reject_connection_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'AUDIT_UNAVAILABLE'; END $$; CREATE TRIGGER reject_connection_audit BEFORE INSERT ON audit_events FOR EACH ROW EXECUTE FUNCTION reject_connection_audit()",
      );
      try {
        await assert.rejects(
          service.update(owner.session, workspace, id, "article", {
            title: "Must not send",
            expectedVersion: 3,
            idempotencyKey: randomUUID(),
            revision: read.revision,
            code: await code(),
          }),
          /AUDIT_UNAVAILABLE/,
        );
        assert.equal(effects, 2);
      } finally {
        await admin.unsafe(
          "DROP TRIGGER reject_connection_audit ON audit_events; DROP FUNCTION reject_connection_audit()",
        );
      }
      await service.change(owner.session, workspace, id, read.revision, "disable", await code());
      await assert.rejects(service.read(owner.session, workspace, id), /CONNECTION_NOT_FOUND/);
      await assert.rejects(
        service.update(owner.session, workspace, id, "article", {
          title: "Denied",
          expectedVersion: 3,
          idempotencyKey: randomUUID(),
          revision: read.revision,
          code: await code(),
        }),
        /CONNECTION_NOT_FOUND/,
      );
      assert.equal((await admin`SELECT secret FROM workspace_connections WHERE id=${id}`)[0]?.secret, "");
      assert.equal(effects, 2);
    },
  );
}
