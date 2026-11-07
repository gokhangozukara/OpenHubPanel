import type { PilotApplication } from "../pilot/catalog";
import { requireSession, totpStep } from "./auth";
import { digest, event, limit, now, state, transaction, unseal } from "./store";

function origin() {
  const url = new URL(process.env.PILOT_UPSTREAM_ORIGIN ?? "http://127.0.0.1:3046");
  if (
    url.protocol !== "http:" ||
    url.hostname !== "127.0.0.1" ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  )
    throw new Error("INVALID_CONNECTOR_TARGET");
  return url;
}
export async function connector(path: string, method = "GET", payload?: unknown) {
  const key = process.env.OPERATOR_CONNECTOR_TOKEN;
  if (!key || key.length < 43 || !/^\/[a-z0-9/-]+$/.test(path)) throw new Error("CONNECTOR_UNAVAILABLE");
  const response = await fetch(new URL(`/internal/openhub${path}`, origin()), {
    method,
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: payload === undefined ? undefined : JSON.stringify(payload),
    redirect: "error",
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
  });
  if (response.status === 409) throw new Error("CONFLICT");
  if (response.status === 404) throw new Error("APPLICATION_NOT_FOUND");
  if (!response.ok || !response.headers.get("content-type")?.includes("application/json"))
    throw new Error("CONNECTOR_UNAVAILABLE");
  const text = await response.text();
  if (text.length > 262144) throw new Error("CONNECTOR_UNAVAILABLE");
  return JSON.parse(text) as Record<string, unknown>;
}
export function validTarget(app: string, section: string) {
  if (
    !/^[a-z0-9][a-z0-9-]{0,63}$/.test(app) ||
    !["ads", "popup", "announce", "update", "pro", "notes"].includes(section)
  )
    throw new Error("APPLICATION_NOT_FOUND");
}
export async function readOperatorCatalog(): Promise<PilotApplication[]> {
  const result = await connector("/apps");
  if (!Array.isArray(result.applications) || result.applications.length > 10000)
    throw new Error("INVALID_CATALOG");
  return result.applications.map((app: unknown) => {
    if (!app || typeof app !== "object") throw new Error("INVALID_CATALOG");
    const value = app as Record<string, unknown>;
    if (
      typeof value.id !== "string" ||
      !/^[a-z0-9][a-z0-9-]{0,63}$/.test(value.id) ||
      typeof value.name !== "string" ||
      typeof value.maintenance !== "boolean"
    )
      throw new Error("INVALID_CATALOG");
    return {
      id: value.id,
      name: value.name,
      category: String(value.category ?? ""),
      packageName: String(value.packageName ?? ""),
      version: String(value.version ?? ""),
      maintenance: value.maintenance,
      legacyPath: `/app/${value.id}`,
    };
  });
}
export async function saveSettings(
  raw: string | undefined,
  app: string,
  section: string,
  input: Record<string, unknown>,
) {
  validTarget(app, section);
  const session = requireSession(raw);
  if (
    typeof input.requestId !== "string" ||
    !/^[a-f0-9-]{36}$/.test(input.requestId) ||
    typeof input.revision !== "string" ||
    !/^[a-f0-9]{64}$/.test(input.revision) ||
    !input.values ||
    typeof input.values !== "object" ||
    Array.isArray(input.values)
  )
    throw new Error("INVALID_REQUEST");
  const payload = JSON.stringify({
    requestId: input.requestId,
    revision: input.revision,
    values: input.values,
  });
  const payloadHash = digest(`${app}:${section}:${payload}`);
  const db = state();
  let previous: Record<string, unknown> | undefined;
  let factor: string;
  try {
    previous = db.prepare("SELECT * FROM operator_intent WHERE id=?").get(input.requestId);
    if (previous && (previous.session !== session.hash || previous.payload_hash !== payloadHash))
      throw new Error("CONFLICT");
    if (previous?.status === "completed") return JSON.parse(String(previous.result));
    if (previous?.status === "conflict") throw new Error("CONFLICT");
    const user = db.prepare("SELECT factor FROM operator_user WHERE id=1 AND active=1").get();
    if (!user) throw new Error("UNAUTHENTICATED");
    factor = String(user.factor);
  } finally {
    db.close();
  }
  if (!previous) {
    limit("stepup.account", 15, 900);
    const step = await totpStep(unseal(factor, "totp"), input.code);
    const writer = state();
    try {
      transaction(writer, () => {
        const current = writer
          .prepare(`SELECT s.hash FROM operator_session s JOIN operator_user u ON u.id=1
          WHERE s.hash=? AND s.revoked=0 AND s.created>? AND s.seen>? AND u.active=1 AND u.recovery_required=0 AND u.factor=?`)
          .get(session.hash, now() - 8 * 3600, now() - 900, factor);
        if (!current) throw new Error("UNAUTHENTICATED");
        if (
          !writer
            .prepare("UPDATE operator_user SET last_step=? WHERE id=1 AND last_step<? RETURNING id")
            .get(step, step)
        )
          throw new Error("CODE_ALREADY_USED");
        writer
          .prepare(
            "INSERT INTO operator_intent(id,session,payload,payload_hash,app,section,status,time) VALUES(?,?,?,?,?,?,?,?)",
          )
          .run(input.requestId as string, session.hash, payload, payloadHash, app, section, "pending", now());
        event(writer, "settings.intent", `${app}/${section}`);
      });
    } finally {
      writer.close();
    }
  } else {
    // Reconcile an interrupted response. Never resubmit an unknown remote effect.
    try {
      const result = await connector(`/operations/${input.requestId}`);
      complete(input.requestId, result);
      return result;
    } catch {
      throw new Error("UNKNOWN_OUTCOME");
    }
  }
  // Repeat current authority immediately before the synchronous remote attempt.
  requireSession(raw);
  try {
    const result = await connector(`/apps/${app}/settings/${section}`, "PUT", JSON.parse(payload));
    complete(input.requestId, result);
    return result;
  } catch (error) {
    if (error instanceof Error && error.message === "CONFLICT") {
      const writer = state();
      try {
        transaction(writer, () => {
          writer
            .prepare("UPDATE operator_intent SET status='conflict' WHERE id=?")
            .run(input.requestId as string);
          event(writer, "settings.conflict", `${app}/${section}`, "rejected");
        });
      } finally {
        writer.close();
      }
      throw error;
    }
    throw new Error("UNKNOWN_OUTCOME");
  }
}
function complete(id: string, result: Record<string, unknown>) {
  const db = state();
  try {
    transaction(db, () => {
      db.prepare("UPDATE operator_intent SET status='completed',result=? WHERE id=?").run(
        JSON.stringify(result),
        id,
      );
      event(db, "settings.completed", id);
    });
  } finally {
    db.close();
  }
}
