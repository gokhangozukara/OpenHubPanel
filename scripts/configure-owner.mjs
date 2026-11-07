import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const options = new Map(
  process.argv.slice(2).map((argument) => {
    const index = argument.indexOf("=");
    if (!argument.startsWith("--") || index < 3)
      throw new Error(
        "Use --origin=https://panel.example.com --email=owner@example.com [--state=/absolute/private/directory]",
      );
    return [argument.slice(2, index), argument.slice(index + 1)];
  }),
);
for (const key of options.keys())
  if (!["origin", "email", "state", "port"].includes(key)) throw new Error(`Unknown option: ${key}`);
if (process.platform !== "linux") throw new Error("Run setup from the Linux release on your server.");
if (process.getuid?.() === 0)
  throw new Error(
    "Run setup as the unprivileged account that will run the panel. Create/chown its private state directory first.",
  );
const origin = new URL(options.get("origin") ?? "invalid:");
const email = options.get("email") ?? "";
if (
  origin.protocol !== "https:" ||
  origin.username ||
  origin.password ||
  origin.pathname !== "/" ||
  origin.search ||
  origin.hash
)
  throw new Error("An HTTPS origin without a path is required.");
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("A valid owner email is required.");
const directory = options.get("state") ?? path.join(homedir(), ".local/share/openhubpanel");
if (!path.isAbsolute(directory)) throw new Error("State directory must be absolute.");
if (/[\r\n]/.test(directory)) throw new Error("State directory cannot contain line breaks.");
const port = Number(options.get("port") ?? 3047);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error("Use a port from 1024 to 65535.");
const release = path.dirname(fileURLToPath(import.meta.url));
const runtime = path.join(release, "runtime/node");
const bootstrap = path.join(release, "operator-bootstrap.mjs");
if (!existsSync(runtime) || !existsSync(bootstrap) || !existsSync(path.join(release, "apps/web/server.js")))
  throw new Error("Run setup.mjs from a complete Linux release.");
const base = readFileSync(path.join(release, "BUILD_BASE_PATH"), "utf8").trim();
if (base && !/^\/[a-zA-Z0-9/_-]+$/.test(base)) throw new Error("Invalid build prefix.");
const envfile = path.join(directory, "operator.env");
const database = path.join(directory, "identity.sqlite");
if (existsSync(envfile) || existsSync(database))
  throw new Error(
    "This directory already contains an installation. Setup never resets an existing account or keys.",
  );
process.umask(0o077);
mkdirSync(directory, { recursive: true, mode: 0o700 });
chmodSync(directory, 0o700);
const values = {
  NODE_ENV: "production",
  OPENHUB_OPERATOR: "1",
  OPERATOR_DATA_MODE: "embedded",
  APP_ORIGIN: origin.origin,
  OPENHUB_BASE_PATH: base,
  OPERATOR_EMAIL: email,
  OPERATOR_STATE_FILE: database,
  OPERATOR_KEY: randomBytes(32).toString("hex"),
  HOSTNAME: "127.0.0.1",
  PORT: String(port),
  NEXT_TELEMETRY_DISABLED: "1",
};
writeFileSync(
  envfile,
  `${Object.entries(values)
    .map(([key, value]) => `${key}=${value}`)
    .join("\n")}\n`,
  { mode: 0o600, flag: "wx" },
);
writeFileSync(
  path.join(directory, "backup.env"),
  `OPERATOR_STATE_FILE=${database}\nOPERATOR_BACKUP_DIR=${path.join(directory, "backups")}\nOPERATOR_BACKUP_KEY=${randomBytes(32).toString("hex")}\n`,
  { mode: 0o600, flag: "wx" },
);
const proxy = `# Include inside your HTTPS server block for ${origin.hostname}.\nlocation = / { return 302 ${base}/live; }\nlocation ${base}/ {\n    proxy_pass http://127.0.0.1:${port};\n    proxy_set_header Host $host;\n    proxy_set_header X-Forwarded-Proto https;\n    proxy_set_header X-OpenHub-Client-IP $remote_addr;\n    client_max_body_size 80k;\n    proxy_next_upstream off;\n    proxy_hide_header Cache-Control;\n    add_header Cache-Control "$upstream_http_cache_control, no-transform" always;\n}\n`;
writeFileSync(path.join(directory, "nginx.conf"), proxy, { mode: 0o600, flag: "wx" });
execFileSync(runtime, [`--env-file=${envfile}`, bootstrap, "--migrate"], { stdio: "pipe" });
chmodSync(database, 0o600);
const quote = (value) => `'${value.replaceAll("'", "'\\''")}'`;
console.log(
  "Independent panel initialized with zero applications. Private keys were written to the state directory.",
);
console.log(`Configure HTTPS using ${path.join(directory, "nginx.conf")}`);
console.log(
  `Start: ${quote(runtime)} ${quote(`--env-file=${envfile}`)} ${quote(path.join(release, "apps/web/server.js"))}`,
);
console.log("One-use owner activation link (15 minutes):");
process.stdout.write(execFileSync(runtime, [`--env-file=${envfile}`, bootstrap], { encoding: "utf8" }));
