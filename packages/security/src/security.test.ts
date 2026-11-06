import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  assertTrustedOrigin,
  canAssignRole,
  hasPermission,
  parseRuntimeConfig,
  safeTokenEqual,
} from "./index";

describe("server-side authorization", () => {
  it("denies unknown roles and permissions by default", () => {
    expect(hasPermission("superadmin", "content.read")).toBe(false);
    expect(hasPermission("__proto__", "content.read")).toBe(false);
    expect(hasPermission("owner", "database.drop")).toBe(false);
  });
  it("keeps viewers read only and editors out of role management", () => {
    expect(hasPermission("viewer", "content.read")).toBe(true);
    expect(hasPermission("viewer", "content.write")).toBe(false);
    expect(hasPermission("editor", "members.manage")).toBe(false);
  });
  it("does not let admins manufacture other admins or owners", () => {
    expect(canAssignRole("admin", "owner")).toBe(false);
    expect(canAssignRole("admin", "admin")).toBe(false);
    expect(canAssignRole("admin", "editor")).toBe(true);
    expect(canAssignRole("viewer", "viewer")).toBe(false);
  });
});

describe("browser request boundary", () => {
  it.each([
    null,
    "null",
    "https://panel.example.attacker.test",
    "https://attacker.test",
    "https://user@panel.example",
    "https://panel.example/path",
  ])("rejects an untrusted origin (%s)", (origin) =>
    expect(() => assertTrustedOrigin(origin, "https://panel.example")).toThrow(),
  );
  it("allows the exact configured origin", () => {
    expect(() => assertTrustedOrigin("https://panel.example", "https://panel.example")).not.toThrow();
  });
  it("rejects tokens of a different value or length", () => {
    expect(safeTokenEqual("", "")).toBe(false);
    expect(safeTokenEqual("abc", "abc")).toBe(true);
    expect(safeTokenEqual("abc", "abcd")).toBe(false);
    expect(safeTokenEqual("abc", "abd")).toBe(false);
  });
  it.each([
    "https://panel.example/",
    " https://panel.example",
    "https://panel.example?",
    "https://panel.example#",
    "https://panel.example:443",
  ])("rejects non-serialized browser origins (%s)", (origin) =>
    expect(() => assertTrustedOrigin(origin, "https://panel.example")).toThrow("UNTRUSTED_ORIGIN"),
  );
  it.each([
    "file:///",
    "ftp://panel.example",
    "https://user@panel.example",
    "https://panel.example/path",
    "not a URL",
  ])("fails closed for invalid trusted configuration (%s)", (trusted) =>
    expect(() => assertTrustedOrigin(trusted, trusted)).toThrow("UNTRUSTED_ORIGIN"),
  );
});

describe("production configuration", () => {
  const config = {
    APP_ORIGIN: "https://panel.example",
    DATABASE_URL: "postgresql://test:example@localhost/test",
    REDIS_URL: "redis://localhost:6379",
    ENCRYPTION_KEY: randomBytes(32).toString("hex"),
  };
  it("fails closed with a missing secret without disclosing inputs", () => {
    expect(() => parseRuntimeConfig({ ...config, ENCRYPTION_KEY: "DO_NOT_DISCLOSE_THIS" }, true)).toThrow(
      "Invalid configuration: ENCRYPTION_KEY",
    );
  });
  it("refuses insecure production origins", () => {
    expect(() => parseRuntimeConfig({ ...config, APP_ORIGIN: "http://panel.example" }, true)).toThrow(
      "HTTPS",
    );
  });
  it("refuses the wrong database protocol", () => {
    expect(() => parseRuntimeConfig({ ...config, DATABASE_URL: "https://database.example" }, true)).toThrow(
      "protocol",
    );
  });
  it("accepts complete production configuration", () => {
    expect(parseRuntimeConfig(config, true).APP_ORIGIN).toBe(config.APP_ORIGIN);
  });
  it.each(["file:///", "ftp://panel.example"])(
    "rejects non-web origins even during development (%s)",
    (origin) => {
      expect(() => parseRuntimeConfig({ ...config, APP_ORIGIN: origin }, false)).toThrow("HTTP or HTTPS");
    },
  );
});
