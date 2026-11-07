# ADR-007: First owner live installation

Status: accepted for the owner's explicitly requested live installation, 2026-11-07.

The owner requested OpenHubPanel as the working interface of the existing installation, rather than another read-only preview. Deliver a single-operator compatibility deployment with native configuration forms. This does not complete the general product's workspace, invitation, or connector roadmap.

Use independent mandatory password/TOTP authentication and revocable opaque server sessions for native management. Existing host cookies cannot authorize native mutations. Operator-only, expiring, single-use bootstrap establishes the first account; never invent the owner's password or enroll a factor on their behalf. Initial enrollment and recovery completion require the owner's authenticator.

The single-instance adapter stores its identity, challenges, counters, sessions, recovery hashes, security events and remote intents in a separate local SQLite database. Synchronous immediate transactions serialize token consumption and TOTP replay guards across connections. This is an explicitly limited deployment adapter, not a replacement for the PostgreSQL/RLS and distributed Redis design of the general multi-workspace product. Do not enable additional operators or replicas with this adapter.

The existing application's connector owns writes to its database. Configuration updates use a version precondition, persistent idempotency and audit in the same transaction. OpenHubPanel records intent before submitting and reconciles unknown outcomes by the same request ID. Never write the catalog through a separately mounted SQLite filename. Public mobile configuration routes retain their URLs and formats.

The original editor remains a rollback path. Changes to real application settings, billing, push delivery or music content are not deployment smoke tests. Verify writes using a temporary synthetic application and remove that exact record.

Cut over the main interface after backup, local build, negative authentication tests and live checks. Keep the previous release and proxy configuration. Record the owner's interactive enrollment separately from automated verification.
