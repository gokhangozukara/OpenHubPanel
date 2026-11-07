import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { embeddedConnector, embeddedPublicConfig, ownerSections } from "./embedded";
import { migrate, state } from "./store";

let directory: string;
beforeEach(() => {
  directory = mkdtempSync(path.join(tmpdir(), "openhub-embedded-"));
  vi.stubEnv("OPENHUB_OPERATOR", "1");
  vi.stubEnv("OPERATOR_STATE_FILE", path.join(directory, "identity.sqlite"));
  const db = state();
  migrate(db);
  db.close();
});
afterEach(() => {
  vi.unstubAllEnvs();
  if (!path.resolve(directory).startsWith(`${path.resolve(tmpdir())}${path.sep}`))
    throw new Error("Unexpected fixture path");
  rmSync(directory, { recursive: true, force: true, maxRetries: 10, retryDelay: 30 });
});
function create() {
  return embeddedConnector("/apps/fresh/settings/application", "PUT", {
    requestId: randomUUID(),
    revision: "0".repeat(64),
    values: { name: "Fresh", package: "invalid.example", category: "Tools" },
  });
}
it("starts empty, registers an independent application and publishes only public configuration", () => {
  expect(embeddedConnector("/apps").applications).toEqual([]);
  create();
  expect(embeddedConnector("/apps").applications as unknown[]).toHaveLength(1);
  const notes = embeddedConnector("/apps/fresh/settings/notes");
  embeddedConnector("/apps/fresh/settings/notes", "PUT", {
    requestId: randomUUID(),
    revision: notes.revision,
    values: { notes: "Private synthetic note" },
  });
  const config = embeddedPublicConfig("fresh");
  expect(config.app).toBe("fresh");
  expect(JSON.stringify(config)).not.toContain("Private synthetic note");
  expect(config.ads.banner_1_active).toBe(false);
  expect(embeddedConnector("/audit")).toHaveLength(2);
});
it("round-trips every setting section with safe defaults, optimistic versions and idempotency", () => {
  create();
  for (const [section, fields] of Object.entries(ownerSections)) {
    const prior = embeddedConnector(`/apps/fresh/settings/${section}`);
    const values = Object.fromEntries(
      fields.map(([name, , type]) => [
        name,
        type === "boolean" ? true : type === "integer" ? 3 : type === "frequency" ? "daily" : "Synthetic",
      ]),
    );
    const input = { requestId: randomUUID(), revision: prior.revision, values };
    const result = embeddedConnector(`/apps/fresh/settings/${section}`, "PUT", input);
    expect(embeddedConnector(`/apps/fresh/settings/${section}`, "PUT", input)).toEqual(result);
    expect(embeddedConnector(`/apps/fresh/settings/${section}`).values).toEqual(values);
    expect(() =>
      embeddedConnector(`/apps/fresh/settings/${section}`, "PUT", { ...input, requestId: randomUUID() }),
    ).toThrow("CONFLICT");
  }
  expect(embeddedPublicConfig("fresh").popup.version).toBe(1);
});
it("rolls back application registration if its audit fails and never pretends push is configured", () => {
  const db = state();
  db.exec(
    "CREATE TRIGGER reject_application_audit BEFORE INSERT ON operator_application_audit BEGIN SELECT RAISE(ABORT,'fixture'); END",
  );
  db.close();
  expect(create).toThrow("fixture");
  expect(embeddedConnector("/apps").applications).toEqual([]);
  const writer = state();
  writer.exec("DROP TRIGGER reject_application_audit");
  writer.close();
  create();
  expect(embeddedConnector("/apps/fresh/settings/push").ready).toBe(false);
});
