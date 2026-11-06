const sensitive =
  /password|token|secret|authorization|cookie|credential|database_url|redis_url|email|encryption_key/i;

export function redact(value: unknown, depth = 0): unknown {
  if (depth > 8) return "[TRUNCATED]";
  if (value instanceof Error) return { name: value.name, message: "Internal error; see request ID" };
  if (Array.isArray(value)) return value.slice(0, 100).map((item) => redact(item, depth + 1));
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        sensitive.test(key) ? "[REDACTED]" : redact(item, depth + 1),
      ]),
    );
  return value;
}

export function logEvent(event: string, fields: Record<string, unknown> = {}) {
  process.stdout.write(
    `${JSON.stringify({ time: new Date().toISOString(), event, fields: redact(fields) })}\n`,
  );
}
