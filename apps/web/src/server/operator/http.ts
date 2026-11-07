import { assertTrustedOrigin } from "@openhubpanel/security";
import { cookies } from "next/headers";
import { cookieOptions, csrfCookie } from "./auth";
import { equal, token } from "./store";

export const privateHeaders = { "Cache-Control": "private, no-store" };
export async function csrfToken() {
  const jar = await cookies();
  let value = jar.get(csrfCookie)?.value;
  if (value?.length !== 43) {
    value = token();
    jar.set(csrfCookie, value, { ...cookieOptions, maxAge: 8 * 3600 });
  }
  return value;
}
export async function checkMutation(request: Request) {
  assertTrustedOrigin(request.headers.get("origin"), process.env.APP_ORIGIN ?? "");
  const csrf = (await cookies()).get(csrfCookie)?.value;
  if (!csrf || !equal(csrf, request.headers.get("x-csrf-token") ?? "")) throw new Error("FORBIDDEN");
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    throw new Error("INVALID_REQUEST");
}
export async function body(request: Request): Promise<Record<string, unknown>> {
  if (Number(request.headers.get("content-length") ?? "0") > 65536 || !request.body)
    throw new Error("INVALID_REQUEST");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 65536) throw new Error("INVALID_REQUEST");
      chunks.push(value);
    }
  } finally {
    await reader.cancel();
    reader.releaseLock();
  }
  const value: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("INVALID_REQUEST");
  return value as Record<string, unknown>;
}
export function rejection(error: unknown) {
  const message = error instanceof Error ? error.message : "UNAVAILABLE";
  const names = new Set([
    "PUSH_NOT_CONFIGURED",
    "INVALID_PUSH_TARGET",
    "INVALID_CHARACTER",
    "CHARACTER_INCORRECT",
    "CHARACTER_REQUIRED",
    "INVALID_USERNAME",
    "INVALID_IP_RULES",
    "IP_NOT_ALLOWED",
    "IP_WOULD_LOCK_OUT",
    "UNAUTHENTICATED",
    "INVALID_CREDENTIALS",
    "INVALID_CODE",
    "CODE_ALREADY_USED",
    "CHALLENGE_EXPIRED",
    "INVALID_BOOTSTRAP",
    "PASSWORD_LENGTH",
    "PASSWORD_COMPROMISED",
    "PASSWORD_CHECK_UNAVAILABLE",
    "RATE_LIMITED",
    "FORBIDDEN",
    "INVALID_REQUEST",
    "CONFLICT",
    "UNKNOWN_OUTCOME",
    "APPLICATION_NOT_FOUND",
  ]);
  const code = names.has(message) ? message : "UNAVAILABLE";
  const status =
    code === "UNAUTHENTICATED"
      ? 401
      : code === "FORBIDDEN" || code === "IP_NOT_ALLOWED" || message === "UNTRUSTED_ORIGIN"
        ? 403
        : code === "RATE_LIMITED"
          ? 429
          : code === "CONFLICT"
            ? 409
            : code === "UNAVAILABLE" || code === "UNKNOWN_OUTCOME" || code === "PASSWORD_CHECK_UNAVAILABLE"
              ? 503
              : 400;
  return Response.json({ error: code }, { status, headers: privateHeaders });
}
