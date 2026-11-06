// Synthetic data for /preview only. No production service reads these fixtures.
export const workspaces = [
  { id: "atlas", name: "Atlas Agency", initials: "AA", description: "Client projects and team" },
  { id: "ada", name: "Ada Design", initials: "AD", description: "A workspace for the design team" },
] as const;

export const applications = [
  {
    id: "content",
    workspace: "atlas",
    name: "Content Studio",
    category: "Website",
    description: "Articles, pages, and content management",
    initials: "CS",
    color: "teal",
    status: "connected",
    permission: "Read and edit",
    resources: 2,
    updated: "Just now",
  },
  {
    id: "support",
    workspace: "atlas",
    name: "Support Desk",
    category: "Application",
    description: "Customer requests and support tickets",
    initials: "SD",
    color: "blue",
    status: "connected",
    permission: "Read only",
    resources: 1,
    updated: "2 min ago",
  },
  {
    id: "portfolio",
    workspace: "atlas",
    name: "Portfolio",
    category: "Website",
    description: "A showcase of projects and published work",
    initials: "P",
    color: "amber",
    status: "pending",
    permission: "Awaiting connection",
    resources: 0,
    updated: "Not connected yet",
  },
  {
    id: "design",
    workspace: "ada",
    name: "Design Journal",
    category: "Website",
    description: "Design notes and publishing",
    initials: "DJ",
    color: "teal",
    status: "connected",
    permission: "Read only",
    resources: 1,
    updated: "5 min ago",
  },
] as const;
export type PreviewApplication = (typeof applications)[number];

export const members = [
  {
    workspace: "atlas",
    name: "Demo Admin",
    initials: "DA",
    email: "admin@example.test",
    role: "Workspace owner",
    color: "teal",
  },
  {
    workspace: "atlas",
    name: "Deniz Kaya",
    initials: "DK",
    email: "deniz@example.test",
    role: "Admin",
    color: "blue",
  },
  {
    workspace: "atlas",
    name: "Ece Yilmaz",
    initials: "EY",
    email: "ece@example.test",
    role: "Editor",
    color: "amber",
  },
  {
    workspace: "ada",
    name: "Demo Admin",
    initials: "DA",
    email: "admin@example.test",
    role: "Viewer",
    color: "teal",
  },
] as const;

export const activities = [
  {
    workspace: "atlas",
    title: "Article title updated",
    detail: "Deniz Kaya · Content Studio",
    time: "5 min ago",
    type: "edit",
  },
  {
    workspace: "atlas",
    title: "Ece joined the team",
    detail: "Accepted an invitation as an editor",
    time: "24 min ago",
    type: "member",
  },
  {
    workspace: "atlas",
    title: "Support Desk connected",
    detail: "Read-only access enabled",
    time: "1 hr ago",
    type: "app",
  },
  {
    workspace: "ada",
    title: "Sample workspace created",
    detail: "Design Journal · Read only",
    time: "5 min ago",
    type: "app",
  },
] as const;
