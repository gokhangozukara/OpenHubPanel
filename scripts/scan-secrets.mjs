import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const files = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" }).split("\0").filter(Boolean);
if (!files.length) throw new Error("No tracked files to scan. Stage the intended source files first.");
const forbiddenPath =
  /(^|\/)(reference-panels|node_modules|\.local|\.next|uploads|backups)(\/|$)|\.local\.md$|(^|\/)\.env(?!\.example$)(\.|$)|\.(pem|key|pfx|p12|dump|sqlite3?)$|\.bak(?:-|$)/;
const patterns = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /\bgh[pousr]_[A-Za-z0-9]{30,}\b/,
  /\bgithub_pat_[A-Za-z0-9_]{40,}\b/,
  /\bAKIA[0-9A-Z]{16}\b/,
  /\bsk-(?:proj-)?[A-Za-z0-9_-]{32,}\b/,
];
const findings = [];
for (const file of files) {
  if (forbiddenPath.test(file)) findings.push({ file, reason: "excluded local/private file is tracked" });
  const text = readFileSync(file, "utf8");
  if (text.includes("\0")) continue;
  if (patterns.some((pattern) => pattern.test(text)))
    findings.push({ file, reason: "potential credential pattern" });
}
if (findings.length) {
  // Never disclose a matching value, including in CI logs.
  console.error(JSON.stringify({ findings }));
  process.exitCode = 1;
} else
  console.log(
    `Source boundary scan: ${files.length} tracked files checked. Run Gitleaks separately for full history.`,
  );
