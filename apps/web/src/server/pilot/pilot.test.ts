import { randomBytes } from "node:crypto";
import { mkdtempSync, rmdirSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { SignJWT } from "jose";
import { afterEach, expect, it, vi } from "vitest";
import { probePilotApplication, readPilotCatalog } from "./catalog";
import { verifyPilotSession } from "./session";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

it("accepts only a fresh signed token for the configured operator", async () => {
  const secret = randomBytes(32).toString("hex");
  vi.stubEnv("OPENHUB_PILOT", "1");
  vi.stubEnv("PILOT_ACCOUNT", "test-operator");
  vi.stubEnv("PILOT_SESSION_SECRET", secret);
  const key = new TextEncoder().encode(secret);
  const token = await new SignJWT({ u: "test-operator" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(key);
  expect(await verifyPilotSession(token)).toBe(true);
  expect(await verifyPilotSession(`${token}x`)).toBe(false);
  expect(await verifyPilotSession(undefined)).toBe(false);
  expect(
    await verifyPilotSession(
      await new SignJWT({ u: "someone-else" })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime("1h")
        .sign(key),
    ),
  ).toBe(false);
  expect(
    await verifyPilotSession(
      await new SignJWT({ u: "test-operator" })
        .setProtectedHeader({ alg: "HS384" })
        .setIssuedAt()
        .setExpirationTime("1h")
        .sign(key),
    ),
  ).toBe(false);
  expect(
    await verifyPilotSession(
      await new SignJWT({ u: "test-operator" })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt(Math.floor(Date.now() / 1000) - 9 * 3600)
        .setExpirationTime("1h")
        .sign(key),
    ),
  ).toBe(false);
  vi.stubEnv("OPENHUB_PILOT", "0");
  expect(await verifyPilotSession(token)).toBe(false);
});

it("reads only allowlisted fields and cannot write the source database", async () => {
  const directory = mkdtempSync(path.join(tmpdir(), "openhub-pilot-"));
  const filename = path.join(directory, "fixture.sqlite");
  const database = new DatabaseSync(filename);
  database.exec(
    "CREATE TABLE apps(slug TEXT,name TEXT,category TEXT,package TEXT,sort INTEGER); CREATE TABLE app_config(slug TEXT,latest_version TEXT,maintenance_mode INTEGER,private_credential TEXT)",
  );
  database
    .prepare("INSERT INTO apps VALUES (?, ?, ?, ?, ?)")
    .run("example", "Example", "Tools", "test.example", 0);
  database
    .prepare("INSERT INTO app_config VALUES (?, ?, ?, ?)")
    .run("example", "1.0.0", 0, "synthetic-secret");
  database.close();
  vi.stubEnv("OPENHUB_PILOT", "1");
  vi.stubEnv("PILOT_DATA_FILE", filename);
  try {
    const catalog = readPilotCatalog();
    expect(catalog).toEqual([
      {
        id: "example",
        name: "Example",
        category: "Tools",
        packageName: "test.example",
        version: "1.0.0",
        maintenance: false,
        legacyPath: "/app/example",
      },
    ]);
    expect(JSON.stringify(catalog)).not.toContain("synthetic-secret");
    const fetcher = vi.fn(async (_input: RequestInfo | URL) =>
      Response.json({ app: "example", ads: {}, update: {} }),
    );
    vi.stubGlobal("fetch", fetcher);
    vi.stubEnv("PILOT_UPSTREAM_ORIGIN", "http://127.0.0.1:3046");
    expect((await probePilotApplication("example")).status).toBe("reachable");
    expect(fetcher.mock.calls[0]?.[0]?.toString()).toBe("http://127.0.0.1:3046/api/v1/apps/example/config");
    await expect(probePilotApplication("../../private")).rejects.toThrow("APPLICATION_NOT_FOUND");
    vi.stubEnv("PILOT_UPSTREAM_ORIGIN", "http://169.254.169.254");
    await expect(probePilotApplication("example")).rejects.toThrow("INVALID_PILOT_TARGET");
    expect(fetcher).toHaveBeenCalledTimes(1);
    vi.stubEnv("PILOT_UPSTREAM_ORIGIN", "http://127.0.0.1:3046");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ app: "another", ads: {}, update: {} })),
    );
    await expect(probePilotApplication("example")).rejects.toThrow("INCOMPATIBLE_CONNECTION");
  } finally {
    unlinkSync(filename);
    rmdirSync(directory);
  }
});
