import type { PilotApplication } from "../pilot/catalog";
import { commitStepUp, prepareStepUp, requireSession } from "./auth";
import { digest, event, now, state, transaction } from "./store";

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
    signal: AbortSignal.timeout(path.endsWith("/settings/push") ? 30000 : 8000),
  });
  if (response.status === 409) throw new Error("CONFLICT");
  if (response.status === 404) throw new Error("APPLICATION_NOT_FOUND");
  if (response.status === 400) {
    const error = (await response.json().catch(() => ({}))).error;
    throw new Error(
      ["PUSH_NOT_CONFIGURED", "INVALID_PUSH_TARGET"].includes(error) ? error : "INVALID_REQUEST",
    );
  }
  if (!response.ok || !response.headers.get("content-type")?.includes("application/json"))
    throw new Error("CONNECTOR_UNAVAILABLE");
  const text = await response.text();
  if (text.length > 262144) throw new Error("CONNECTOR_UNAVAILABLE");
  return JSON.parse(text) as Record<string, unknown>;
}
export function validTarget(app: string, section: string) {
  if (
    !/^[a-z0-9][a-z0-9-]{0,63}$/.test(app) ||
    !["ads", "popup", "announce", "update", "pro", "notes", "push"].includes(section)
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
  ip = "local",
) {
  validTarget(app, section);
  const session = requireSession(raw, ip);
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
  try {
    previous = db.prepare("SELECT * FROM operator_intent WHERE id=?").get(input.requestId);
    if (previous && (previous.session !== session.hash || previous.payload_hash !== payloadHash))
      throw new Error("CONFLICT");
    if (previous?.status === "completed") return JSON.parse(String(previous.result));
    if (previous?.status === "conflict") throw new Error("CONFLICT");
  } finally {
    db.close();
  }
  if (!previous) {
    const proof = await prepareStepUp(raw, input, ip);
    const writer = state();
    try {
      transaction(writer, () => {
        commitStepUp(writer, proof);
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
  requireSession(raw, ip);
  try {
    const result = await connector(`/apps/${app}/settings/${section}`, "PUT", JSON.parse(payload));
    complete(input.requestId, result);
    return result;
  } catch (error) {
    if (
      error instanceof Error &&
      ["CONFLICT", "PUSH_NOT_CONFIGURED", "INVALID_PUSH_TARGET", "INVALID_REQUEST"].includes(error.message)
    ) {
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
