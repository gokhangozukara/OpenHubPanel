import { lookup } from "node:dns/promises";
import { request } from "node:https";
import ipaddr from "ipaddr.js";

export function approvedUrl(value: unknown) {
  if (typeof value !== "string" || value.length > 2048 || /[%\\\s]/.test(value))
    throw new Error("INVALID_CONNECTION_URL");
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("INVALID_CONNECTION_URL");
  }
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.hash ||
    url.search ||
    (url.port && url.port !== "443") ||
    !url.hostname.includes(".") ||
    !/^\/[a-zA-Z0-9/_-]*$/.test(url.pathname)
  )
    throw new Error("INVALID_CONNECTION_URL");
  url.pathname = url.pathname.replace(/\/+$/, "");
  return url;
}
export function publicAddress(value: string) {
  try {
    return ipaddr.process(value).range() === "unicast";
  } catch {
    return false;
  }
}
export async function approvedAddresses(host: string) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const addresses = await Promise.race([
    lookup(host, { all: true, verbatim: true }),
    new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => reject(new Error("CONNECTION_UNAVAILABLE")), 5000);
    }),
  ]).finally(() => {
    if (timer) clearTimeout(timer);
  });
  if (!addresses.length || addresses.length > 32 || addresses.some((value) => !publicAddress(value.address)))
    throw new Error("CONNECTION_TARGET_BLOCKED");
  return addresses;
}
export async function remoteJson(
  base: string,
  path: string,
  credential: string,
  method = "GET",
  payload?: unknown,
) {
  const origin = approvedUrl(base);
  if (!/^\/(?:health|manifest|articles(?:\/[a-zA-Z0-9_-]{1,80})?|operations\/[a-f0-9-]{36})$/.test(path))
    throw new Error("INVALID_REQUEST");
  if (!credential || credential.length > 1024 || /[\r\n]/.test(credential))
    throw new Error("INVALID_REQUEST");
  const addresses = await approvedAddresses(origin.hostname);
  const chosen = addresses[0];
  if (!chosen) throw new Error("CONNECTION_TARGET_BLOCKED");
  const url = new URL(origin.toString());
  url.pathname = origin.pathname.replace(/\/$/, "") + path;
  const body = payload === undefined ? undefined : JSON.stringify(payload);
  return new Promise<Record<string, unknown>>((resolve, reject) => {
    const req = request(
      url,
      {
        method,
        family: chosen.family,
        lookup: (_name, _options, done) => done(null, chosen.address, chosen.family),
        headers: {
          authorization: `Bearer ${credential}`,
          accept: "application/json",
          ...(body ? { "content-type": "application/json", "content-length": Buffer.byteLength(body) } : {}),
        },
      },
      (response) => {
        const code = response.statusCode ?? 503;
        if (code < 200 || code >= 300) {
          response.resume();
          reject(
            new Error(
              code === 401 || code === 403
                ? "CONNECTION_PERMISSION_DENIED"
                : code === 409
                  ? "CONFLICT"
                  : code === 404
                    ? "REMOTE_NOT_FOUND"
                    : "CONNECTION_UNAVAILABLE",
            ),
          );
          return;
        }
        if (!response.headers["content-type"]?.includes("application/json")) {
          response.destroy();
          reject(new Error("INCOMPATIBLE_CONNECTION"));
          return;
        }
        const chunks: Buffer[] = [];
        let size = 0;
        response.on("data", (chunk: Buffer) => {
          size += chunk.length;
          if (size > 262144) {
            response.destroy();
            reject(new Error("CONNECTION_RESPONSE_TOO_LARGE"));
          } else chunks.push(chunk);
        });
        response.on("error", () => reject(new Error("CONNECTION_UNAVAILABLE")));
        response.on("end", () => {
          try {
            const data: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"));
            if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error();
            resolve(data as Record<string, unknown>);
          } catch {
            reject(new Error("INCOMPATIBLE_CONNECTION"));
          }
        });
      },
    );
    const deadline = setTimeout(() => req.destroy(new Error("CONNECTION_UNAVAILABLE")), 5000);
    req.on("close", () => clearTimeout(deadline));
    req.on("error", () => reject(new Error("CONNECTION_UNAVAILABLE")));
    if (body) req.write(body);
    req.end();
  });
}
