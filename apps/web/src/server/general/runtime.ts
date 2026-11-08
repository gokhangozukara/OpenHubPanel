import { createDatabase, type Database } from "@openhubpanel/db";
import { generalAuth } from "./auth";
import { generalConnections } from "./connections";
import { secretBox } from "./crypto";
import { generalWorkspaces } from "./workspaces";

let database: Database | undefined;
export function generalEnabled() {
  return process.env.GENERAL_ENABLED === "1";
}
export function generalRuntime() {
  if (!generalEnabled()) throw new Error("GENERAL_DISABLED");
  const url = process.env.GENERAL_DATABASE_URL;
  const key = process.env.GENERAL_ENCRYPTION_KEY;
  if (!url || !key) throw new Error("GENERAL_UNCONFIGURED");
  secretBox(key);
  const origin = new URL(process.env.APP_ORIGIN ?? "invalid:");
  if (
    origin.protocol !== "https:" ||
    origin.username ||
    origin.password ||
    origin.pathname !== "/" ||
    origin.search ||
    origin.hash
  )
    throw new Error("GENERAL_UNCONFIGURED");
  database ??= createDatabase(url);
  return {
    db: database,
    auth: generalAuth(database, key),
    workspaces: generalWorkspaces(database, key),
    connections: generalConnections(database, key),
  };
}

export async function validateGeneralRuntime() {
  const { db } = generalRuntime();
  const roles = await db`SELECT rolsuper,rolbypassrls FROM pg_roles WHERE rolname=current_user`;
  const inherited = await db`SELECT rolname FROM pg_roles WHERE (rolsuper OR rolbypassrls)
    AND pg_has_role(current_user,oid,'MEMBER')`;
  const owners = await db`SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname IN ('public','hub_identity') AND c.relkind='r' AND pg_has_role(current_user,c.relowner,'MEMBER')`;
  if (roles[0]?.rolsuper || roles[0]?.rolbypassrls || owners.length || inherited.length)
    throw new Error("General product requires a separate restricted database login.");
  await db`SELECT hash FROM hub_identity.sessions LIMIT 0`;
  await db`SELECT id FROM workspace_connections LIMIT 0`;
}
