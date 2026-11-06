# Implementation brief

Continue from actual [project status](../../PROJECT_STATUS.md). The monorepo, initial database boundaries, and synthetic interface exist. Real authentication and management do not.

Next: CLI bootstrap → password/required TOTP → opaque server session → authorized workspace read → revocation/audit. First verify the authentication candidate against the [security contract](../architecture/security.md); defaults are not acceptance evidence.

Keep English names, code, comments, and documentation. Use English/Turkish/German catalogs for visible copy and preserve workspace/typed content on language changes. Keep the repository private until the owner's explicit request.

Follow the [roadmap](../roadmap/implementation.md). Build identity/scoped management before broad plugins. P0 includes client isolation, two independent read examples, and one real audited write. HubStag/SwzHub are optional pilot targets.

Use maintained crypto/protocol libraries, installed framework docs, synthetic data, and meaningful failure/race tests. Report results and limits. Do not connect production credentials, change a VPS, migrate data, or disable the old panel without explicit authorization for that operation.
