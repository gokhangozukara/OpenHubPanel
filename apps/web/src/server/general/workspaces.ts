import { randomUUID } from "node:crypto";
import { roleSchema, workspaceIdSchema } from "@openhubpanel/contracts";
import type { Database, Transaction } from "@openhubpanel/db";
import { canAssignRole, hasPermission } from "@openhubpanel/security";
import { generalAuth, type Identity } from "./auth";
import { digest, token } from "./crypto";

export const text = (value: unknown, max = 100) => {
  if (typeof value !== "string" || !value.trim() || value.trim().length > max)
    throw new Error("INVALID_INPUT");
  return value.trim();
};
export async function audit(
  tx: Transaction,
  identity: Identity,
  workspaceId: string,
  action: string,
  target: string,
  changes: Record<string, string | boolean> = {},
) {
  await tx`INSERT INTO audit_events(workspace_id,id,actor_id,action,target_id,changes)
    VALUES(${workspaceId},${randomUUID()},${identity.userId},${action},${target},${tx.json(changes)})`;
}
export function generalWorkspaces(db: Database, key: string) {
  const auth = generalAuth(db, key);
  async function scoped<T>(
    session: string,
    workspace: string,
    permission: string,
    action: (tx: Transaction, identity: Identity, role: string) => Promise<T>,
  ) {
    const id = workspaceIdSchema.parse(workspace);
    return auth.within(session, async (tx, identity) => {
      await tx`SELECT set_config('app.workspace_id',${id},true)`;
      // Shared workspace lock serializes membership changes and permission checks.
      await tx`SELECT lock_workspace(${id})`;
      const members =
        await tx`SELECT role FROM workspace_memberships WHERE workspace_id=${id} AND user_id=${identity.userId} AND active`;
      const role = String(members[0]?.role ?? "");
      if (!hasPermission(role, permission)) throw new Error("FORBIDDEN");
      return action(tx, identity, role);
    });
  }
  return {
    scoped,
    async list(session: string) {
      return auth.within(session, async (tx) => {
        const rows = await tx`SELECT * FROM list_own_workspaces()`;
        return rows.map((row) => ({ id: String(row.id), name: String(row.name), role: String(row.role) }));
      });
    },
    async create(session: string, name: string) {
      const title = text(name);
      return auth.within(session, async (tx) => {
        const id = randomUUID();
        await tx`SELECT create_workspace(${id},${title})`;
        return { id, name: title, role: "owner" };
      });
    },
    async snapshot(session: string, workspace: string) {
      return scoped(session, workspace, "workspace.read", async (tx, identity, role) => {
        const applications =
          await tx`SELECT id,name,connector_id,panel_url,archived FROM applications WHERE workspace_id=${workspace} ORDER BY created_at,id`;
        const members = hasPermission(role, "members.read")
          ? await tx`SELECT * FROM workspace_member_identities(${workspace})`
          : [];
        const invitations = hasPermission(role, "members.manage")
          ? await tx`SELECT id,email,role,expires_at,cancelled,accepted FROM workspace_invitations WHERE workspace_id=${workspace} ORDER BY created_at DESC LIMIT 100`
          : [];
        const events = hasPermission(role, "audit.read")
          ? await tx`SELECT id,actor_id,action,target_id,outcome,changes,created_at FROM audit_events WHERE workspace_id=${workspace} ORDER BY created_at DESC LIMIT 100`
          : [];
        const offers =
          await tx`SELECT owner_id,target_id,expires_at FROM ownership_transfers WHERE workspace_id=${workspace} AND NOT accepted AND expires_at>now()`;
        return {
          userId: identity.userId,
          workspaceId: workspace,
          role,
          applications: [...applications],
          members: [...members],
          invitations: [...invitations],
          events: [...events],
          ownershipOffer: offers[0]
            ? {
                ownerId: String(offers[0].owner_id),
                targetId: String(offers[0].target_id),
                expiresAt: String(offers[0].expires_at),
              }
            : null,
        };
      });
    },
    async member(
      session: string,
      workspace: string,
      user: string,
      role: string,
      active: boolean,
      code: string,
    ) {
      workspaceIdSchema.parse(user);
      roleSchema.parse(role);
      return scoped(session, workspace, "members.manage", async (tx, identity, actorRole) => {
        await auth.stepUp(tx, identity, code);
        const members =
          await tx`SELECT role FROM workspace_memberships WHERE workspace_id=${workspace} AND user_id=${user} AND active`;
        const previous = String(members[0]?.role ?? "");
        if (!previous || !canAssignRole(actorRole, previous) || !canAssignRole(actorRole, role))
          throw new Error("FORBIDDEN");
        // Ownership is offered and explicitly accepted through the transfer flow.
        if (role === "owner" && previous !== "owner") throw new Error("TRANSFER_REQUIRED");
        await tx`UPDATE workspace_memberships SET role=${role},active=${active} WHERE workspace_id=${workspace} AND user_id=${user}`;
        await audit(tx, identity, workspace, active ? "member.role_changed" : "member.removed", user, {
          role,
          active,
        });
      });
    },
    async invite(
      session: string,
      workspace: string,
      email: string,
      role: string,
      code: string,
      previous?: string,
    ) {
      const address = auth.emailAddress(email);
      roleSchema.parse(role);
      if (previous) workspaceIdSchema.parse(previous);
      return scoped(session, workspace, "members.manage", async (tx, identity, actorRole) => {
        if (role === "owner" || !canAssignRole(actorRole, role)) throw new Error("FORBIDDEN");
        await auth.stepUp(tx, identity, code);
        if (previous) {
          const rows =
            await tx`UPDATE workspace_invitations SET cancelled=true,inviter_id=${identity.userId} WHERE workspace_id=${workspace} AND id=${previous} AND email=${address} AND NOT accepted RETURNING id`;
          if (!rows.length) throw new Error("NOT_FOUND");
        }
        const raw = token();
        const id = randomUUID();
        await tx`INSERT INTO workspace_invitations(workspace_id,id,email,role,inviter_id,token_hash)
          VALUES(${workspace},${id},${address},${role},${identity.userId},${digest(raw)})`;
        await audit(tx, identity, workspace, previous ? "invitation.resent" : "invitation.created", id, {
          role,
        });
        return { id, token: raw, delivery: "copy-link" };
      });
    },
    async cancelInvite(session: string, workspace: string, id: string, code: string) {
      workspaceIdSchema.parse(id);
      return scoped(session, workspace, "members.manage", async (tx, identity, actorRole) => {
        await auth.stepUp(tx, identity, code);
        const invitation =
          await tx`SELECT role FROM workspace_invitations WHERE workspace_id=${workspace} AND id=${id} AND NOT accepted`;
        if (!invitation[0] || !canAssignRole(actorRole, String(invitation[0].role)))
          throw new Error("FORBIDDEN");
        await tx`UPDATE workspace_invitations SET cancelled=true,inviter_id=${identity.userId} WHERE workspace_id=${workspace} AND id=${id}`;
        await audit(tx, identity, workspace, "invitation.cancelled", id);
      });
    },
    async accept(session: string, proof: string) {
      return auth.within(session, async (tx) => {
        const rows = await tx`SELECT accept_invitation(${digest(proof)}) AS id`;
        return { id: String(rows[0]?.id) };
      });
    },
    async transfer(session: string, workspace: string, target: string, code: string) {
      workspaceIdSchema.parse(target);
      return scoped(session, workspace, "workspace.manage", async (tx, identity) => {
        await auth.stepUp(tx, identity, code);
        const members =
          await tx`SELECT user_id FROM workspace_memberships WHERE workspace_id=${workspace} AND user_id=${target} AND active`;
        if (!members.length || target === identity.userId) throw new Error("INVALID_TRANSFER");
        await tx`INSERT INTO ownership_transfers(workspace_id,owner_id,target_id) VALUES(${workspace},${identity.userId},${target})
          ON CONFLICT(workspace_id) DO UPDATE SET owner_id=excluded.owner_id,target_id=excluded.target_id,accepted=false,expires_at=now()+interval '24 hours'`;
        await audit(tx, identity, workspace, "ownership.offered", target);
      });
    },
    async acceptTransfer(session: string, workspace: string, code: string) {
      return scoped(session, workspace, "workspace.read", async (tx, identity) => {
        await auth.stepUp(tx, identity, code);
        await tx`SELECT accept_ownership(${workspace})`;
      });
    },
    async application(
      session: string,
      workspace: string,
      input: { id?: string; name: string; panelUrl?: string; archived?: boolean },
    ) {
      const title = text(input.name);
      const id = input.id ? workspaceIdSchema.parse(input.id) : randomUUID();
      let url: string | null = null;
      if (input.panelUrl) {
        const parsed = new URL(input.panelUrl);
        if (parsed.protocol !== "https:" || parsed.username || parsed.password)
          throw new Error("INVALID_INPUT");
        url = parsed.href;
      }
      return scoped(session, workspace, "apps.manage", async (tx, identity) => {
        if (input.id) {
          const rows =
            await tx`UPDATE applications SET name=${title},panel_url=${url},archived=${Boolean(input.archived)} WHERE workspace_id=${workspace} AND id=${id} RETURNING id`;
          if (!rows.length) throw new Error("NOT_FOUND");
        } else {
          await tx`INSERT INTO applications(workspace_id,id,name,connector_id,panel_url) VALUES(${workspace},${id},${title},'http',${url})`;
        }
        await audit(tx, identity, workspace, input.id ? "application.updated" : "application.created", id, {
          name: title,
          archived: Boolean(input.archived),
        });
        return { id };
      });
    },
  };
}
