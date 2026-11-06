import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rmdir, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

it("generates consistent local infrastructure settings without overwriting an existing environment", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "openhubpanel-setup-"));
  const environmentFile = path.join(directory, ".env");
  const script = fileURLToPath(new URL("../../scripts/setup-env.mjs", import.meta.url));
  try {
    const output = execFileSync(process.execPath, [script], { cwd: directory, encoding: "utf8" });
    const first = await readFile(environmentFile, "utf8");
    const values = Object.fromEntries(
      first
        .trim()
        .split("\n")
        .map((line) => {
          const split = line.indexOf("=");
          return [line.slice(0, split), line.slice(split + 1)];
        }),
    );
    expect(values.APP_ORIGIN).toBe("http://127.0.0.1:3000");
    expect(new URL(values.DATABASE_URL ?? "").password === values.APP_DATABASE_PASSWORD).toBe(true);
    expect(new URL(values.REDIS_URL ?? "").password === values.REDIS_PASSWORD).toBe(true);
    for (const field of [
      "POSTGRES_PASSWORD",
      "APP_DATABASE_PASSWORD",
      "REDIS_PASSWORD",
      "ENCRYPTION_KEY",
      "READINESS_TOKEN",
    ]) {
      expect(values[field]?.length).toBe(64);
      expect(output.includes(values[field] ?? "")).toBe(false);
    }
    execFileSync(process.execPath, [script], { cwd: directory, encoding: "utf8" });
    const digest = (text: string) => createHash("sha256").update(text).digest("hex");
    expect(digest(await readFile(environmentFile, "utf8"))).toBe(digest(first));
  } finally {
    await unlink(environmentFile).catch(() => {});
    await rmdir(directory);
  }
});
