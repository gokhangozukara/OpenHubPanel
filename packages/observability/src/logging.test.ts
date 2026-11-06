import { expect, it, vi } from "vitest";
import { logEvent, redact } from "./index";

it("redacts nested credentials and raw errors", () => {
  const result = JSON.stringify(
    redact({
      requestId: "123",
      nested: { accessToken: "never-visible", email: "private@example.test" },
      errors: [new Error("postgres://secret")],
    }),
  );
  expect(result).not.toContain("never-visible");
  expect(result).not.toContain("private@example");
  expect(result).not.toContain("postgres://");
  expect(result).toContain("123");
});

it("redacts alternate credential spellings and does not execute getters or toJSON", () => {
  const getter = vi.fn(() => {
    throw new Error("Getter must not run");
  });
  const source = {
    api_key: "synthetic-api-value",
    privateKey: "synthetic-private-value",
    recoveryCodes: ["synthetic-recovery-value"],
    databaseUrl: "synthetic-connection-value",
    otp: "123456",
    requestId: "safe-request-id",
    toJSON: () => ({ leaked: "synthetic-serializer-value" }),
  };
  Object.defineProperty(source, "details", { enumerable: true, get: getter });
  const output = JSON.stringify(redact(source));
  expect(output).not.toContain("synthetic-");
  expect(output).not.toContain("123456");
  expect(output).toContain("safe-request-id");
  expect(getter).not.toHaveBeenCalled();
});

it("serializes database bigints, cyclic fields and binary data without failing logging", () => {
  const write = vi.spyOn(process.stdout, "write").mockReturnValue(true);
  try {
    const fields: Record<string, unknown> = { rows: 12n, binary: Buffer.from("synthetic-binary-secret") };
    fields.self = fields;
    expect(() => logEvent("test.completed", fields)).not.toThrow();
    const output = String(write.mock.calls[0]?.[0]);
    expect(JSON.parse(output).fields.rows).toBe("12");
    expect(output).toContain("[TRUNCATED]");
    expect(output).not.toContain("synthetic-binary-secret");
  } finally {
    write.mockRestore();
  }
});
