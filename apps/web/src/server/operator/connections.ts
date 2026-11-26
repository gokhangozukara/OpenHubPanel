import { randomUUID } from "node:crypto";
import { articleUpdateSchema, connectorManifestSchema } from "@openhubpanel/contracts";
import { commitStepUp, prepareStepUp, requireSession } from "./auth";
import { approvedUrl, remoteJson } from "./remote-http";
import { digest, event, now, seal, state, transaction, unseal } from "./store";

type Row = Record<string, unknown>;
function parseManifest(value: unknown) {
  const result = connectorManifestSchema.safeParse(value);
  if (!result.success) throw new Error("INCOMPATIBLE_CONNECTION");
  return result.data;
}
function connection(id: string) {
  const db = state();
  try {
    const row = db.prepare("SELECT * FROM operator_connection WHERE id=? AND disabled=0").get(id);
    if (!row) throw new Error("CONNECTION_NOT_FOUND");
    return row;
  } finally {
    db.close();
  }
}
function secret(row: Row) {
  return unseal(String(row.secret), `connection:${row.id}`);
}
function resolveResource(
  manifest: ReturnType<typeof parseManifest>,
  resourceId?: string,
  capability: "list" | "update" = "list",
) {
  const target = resourceId
    ? manifest.resources.find((r) => r.id === resourceId)
    : (manifest.resources.find((r) => r.id === "articles" && r.capabilities.includes(capability)) ??
      manifest.resources.find((r) => r.capabilities.includes(capability)));
  if (!target?.capabilities.includes(capability)) return null;
  return target;
}
function canWrite(row: Row, resourceId?: string) {
  if (row.kind !== "api") return false;
  const manifest = parseManifest(JSON.parse(String(row.manifest)));
  return row.write_enabled === 1 && Boolean(resolveResource(manifest, resourceId, "update"));
}
export function listConnections(raw: string | undefined, ip: string): Row[] {
  requireSession(raw, ip);
  const db = state();
  try {
    return db
      .prepare(
        "SELECT id,name,kind,url,manifest,write_enabled,revision,disabled,checked,status FROM operator_connection ORDER BY name",
      )
      .all()
      .map((row) => ({ ...row, manifest: JSON.parse(String(row.manifest)) }));
  } finally {
    db.close();
  }
}
export async function addConnection(raw: string | undefined, input: Record<string, unknown>, ip: string) {
  requireSession(raw, ip);
  if (
    typeof input.name !== "string" ||
    !input.name.trim() ||
    input.name.length > 100 ||
    !["api", "link"].includes(String(input.kind))
  )
    throw new Error("INVALID_REQUEST");
  let url: string;
  if (input.kind === "api") url = approvedUrl(input.url).toString().replace(/\/$/, "");
  else {
    if (typeof input.url !== "string" || input.url.length > 2048) throw new Error("INVALID_CONNECTION_URL");
    const target = new URL(input.url);
    if (target.protocol !== "https:" || target.username || target.password)
      throw new Error("INVALID_CONNECTION_URL");
    url = target.toString();
  }
  const proof = await prepareStepUp(raw, input, ip);
  const id = randomUUID();
  let manifest: unknown = {};
  let credential = "";
  if (input.kind === "api") {
    if (
      input.approveTarget !== true ||
      typeof input.credential !== "string" ||
      input.credential.length < 16 ||
      input.credential.length > 1024
    )
      throw new Error("TARGET_APPROVAL_REQUIRED");
    credential = input.credential;
    const health = await remoteJson(url, "/health", credential);
    if (health.status !== "ok" || health.contractVersion !== "1.0")
      throw new Error("INCOMPATIBLE_CONNECTION");
    manifest = parseManifest(await remoteJson(url, "/manifest", credential));
    if (
      !(manifest as { resources: { id: string; capabilities: string[] }[] }).resources.some((resource) =>
        resource.capabilities.includes("list"),
      )
    )
      throw new Error("INCOMPATIBLE_CONNECTION");
  }
  const db = state();
  try {
    return transaction(db, () => {
      commitStepUp(db, proof);
      if (
        Number(
          db.prepare("SELECT COUNT(*) AS count FROM operator_connection WHERE disabled=0").get()?.count,
        ) >= 50
      )
        throw new Error("CONNECTION_LIMIT");
      if (db.prepare("SELECT id FROM operator_connection WHERE url=? AND disabled=0").get(url))
        throw new Error("CONNECTION_EXISTS");
      db.prepare(
        "INSERT INTO operator_connection(id,name,kind,url,secret,manifest,revision,checked,status) VALUES(?,?,?,?,?,?,?,?,?)",
      ).run(
        id,
        String(input.name).trim(),
        String(input.kind),
        url,
        credential ? seal(credential, `connection:${id}`) : "",
        JSON.stringify(manifest),
        randomUUID(),
        input.kind === "api" ? now() : 0,
        input.kind === "api" ? "connected" : "link",
      );
      event(db, "connection.created", id);
      return { id };
    });
  } finally {
    db.close();
  }
}
export async function changeConnection(
  raw: string | undefined,
  id: string,
  input: Record<string, unknown>,
  ip: string,
) {
  requireSession(raw, ip);
  const before = connection(id);
  if (input.revision !== before.revision) throw new Error("CONFLICT");
  const proof = await prepareStepUp(raw, input, ip);
  if (!["disable", "enable-writes", "disable-writes"].includes(String(input.action)))
    throw new Error("INVALID_REQUEST");
  let manifest = String(before.manifest);
  if (input.action === "enable-writes") {
    if (before.kind !== "api") throw new Error("INVALID_REQUEST");
    const live = parseManifest(await remoteJson(String(before.url), "/manifest", secret(before)));
    if (!live.resources.some((resource) => resource.capabilities.includes("update")))
      throw new Error("REMOTE_READ_ONLY");
    manifest = JSON.stringify(live);
  }
  const db = state();
  try {
    return transaction(db, () => {
      commitStepUp(db, proof);
      const row = db.prepare("SELECT * FROM operator_connection WHERE id=? AND disabled=0").get(id);
      if (!row || row.revision !== before.revision) throw new Error("CONFLICT");
      db.prepare(
        "UPDATE operator_connection SET disabled=?,write_enabled=?,revision=?,manifest=? WHERE id=?",
      ).run(
        input.action === "disable" ? 1 : 0,
        input.action === "enable-writes" ? 1 : 0,
        randomUUID(),
        manifest,
        id,
      );
      event(db, `connection.${String(input.action)}`, id);
      return { ok: true, remoteKeyRevocationRequired: input.action === "disable" && before.kind === "api" };
    });
  } finally {
    db.close();
  }
}
function articles(value: Record<string, unknown>) {
  if (!Array.isArray(value.items) || value.items.length > 100) throw new Error("INCOMPATIBLE_CONNECTION");
  return value.items.map((row: unknown) => {
    if (!row || typeof row !== "object") throw new Error("INCOMPATIBLE_CONNECTION");
    const article = row as Record<string, unknown>;
    if (
      typeof article.id !== "string" ||
      !/^[a-zA-Z0-9_-]{1,80}$/.test(article.id) ||
      typeof article.title !== "string" ||
      article.title.length > 180 ||
      typeof article.status !== "string" ||
      article.status.length > 50 ||
      !Number.isSafeInteger(article.version) ||
      Number(article.version) < 1
    )
      throw new Error("INCOMPATIBLE_CONNECTION");
    return { id: article.id, title: article.title, status: article.status, version: Number(article.version) };
  });
}
export async function readConnection(raw: string | undefined, id: string, ip: string, resourceId?: string) {
  requireSession(raw, ip);
  const row = connection(id);
  if (row.kind !== "api") throw new Error("INVALID_REQUEST");
  const parsed = parseManifest(JSON.parse(String(row.manifest)));
  const target = resolveResource(parsed, resourceId, "list");
  if (!target) throw new Error("INCOMPATIBLE_CONNECTION");
  try {
    const value = articles(await remoteJson(String(row.url), `/${target.id}`, secret(row)));
    requireSession(raw, ip);
    if (connection(id).revision !== row.revision) throw new Error("CONFLICT");
    const db = state();
    try {
      db.prepare("UPDATE operator_connection SET checked=?,status=? WHERE id=? AND revision=?").run(
        now(),
        "connected",
        id,
        String(row.revision),
      );
    } finally {
      db.close();
    }
    return {
      resource: target.id,
      resources: parsed.resources,
      items: value,
      writeEnabled: canWrite(row, target.id),
      revision: row.revision,
    };
  } catch (error) {
    const db = state();
    try {
      db.prepare("UPDATE operator_connection SET status=? WHERE id=?").run(
        error instanceof Error ? error.message : "CONNECTION_UNAVAILABLE",
        id,
      );
    } finally {
      db.close();
    }
    throw error;
  }
}
export async function updateArticle(
  raw: string | undefined,
  id: string,
  article: string,
  input: Record<string, unknown>,
  ip: string,
) {
  const session = requireSession(raw, ip);
  const row = connection(id);
  const resourceId = typeof input.resource === "string" && input.resource ? input.resource : undefined;
  const parsedManifest = parseManifest(JSON.parse(String(row.manifest)));
  const target = resolveResource(parsedManifest, resourceId, "update");
  if (!canWrite(row, resourceId) || !target) throw new Error("REMOTE_READ_ONLY");
  if (input.connectionRevision !== row.revision || !/^[a-zA-Z0-9_-]{1,80}$/.test(article))
    throw new Error("CONFLICT");
  const parsed = articleUpdateSchema.safeParse({
    title: input.title,
    ...(typeof input.status === "string" && input.status ? { status: input.status } : {}),
    expectedVersion: input.expectedVersion,
    idempotencyKey: input.requestId,
  });
  if (!parsed.success) throw new Error("INVALID_REQUEST");
  const body = parsed.data;
  const payloadHash = digest(
    JSON.stringify({ connection: id, resource: target.id, article, revision: row.revision, body }),
  );
  let existing: Row | undefined;
  const reader = state();
  try {
    existing = reader.prepare("SELECT * FROM operator_intent WHERE id=?").get(body.idempotencyKey);
    if (existing && (existing.session !== session.hash || existing.payload_hash !== payloadHash))
      throw new Error("CONFLICT");
    if (existing?.status === "completed") return JSON.parse(String(existing.result));
    if (existing?.status === "conflict") throw new Error("CONFLICT");
  } finally {
    reader.close();
  }
  if (existing) {
    try {
      const result = await remoteJson(String(row.url), `/operations/${body.idempotencyKey}`, secret(row));
      if (result.idempotencyKey !== body.idempotencyKey || result.ok !== true) throw new Error();
      const writer = state();
      try {
        transaction(writer, () => {
          writer
            .prepare("UPDATE operator_intent SET status='completed',result=? WHERE id=?")
            .run(JSON.stringify(result), body.idempotencyKey);
          event(writer, "connection.write-reconciled", id);
        });
      } finally {
        writer.close();
      }
      return result;
    } catch {
      throw new Error("UNKNOWN_OUTCOME");
    }
  }
  const proof = await prepareStepUp(raw, input, ip);
  const writer = state();
  try {
    transaction(writer, () => {
      commitStepUp(writer, proof);
      const current = writer
        .prepare("SELECT revision,disabled,write_enabled FROM operator_connection WHERE id=?")
        .get(id);
      if (current?.disabled !== 0 || current.write_enabled !== 1 || current.revision !== row.revision)
        throw new Error("CONFLICT");
      writer
        .prepare(
          "INSERT INTO operator_intent(id,session,payload,payload_hash,app,section,status,time) VALUES(?,?,?,?,?,?,?,?)",
        )
        .run(
          body.idempotencyKey,
          session.hash,
          JSON.stringify(body),
          payloadHash,
          id,
          target.id,
          "pending",
          now(),
        );
      event(writer, "connection.write-intent", `${id}/${article}`);
    });
  } finally {
    writer.close();
  }
  requireSession(raw, ip);
  if (connection(id).revision !== row.revision) throw new Error("CONFLICT");
  try {
    const result = await remoteJson(String(row.url), `/${target.id}/${article}`, secret(row), "PATCH", body);
    if (
      result.ok !== true ||
      result.idempotencyKey !== body.idempotencyKey ||
      !Number.isSafeInteger(result.version) ||
      Number(result.version) <= body.expectedVersion
    )
      throw new Error("UNKNOWN_OUTCOME");
    const db = state();
    try {
      transaction(db, () => {
        db.prepare("UPDATE operator_intent SET status='completed',result=? WHERE id=?").run(
          JSON.stringify(result),
          body.idempotencyKey,
        );
        event(db, "connection.write-completed", `${id}/${article}`);
      });
    } finally {
      db.close();
    }
    return result;
  } catch (error) {
    if (error instanceof Error && error.message === "CONFLICT") {
      const db = state();
      try {
        transaction(db, () => {
          db.prepare("UPDATE operator_intent SET status='conflict' WHERE id=?").run(body.idempotencyKey);
          event(db, "connection.write-conflict", `${id}/${article}`, "rejected");
        });
      } finally {
        db.close();
      }
      throw error;
    }
    throw new Error("UNKNOWN_OUTCOME");
  }
}
