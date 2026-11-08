import { randomUUID } from "node:crypto";
import { articleUpdateSchema, connectorManifestSchema, workspaceIdSchema } from "@openhubpanel/contracts";
import type { Database, Transaction } from "@openhubpanel/db";
import { approvedUrl, remoteJson } from "../operator/remote-http";
import { generalAuth } from "./auth";
import { digest, secretBox } from "./crypto";
import { audit, generalWorkspaces, text } from "./workspaces";

type Transport = typeof remoteJson;
type Row = Record<string, unknown>;
function manifest(value: unknown) {
  const parsed = connectorManifestSchema.safeParse(value);
  if (
    !parsed.success ||
    !parsed.data.resources.some(
      (resource) => resource.id === "articles" && resource.capabilities.includes("list"),
    )
  )
    throw new Error("INCOMPATIBLE_CONNECTION");
  return parsed.data;
}
function article(value: unknown) {
  if (!value || typeof value !== "object") throw new Error("INCOMPATIBLE_CONNECTION");
  const row = value as Row;
  if (
    typeof row.id !== "string" ||
    !/^[a-zA-Z0-9_-]{1,80}$/.test(row.id) ||
    typeof row.title !== "string" ||
    row.title.length > 180 ||
    typeof row.status !== "string" ||
    row.status.length > 50 ||
    !Number.isSafeInteger(row.version) ||
    Number(row.version) < 1
  )
    throw new Error("INCOMPATIBLE_CONNECTION");
  return { id: row.id, title: row.title, status: row.status, version: Number(row.version) };
}
export function generalConnections(db: Database, key: string, transport: Transport = remoteJson) {
  const auth = generalAuth(db, key);
  const workspaces = generalWorkspaces(db, key);
  const box = secretBox(key);
  const secret = (workspace: string, row: Row) =>
    box.open(String(row.secret), `connection:${workspace}:${row.id}`);
  async function connection(tx: Transaction, workspace: string, id: string, revision?: string) {
    workspaceIdSchema.parse(id);
    const rows =
      await tx`SELECT c.* FROM workspace_connections c JOIN applications a ON a.workspace_id=c.workspace_id AND a.id=c.application_id
      WHERE c.workspace_id=${workspace} AND c.id=${id} AND NOT c.disabled AND NOT a.archived`;
    if (!rows[0]) throw new Error("CONNECTION_NOT_FOUND");
    if (revision && rows[0].revision !== revision) throw new Error("CONFLICT");
    return rows[0];
  }
  const writes = (row: Row) =>
    row.write_enabled &&
    manifest(row.manifest).resources.some(
      (resource) => resource.id === "articles" && resource.capabilities.includes("update"),
    );
  async function checked(row: Row, workspace: string) {
    const credential = secret(workspace, row);
    const health = await transport(String(row.url), "/health", credential);
    if (health.status !== "ok" || health.contractVersion !== "1.0")
      throw new Error("INCOMPATIBLE_CONNECTION");
    const value = manifest(await transport(String(row.url), "/manifest", credential));
    if (JSON.stringify(value).includes(credential)) throw new Error("INCOMPATIBLE_CONNECTION");
    return value;
  }
  async function finish(
    session: string,
    workspace: string,
    id: string,
    operation: string,
    state: string,
    result?: { ok: boolean; version: number },
  ) {
    return workspaces.scoped(session, workspace, "content.write", async (tx, identity) => {
      await tx`UPDATE connection_operations SET state=${state},result=${result ? tx.json(result) : null}
        WHERE workspace_id=${workspace} AND connection_id=${id} AND id=${operation} AND actor_id=${identity.userId}`;
      await audit(tx, identity, workspace, `connection.write.${state}`, `${id}/${operation}`);
    });
  }
  return {
    async list(session: string, workspace: string) {
      return workspaces.scoped(session, workspace, "apps.read", async (tx) => {
        const rows =
          await tx`SELECT id,application_id,name,url,write_enabled,disabled,revision,checked_at,status FROM workspace_connections WHERE workspace_id=${workspace} ORDER BY name,id`;
        return [...rows];
      });
    },
    async add(
      session: string,
      workspace: string,
      input: {
        applicationId: string;
        name: string;
        url: string;
        credential: string;
        approveTarget: boolean;
        code: string;
      },
    ) {
      const applicationId = workspaceIdSchema.parse(input.applicationId);
      const title = text(input.name);
      const url = approvedUrl(input.url).toString().replace(/\/$/, "");
      if (
        input.approveTarget !== true ||
        typeof input.credential !== "string" ||
        input.credential.length < 16 ||
        input.credential.length > 1024 ||
        /[\r\n]/.test(input.credential)
      )
        throw new Error("TARGET_APPROVAL_REQUIRED");
      if (url.includes(input.credential)) throw new Error("INVALID_CONNECTION_URL");
      return workspaces.scoped(session, workspace, "apps.manage", async (tx, identity) => {
        await auth.stepUp(tx, identity, input.code);
        const applications =
          await tx`SELECT id FROM applications WHERE workspace_id=${workspace} AND id=${applicationId} AND NOT archived`;
        if (!applications.length) throw new Error("NOT_FOUND");
        const id = randomUUID();
        const encrypted = box.seal(input.credential, `connection:${workspace}:${id}`);
        // Saving does not send a credential. Explicit testing is a separate audited operation.
        await tx`INSERT INTO workspace_connections(workspace_id,id,application_id,name,url,secret,revision)
          VALUES(${workspace},${id},${applicationId},${title},${url},${encrypted},${randomUUID()})`;
        await audit(tx, identity, workspace, "connection.created", id);
        return { id };
      });
    },
    async test(session: string, workspace: string, id: string) {
      return workspaces.scoped(session, workspace, "apps.manage", async (tx, identity) => {
        const row = await connection(tx, workspace, id);
        let status = "connected";
        let live: ReturnType<typeof manifest> | null = null;
        try {
          live = await checked(row, workspace);
        } catch {
          status = "unavailable";
        }
        await tx`UPDATE workspace_connections SET manifest=${tx.json(live ?? {})},status=${status},checked_at=now() WHERE workspace_id=${workspace} AND id=${id}`;
        await audit(tx, identity, workspace, "connection.tested", id, { status });
        return { status };
      });
    },
    async change(
      session: string,
      workspace: string,
      id: string,
      revision: string,
      action: string,
      code: string,
    ) {
      if (!["disable", "enable-writes", "disable-writes"].includes(action)) throw new Error("INVALID_INPUT");
      return workspaces.scoped(session, workspace, "apps.manage", async (tx, identity) => {
        await auth.stepUp(tx, identity, code);
        const row = await connection(tx, workspace, id, revision);
        const live = action === "enable-writes" ? await checked(row, workspace) : row.manifest;
        if (
          action === "enable-writes" &&
          !manifest(live).resources.some(
            (resource) => resource.id === "articles" && resource.capabilities.includes("update"),
          )
        )
          throw new Error("REMOTE_READ_ONLY");
        await tx`UPDATE workspace_connections SET disabled=${action === "disable"},write_enabled=${action === "enable-writes"},
          revision=${randomUUID()},manifest=${tx.json(live)},secret=${action === "disable" ? "" : String(row.secret)} WHERE workspace_id=${workspace} AND id=${id}`;
        await audit(tx, identity, workspace, `connection.${action}`, id);
        return { remoteKeyRevocationRequired: action === "disable" };
      });
    },
    async read(session: string, workspace: string, id: string) {
      return workspaces.scoped(session, workspace, "content.read", async (tx) => {
        const row = await connection(tx, workspace, id);
        manifest(row.manifest);
        const credential = secret(workspace, row);
        const data = await transport(String(row.url), "/articles", credential);
        if (!Array.isArray(data.items) || data.items.length > 100) throw new Error("INCOMPATIBLE_CONNECTION");
        const items = data.items.map(article);
        if (JSON.stringify(items).includes(credential)) throw new Error("INCOMPATIBLE_CONNECTION");
        return {
          items,
          revision: String(row.revision),
          writeEnabled: Boolean(writes(row)),
        };
      });
    },
    async update(
      session: string,
      workspace: string,
      id: string,
      articleId: string,
      input: {
        title: string;
        expectedVersion: number;
        idempotencyKey: string;
        revision: string;
        code: string;
      },
    ) {
      if (!/^[a-zA-Z0-9_-]{1,80}$/.test(articleId)) throw new Error("INVALID_INPUT");
      const body = articleUpdateSchema.parse({
        title: input.title,
        expectedVersion: input.expectedVersion,
        idempotencyKey: input.idempotencyKey,
      });
      const payloadHash = digest(JSON.stringify({ articleId, revision: input.revision, body }));
      const prepared = await workspaces.scoped(session, workspace, "content.write", async (tx, identity) => {
        const row = await connection(tx, workspace, id, input.revision);
        if (!writes(row)) throw new Error("REMOTE_READ_ONLY");
        const operations =
          await tx`SELECT * FROM connection_operations WHERE workspace_id=${workspace} AND connection_id=${id} AND id=${body.idempotencyKey}`;
        const previous = operations[0];
        if (previous) {
          if (
            previous.actor_id !== identity.userId ||
            previous.session_hash !== identity.sessionHash ||
            previous.payload_hash !== payloadHash
          )
            throw new Error("CONFLICT");
          return { row, previous, remoteKey: String(previous.remote_key) };
        }
        await auth.stepUp(tx, identity, input.code);
        const remoteKey = randomUUID();
        await tx`INSERT INTO connection_operations(workspace_id,connection_id,id,remote_key,actor_id,session_hash,payload_hash,state)
          VALUES(${workspace},${id},${body.idempotencyKey},${remoteKey},${identity.userId},${identity.sessionHash},${payloadHash},'pending')`;
        await audit(tx, identity, workspace, "connection.write.intent", `${id}/${body.idempotencyKey}`);
        return { row, previous: undefined, remoteKey };
      });
      if (prepared.previous?.state === "completed")
        return prepared.previous.result as { ok: boolean; version: number };
      if (prepared.previous?.state === "conflict") throw new Error("CONFLICT");
      const validate = (result: Row) => {
        if (
          result.ok !== true ||
          result.idempotencyKey !== prepared.remoteKey ||
          !Number.isSafeInteger(result.version) ||
          Number(result.version) <= body.expectedVersion
        )
          throw new Error("UNKNOWN_OUTCOME");
        return { ok: true, version: Number(result.version) };
      };
      if (prepared.previous) {
        try {
          const result = validate(
            await transport(
              String(prepared.row.url),
              `/operations/${prepared.remoteKey}`,
              secret(workspace, prepared.row),
            ),
          );
          await finish(session, workspace, id, body.idempotencyKey, "completed", result);
          return result;
        } catch {
          throw new Error("UNKNOWN_OUTCOME");
        }
      }
      await workspaces.scoped(session, workspace, "content.write", async (tx, identity) => {
        const current = await connection(tx, workspace, id, input.revision);
        if (!writes(current)) throw new Error("REMOTE_READ_ONLY");
        await tx`UPDATE connection_operations SET state='dispatched' WHERE workspace_id=${workspace} AND connection_id=${id} AND id=${body.idempotencyKey}`;
        await audit(tx, identity, workspace, "connection.write.dispatched", `${id}/${body.idempotencyKey}`);
      });
      try {
        const result = validate(
          await transport(
            String(prepared.row.url),
            `/articles/${articleId}`,
            secret(workspace, prepared.row),
            "PATCH",
            { ...body, idempotencyKey: prepared.remoteKey },
          ),
        );
        await finish(session, workspace, id, body.idempotencyKey, "completed", result);
        return result;
      } catch (error) {
        const conflict = error instanceof Error && error.message === "CONFLICT";
        await finish(session, workspace, id, body.idempotencyKey, conflict ? "conflict" : "unknown");
        throw new Error(conflict ? "CONFLICT" : "UNKNOWN_OUTCOME");
      }
    },
  };
}
