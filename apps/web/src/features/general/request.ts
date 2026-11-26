export async function requestJson<T>(url: string, init: RequestInit = {}, timeoutMs = 15000): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    let response: Response;
    try {
      response = await fetch(url, { ...init, cache: "no-store", signal: controller.signal });
    } catch {
      throw new Error(controller.signal.aborted ? "TIMEOUT" : "NETWORK_ERROR");
    }
    let data: unknown;
    try {
      data = await response.json();
    } catch {
      throw new Error(controller.signal.aborted ? "TIMEOUT" : "UNAVAILABLE");
    }
    if (!response.ok) {
      const code =
        data && typeof data === "object" && "error" in data && typeof data.error === "string"
          ? data.error
          : "UNAVAILABLE";
      throw new Error(code);
    }
    if (!data || typeof data !== "object") throw new Error("UNAVAILABLE");
    return data as T;
  } finally {
    clearTimeout(timer);
  }
}
export function readState(value: unknown) {
  if (
    !value ||
    typeof value !== "object" ||
    !("csrf" in value) ||
    !("authenticated" in value) ||
    !("workspaces" in value) ||
    typeof value.csrf !== "string" ||
    value.csrf.length !== 43 ||
    typeof value.authenticated !== "boolean" ||
    !Array.isArray(value.workspaces)
  )
    throw new Error("UNAVAILABLE");
  const workspaces = value.workspaces.map((row: unknown) => {
    if (
      !row ||
      typeof row !== "object" ||
      !("id" in row) ||
      !("name" in row) ||
      !("role" in row) ||
      typeof row.id !== "string" ||
      typeof row.name !== "string" ||
      typeof row.role !== "string"
    )
      throw new Error("UNAVAILABLE");
    return { id: row.id, name: row.name, role: row.role };
  });
  return { csrf: value.csrf, authenticated: value.authenticated, workspaces };
}
