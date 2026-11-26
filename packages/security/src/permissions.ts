const grants = {
  owner: [
    "workspace.read",
    "workspace.manage",
    "members.read",
    "members.manage",
    "apps.read",
    "apps.manage",
    "content.read",
    "content.write",
    "audit.read",
  ],
  admin: [
    "workspace.read",
    "members.read",
    "members.manage",
    "apps.read",
    "apps.manage",
    "content.read",
    "content.write",
    "audit.read",
  ],
  editor: ["workspace.read", "apps.read", "content.read", "content.write"],
  viewer: ["workspace.read", "apps.read", "content.read"],
} as const;

export function hasPermission(role: string, permission: string): boolean {
  if (!Object.hasOwn(grants, role)) return false;
  return (grants[role as keyof typeof grants] as readonly string[]).includes(permission);
}

export function canAssignRole(actorRole: string, targetRole: string): boolean {
  if (!Object.hasOwn(grants, targetRole)) return false;
  if (actorRole === "owner") return true;
  return actorRole === "admin" && (targetRole === "editor" || targetRole === "viewer");
}
