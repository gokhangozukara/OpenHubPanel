# Working agreement

Use [AGENTS.md](../../AGENTS.md). Read [status](../../PROJECT_STATUS.md), [requirements](../product/requirements.md), [architecture](../architecture/overview.md), [security](../architecture/security.md), and [roadmap](../roadmap/implementation.md).

Use English for all names, code, comments, documentation, and GitHub content. Interface translations belong in English/Turkish/German catalogs. Keep the repository private until the owner explicitly opens it.

Deliver small, reviewable changes for a real problem. State what works, what remains planned, and what was tested. Never present synthetic forms, helper tests, or written policies as completed backend features.

Build independently of reference copies. Preserve dependency notices and exclusions. Keep live services/customer data out of development; source-code authorization does not authorize deployment/migration.

Verify phase acceptance and security failure paths. Use real PostgreSQL for RLS and transaction races. Protect every server operation. Local mutation/audit is atomic; remote writes follow the outbox contract.
