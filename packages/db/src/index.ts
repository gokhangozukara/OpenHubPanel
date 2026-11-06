import postgres from "postgres";

export function createDatabase(url: string) {
  return postgres(url, { max: 5, idle_timeout: 20, connect_timeout: 5, prepare: false });
}

export type Database = ReturnType<typeof createDatabase>;
export type WorkspaceContext = { actorId: string; workspaceId: string };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Caller must derive actorId from a verified session, never from request headers or form data.
export async function withWorkspace<T>(
  db: Database,
  context: WorkspaceContext,
  action: (tx: postgres.TransactionSql) => Promise<T>,
): Promise<T> {
  if (!uuid.test(context.actorId) || !uuid.test(context.workspaceId))
    throw new Error("Invalid workspace context");
  return db.begin(async (tx) => {
    await tx`SELECT set_config('app.actor_id', ${context.actorId}, true), set_config('app.workspace_id', ${context.workspaceId}, true)`;
    const memberships =
      await tx`SELECT role FROM workspace_memberships WHERE user_id = ${context.actorId} AND workspace_id = ${context.workspaceId} AND active = true`;
    if (memberships.length !== 1) throw new Error("WORKSPACE_ACCESS_DENIED");
    return action(tx);
  }) as Promise<T>;
}
