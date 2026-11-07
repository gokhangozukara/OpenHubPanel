import { DatabaseSync } from "node:sqlite";

export type PilotApplication = {
  id: string;
  name: string;
  category: string;
  packageName: string;
  version: string;
  maintenance: boolean;
  legacyPath: string;
};

export function readPilotCatalog(): PilotApplication[] {
  if (process.env.OPENHUB_PILOT !== "1" || !process.env.PILOT_DATA_FILE) throw new Error("PILOT_DISABLED");
  // An operator-selected local file, never a request parameter. The connection
  // cannot write or migrate the existing application's database.
  const database = new DatabaseSync(process.env.PILOT_DATA_FILE, { readOnly: true });
  try {
    const rows = database
      .prepare(`SELECT a.slug, a.name, a.category, a.package,
      c.latest_version, c.maintenance_mode FROM apps a JOIN app_config c ON c.slug = a.slug ORDER BY a.sort`)
      .all();
    return rows.map((row) => {
      if (typeof row.slug !== "string" || !/^[a-z0-9][a-z0-9-]{0,63}$/.test(row.slug))
        throw new Error("INVALID_APPLICATION_ID");
      return {
        id: row.slug,
        name: String(row.name),
        category: String(row.category ?? ""),
        packageName: String(row.package ?? ""),
        version: String(row.latest_version ?? ""),
        maintenance: Boolean(row.maintenance_mode),
        legacyPath: `/app/${row.slug}`,
      };
    });
  } finally {
    database.close();
  }
}

export async function probePilotApplication(id: string, catalog: PilotApplication[] = readPilotCatalog()) {
  if (!catalog.some((app) => app.id === id)) throw new Error("APPLICATION_NOT_FOUND");
  const origin = new URL(process.env.PILOT_UPSTREAM_ORIGIN ?? "http://127.0.0.1:3046");
  if (
    origin.protocol !== "http:" ||
    origin.hostname !== "127.0.0.1" ||
    origin.username ||
    origin.password ||
    origin.pathname !== "/" ||
    origin.search ||
    origin.hash
  )
    throw new Error("INVALID_PILOT_TARGET");
  const start = performance.now();
  const response = await fetch(new URL(`/api/v1/apps/${id}/config`, origin), {
    redirect: "error",
    signal: AbortSignal.timeout(3000),
    cache: "no-store",
  });
  if (!response.ok || !response.headers.get("content-type")?.includes("application/json") || !response.body)
    throw new Error("CONNECTION_UNAVAILABLE");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 131072) throw new Error("CONNECTION_RESPONSE_TOO_LARGE");
      chunks.push(value);
    }
  } finally {
    await reader.cancel();
    reader.releaseLock();
  }
  const config: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  if (
    !config ||
    typeof config !== "object" ||
    !("app" in config) ||
    config.app !== id ||
    !("ads" in config) ||
    !("update" in config)
  )
    throw new Error("INCOMPATIBLE_CONNECTION");
  return {
    status: "reachable" as const,
    latencyMs: Math.round(performance.now() - start),
    checkedAt: new Date().toISOString(),
  };
}
