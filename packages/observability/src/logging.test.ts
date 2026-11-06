import { expect, it } from "vitest";
import { redact } from "./index";

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
