import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const output = process.env.OPERATOR_TEST_OUTPUT;
if (!output) throw new Error("OPERATOR_TEST_OUTPUT required");
mkdirSync(output, { recursive: true });
const fixture = mkdtempSync(path.join(output, "examples-"));
const key = randomBytes(32).toString("base64url");
const children = [
  spawn(process.execPath, ["examples/content-api/server.mjs"], {
    cwd: root,
    env: { ...process.env, API_TOKEN: key, DATA_FILE: path.join(fixture, "content.sqlite"), PORT: "3191" },
    stdio: ["ignore", "pipe", "pipe"],
  }),
  spawn(process.platform === "win32" ? "python" : "python3", ["examples/read-only-api/server.py"], {
    cwd: root,
    env: { ...process.env, API_TOKEN: key, PORT: "3192" },
    stdio: ["ignore", "pipe", "pipe"],
  }),
];
let logs = "";
for (const child of children) {
  child.stdout.on("data", (value) => (logs += value));
  child.stderr.on("data", (value) => (logs += value));
}
const call = (port, endpoint, method = "GET", body, token = key) =>
  fetch(`http://127.0.0.1:${port}/hubpanel/v1${endpoint}`, {
    method,
    headers: { authorization: `Bearer ${token}`, ...(body ? { "content-type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
try {
  for (const port of [3191, 3192]) {
    for (let attempt = 0; attempt < 60; attempt++) {
      try {
        if ((await call(port, "/health")).ok) break;
      } catch {}
      if (attempt === 59) throw new Error(logs);
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    assert.equal((await call(port, "/health", "GET", undefined, "invalid")).status, 401);
    assert.equal((await (await call(port, "/health")).json()).contractVersion, "1.0");
    const manifest = await (await call(port, "/manifest")).json();
    assert.equal(manifest.resources[0].id, "articles");
    const list = await (await call(port, "/articles")).json();
    assert.equal(list.items.length, 1);
    assert.equal((await (await call(port, "/articles/welcome")).json()).version, 1);
  }
  const body = { title: "Changed through the contract", expectedVersion: 1, idempotencyKey: randomUUID() };
  const changed = await (await call(3191, "/articles/welcome", "PATCH", body)).json();
  assert.equal(changed.version, 2);
  assert.deepEqual(await (await call(3191, "/articles/welcome", "PATCH", body)).json(), changed);
  assert.deepEqual(await (await call(3191, `/operations/${body.idempotencyKey}`)).json(), changed);
  assert.equal(
    (await call(3191, "/articles/welcome", "PATCH", { ...body, idempotencyKey: randomUUID() })).status,
    409,
  );
  assert.equal(
    (await call(3191, "/articles/welcome", "PATCH", { ...body, title: "Changed replay" })).status,
    409,
  );
  assert.equal((await call(3192, "/articles/welcome", "PATCH", body)).status, 405);
  writeFileSync(
    path.join(output, "result.json"),
    JSON.stringify(
      {
        passed: true,
        independentExamples: 2,
        scenarios: [
          "bearer identity required",
          "health and manifest compatibility",
          "bounded list and detail",
          "title update and optimistic version",
          "idempotent replay and operation reconciliation",
          "changed replay rejection",
          "independent Python service read-only",
        ],
      },
      null,
      2,
    ),
  );
  console.log("Two independent API example contract checks passed:", output);
} finally {
  for (const child of children) child.kill();
  await Promise.all(
    children.map((child) =>
      child.exitCode !== null ? undefined : new Promise((resolve) => child.once("exit", resolve)),
    ),
  );
}
