import { spawn } from "node:child_process";

// The local preview uses synthetic fixtures, never a production authentication bypass.
const cli = process.env.npm_execpath;
if (!cli) throw new Error("Run this command with pnpm dev.");
const child = spawn(process.execPath, [cli, "--filter", "@openhubpanel/web", "dev"], {
  stdio: "inherit",
  env: { ...process.env, OPENHUB_PREVIEW: "1", NEXT_TELEMETRY_DISABLED: "1" },
});
child.on("exit", (code) => process.exit(code ?? 1));
