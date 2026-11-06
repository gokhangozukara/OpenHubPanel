const sensitive =
  /password|passwd|token|secret|authorization|cookie|credential|databaseurl|redisurl|email|key|recoverycode|otp|connectionstring/i;

export function redact(value: unknown, depth = 0): unknown {
  if (depth > 8) return "[TRUNCATED]";
  if (value instanceof Error) return { name: "Error", message: "Internal error; see request ID" };
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "function" || typeof value === "symbol") return "[UNSUPPORTED]";
  if (ArrayBuffer.isView(value) || value instanceof ArrayBuffer) return "[BINARY]";
  if (Array.isArray(value))
    return Array.from({ length: Math.min(value.length, 100) }, (_, index) => {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (!descriptor) return null;
      return "value" in descriptor ? redact(descriptor.value, depth + 1) : "[ACCESSOR]";
    });
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(Object.getOwnPropertyDescriptors(value))
        .filter(([, descriptor]) => descriptor.enumerable)
        .slice(0, 100)
        .map(([key, descriptor]) => [
          key,
          sensitive.test(key.replace(/[^a-z0-9]/gi, ""))
            ? "[REDACTED]"
            : "value" in descriptor
              ? redact(descriptor.value, depth + 1)
              : "[ACCESSOR]",
        ]),
    );
  return value;
}

export function logEvent(event: string, fields: Record<string, unknown> = {}) {
  process.stdout.write(
    `${JSON.stringify({ time: new Date().toISOString(), event, fields: redact(fields) })}\n`,
  );
}
