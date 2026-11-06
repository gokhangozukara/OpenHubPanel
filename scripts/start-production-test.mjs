import { spawn } from "node:child_process";
import { cp } from "node:fs/promises";
import { fileURLToPath } from "node:url";

// Exercise the same standalone artifact used by the container, on loopback only.
const output = new URL("../apps/web/.next/", import.meta.url);
await cp(
  fileURLToPath(new URL("static/", output)),
  fileURLToPath(new URL("standalone/apps/web/.next/static/", output)),
  { recursive: true },
);
const child = spawn(process.execPath, [fileURLToPath(new URL("standalone/apps/web/server.js", output))], {
  stdio: "inherit",
  env: {
    ...process.env,
    NODE_ENV: "production",
    HOSTNAME: "127.0.0.1",
    PORT: "3101",
    OPENHUB_PREVIEW: "1",
    NEXT_TELEMETRY_DISABLED: "1",
  },
});
child.on("error", () => {
  console.error("Could not start the production test server.");
  process.exitCode = 1;
});
child.on("exit", (code) => process.exit(code ?? 1));
