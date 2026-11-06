import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

// The local preview uses synthetic fixtures, never a production authentication bypass.
const webPackage = new URL("../apps/web/package.json", import.meta.url);
const require = createRequire(webPackage);
const cli = require.resolve("next/dist/bin/next");
const child = spawn(process.execPath, [cli, "dev", "--hostname", "127.0.0.1"], {
  cwd: fileURLToPath(new URL("../apps/web/", import.meta.url)),
  stdio: "inherit",
  env: { ...process.env, OPENHUB_PREVIEW: "1", NEXT_TELEMETRY_DISABLED: "1" },
});
child.on("exit", (code) => process.exit(code ?? 1));
