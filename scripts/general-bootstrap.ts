import { generalAuth } from "../apps/web/src/server/general/auth";
import { createDatabase } from "../packages/db/src/index";

// Operator-only command. Never mount bootstrap issuance as a public API.
const url = process.env.GENERAL_DATABASE_URL;
const key = process.env.GENERAL_ENCRYPTION_KEY;
if (!url || !key) throw new Error("Set GENERAL_DATABASE_URL and GENERAL_ENCRYPTION_KEY privately.");
const db = createDatabase(url);
try {
  const roles = await db`SELECT rolsuper,rolbypassrls FROM pg_roles WHERE rolname=current_user`;
  if (roles[0]?.rolsuper || roles[0]?.rolbypassrls)
    throw new Error("Use the restricted application login, not a database operator.");
  const bootstrap = await generalAuth(db, key).createBootstrap();
  console.log("One-use general setup token (expires in 15 minutes; keep private):");
  console.log(bootstrap);
} finally {
  await db.end({ timeout: 5 });
}
