import { readFile } from "node:fs/promises";
import { createDatabase } from "../packages/db/src/index";

const url = process.env.GENERAL_MIGRATION_DATABASE_URL;
if (!url) throw new Error("Set GENERAL_MIGRATION_DATABASE_URL privately for the migration operator.");
const db = createDatabase(url);
try {
  await db.begin(async (tx) => {
    await tx`SELECT pg_advisory_xact_lock(719422)`;
    await tx`CREATE TABLE IF NOT EXISTS public.hub_migrations(name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`;
    for (const name of [
      "0001_workspace_foundation.sql",
      "0002_general_identity.sql",
      "0003_workspace_management.sql",
      "0004_workspace_connections.sql",
    ]) {
      if ((await tx`SELECT name FROM public.hub_migrations WHERE name=${name}`).length) continue;
      // Existing foundation installations must be explicitly reconciled by their operator first.
      await tx.unsafe(await readFile(`packages/db/migrations/${name}`, "utf8"));
      await tx`INSERT INTO public.hub_migrations(name) VALUES(${name})`;
      console.log(`Applied ${name}`);
    }
  });
} finally {
  await db.end({ timeout: 5 });
}
