import { z } from "zod";

export const workspaceIdSchema = z.uuid();
export const roleSchema = z.enum(["owner", "admin", "editor", "viewer"]);
export type WorkspaceRole = z.infer<typeof roleSchema>;

export const permissionSchema = z.enum([
  "workspace.read",
  "workspace.manage",
  "members.read",
  "members.manage",
  "apps.read",
  "apps.manage",
  "content.read",
  "content.write",
  "audit.read",
]);
export type Permission = z.infer<typeof permissionSchema>;

export const connectorManifestSchema = z.strictObject({
  id: z.string().regex(/^[a-z][a-z0-9-]{1,63}$/),
  name: z.string().trim().min(1).max(80),
  contractVersion: z.literal("1.0"),
  resources: z
    .array(
      z.strictObject({
        id: z.string().regex(/^[a-z][a-z0-9-]{1,63}$/),
        name: z.string().trim().min(1).max(80),
        capabilities: z
          .array(z.enum(["list", "read", "update"]))
          .min(1)
          .max(3)
          .refine((items) => new Set(items).size === items.length, "Capabilities must be unique"),
      }),
    )
    .min(1)
    .max(20)
    .refine(
      (items) => new Set(items.map((item) => item.id)).size === items.length,
      "Resource IDs must be unique",
    ),
});
export type ConnectorManifest = z.infer<typeof connectorManifestSchema>;

export const articleUpdateSchema = z.strictObject({
  title: z.string().trim().min(1).max(180),
  status: z.string().trim().min(1).max(50).optional(),
  expectedVersion: z.number().int().positive(),
  idempotencyKey: z.uuid(),
});
export const resourceRecordUpdateSchema = articleUpdateSchema;
export type ResourceRecordUpdate = z.infer<typeof resourceRecordUpdateSchema>;

export const errorResponseSchema = z.strictObject({
  error: z.strictObject({ code: z.string(), message: z.string(), requestId: z.uuid() }),
});
