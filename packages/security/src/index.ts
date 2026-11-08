import { timingSafeEqual } from "node:crypto";
import { z } from "zod";

export { canAssignRole, hasPermission } from "./permissions";

export function assertTrustedOrigin(origin: string | null, trustedOrigin: string): void {
  if (!origin || origin === "null") throw new Error("UNTRUSTED_ORIGIN");
  let trusted: URL;
  let candidate: URL;
  try {
    trusted = new URL(trustedOrigin);
    candidate = new URL(origin);
  } catch {
    throw new Error("UNTRUSTED_ORIGIN");
  }
  if (
    !["http:", "https:"].includes(trusted.protocol) ||
    trusted.username ||
    trusted.password ||
    trusted.pathname !== "/" ||
    trusted.search ||
    trusted.hash ||
    origin !== candidate.origin ||
    candidate.origin !== trusted.origin ||
    candidate.username ||
    candidate.password ||
    candidate.pathname !== "/" ||
    candidate.search ||
    candidate.hash
  ) {
    throw new Error("UNTRUSTED_ORIGIN");
  }
}

export function safeTokenEqual(actual: string, expected: string): boolean {
  if (!actual || !expected) return false;
  const a = Buffer.from(actual);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

const configSchema = z.object({
  APP_ORIGIN: z.url(),
  DATABASE_URL: z.url(),
  REDIS_URL: z.url(),
  ENCRYPTION_KEY: z.string().regex(/^[a-f0-9]{64}$/i),
});

export function parseRuntimeConfig(input: Record<string, string | undefined>, production: boolean) {
  const parsed = configSchema.safeParse(input);
  // Report field names only; Zod error payloads can contain supplied secret values.
  if (!parsed.success)
    throw new Error(
      `Invalid configuration: ${[...new Set(parsed.error.issues.map((issue) => issue.path[0]))].join(", ")}`,
    );
  const config = parsed.data;
  const origin = new URL(config.APP_ORIGIN);
  if (!["http:", "https:"].includes(origin.protocol)) throw new Error("APP_ORIGIN requires HTTP or HTTPS");
  if (origin.username || origin.password || origin.pathname !== "/" || origin.search || origin.hash)
    throw new Error("APP_ORIGIN must be an origin");
  if (production && origin.protocol !== "https:") throw new Error("Production APP_ORIGIN requires HTTPS");
  if (!["postgres:", "postgresql:"].includes(new URL(config.DATABASE_URL).protocol))
    throw new Error("Invalid database protocol");
  if (!["redis:", "rediss:"].includes(new URL(config.REDIS_URL).protocol))
    throw new Error("Invalid Redis protocol");
  if (/^(0{64}|f{64})$/i.test(config.ENCRYPTION_KEY))
    throw new Error("ENCRYPTION_KEY must be randomly generated");
  return config;
}
