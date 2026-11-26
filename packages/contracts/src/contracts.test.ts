import { describe, expect, it } from "vitest";
import { articleUpdateSchema, connectorManifestSchema } from "./index";

describe("connector trust boundary", () => {
  const manifest = {
    id: "content-service",
    name: "Content service",
    contractVersion: "1.0",
    resources: [{ id: "articles", name: "Articles", capabilities: ["list", "read"] }],
  };
  it("accepts a supported declarative contract with one or more resources", () => {
    expect(connectorManifestSchema.parse(manifest).resources[0]?.id).toBe("articles");
    const multi = {
      ...manifest,
      resources: [
        { id: "articles", name: "Articles", capabilities: ["list", "read", "update"] },
        { id: "pages", name: "Pages", capabilities: ["list", "read", "update"] },
      ],
    };
    expect(connectorManifestSchema.parse(multi).resources).toHaveLength(2);
  });
  it.each([{ baseUrl: "http://169.254.169.254" }, { script: "fetch('/secrets')" }, { token: "secret" }])(
    "rejects executable code, credentials and network targets in a manifest",
    (extra) => {
      expect(connectorManifestSchema.safeParse({ ...manifest, ...extra }).success).toBe(false);
    },
  );
  it("rejects an incompatible contract version", () => {
    expect(connectorManifestSchema.safeParse({ ...manifest, contractVersion: "2.0" }).success).toBe(false);
  });
  it("rejects a client-supplied tenant and missing concurrency proof", () => {
    expect(articleUpdateSchema.safeParse({ title: "Changed", workspaceId: "other" }).success).toBe(false);
  });
  it("rejects duplicate resource IDs instead of choosing an ambiguous definition", () => {
    const first = manifest.resources[0];
    expect(connectorManifestSchema.safeParse({ ...manifest, resources: [first, first] }).success).toBe(false);
  });
  it("rejects repeated capabilities and blank display names", () => {
    expect(
      connectorManifestSchema.safeParse({
        ...manifest,
        resources: [{ id: "articles", name: "Articles", capabilities: ["read", "read"] }],
      }).success,
    ).toBe(false);
    expect(connectorManifestSchema.safeParse({ ...manifest, name: "   " }).success).toBe(false);
    expect(
      connectorManifestSchema.safeParse({
        ...manifest,
        resources: [{ id: "articles", name: "   ", capabilities: ["read"] }],
      }).success,
    ).toBe(false);
  });
});
