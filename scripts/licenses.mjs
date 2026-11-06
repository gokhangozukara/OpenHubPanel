import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const store = "node_modules/.pnpm";
const found = new Map();
async function inspect(dir) {
  try {
    const pkg = JSON.parse(await readFile(path.join(dir, "package.json"), "utf8"));
    if (!pkg.name || !pkg.version) return;
    found.set(`${pkg.name}@${pkg.version}`, {
      name: pkg.name,
      version: pkg.version,
      license: typeof pkg.license === "string" ? pkg.license : (pkg.license?.type ?? "REVIEW REQUIRED"),
      repository: typeof pkg.repository === "string" ? pkg.repository : (pkg.repository?.url ?? ""),
    });
  } catch {
    /* A store entry can be a dependency link or metadata, not a package. */
  }
}
for (const entry of await readdir(store, { withFileTypes: true })) {
  if (!entry.isDirectory() || entry.name === "node_modules") continue;
  const modules = path.join(store, entry.name, "node_modules");
  let children;
  try {
    children = await readdir(modules, { withFileTypes: true });
  } catch {
    continue;
  }
  for (const child of children) {
    if (child.name.startsWith("@")) {
      for (const scoped of await readdir(path.join(modules, child.name)))
        await inspect(path.join(modules, child.name, scoped));
    } else await inspect(path.join(modules, child.name));
  }
}
const inventory = [...found.values()].sort(
  (a, b) => a.name.localeCompare(b.name) || a.version.localeCompare(b.version),
);
await mkdir("docs", { recursive: true });
await writeFile(
  "docs/dependency-licenses.json",
  `${JSON.stringify({ description: "Installed dependency metadata, including development tooling. Not a substitute for retaining third-party LICENSE/NOTICE files. Platform-specific entries vary by installation.", packages: inventory }, null, 2)}\n`,
);
console.log(`Recorded ${inventory.length} installed dependency versions and license declarations.`);
