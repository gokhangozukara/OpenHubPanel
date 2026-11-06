# ADR-006: Initial implementation and preview boundary

Status: implemented foundation; full P0 remains incomplete.

## Decision

The repository and product name is **OpenHubPanel**. Use pinned pnpm workspaces, strict TypeScript, Next.js App Router, PostgreSQL, Biome, Vitest, and Playwright. Exact versions live in manifests/lockfile; installed license metadata is in `docs/dependency-licenses.json`.

Keep `/preview` limited to non-production with an explicit flag. It uses synthetic fixtures and returns 404 in production. Sample invitations, edits, members, and activity are not backend services.

Test real PostgreSQL through a separate application login without superuser/BYPASSRLS. The initial role reads scoped data and appends actor-bound audit; management writes wait for authenticated, audited use cases. Tests use pinned `embedded-postgres` in an isolated local process; production remains PostgreSQL. Container/Compose checks run in Linux CI because Docker is unavailable on the original development machine.

## Authentication candidate

Better Auth is a phase 3 candidate, not an accepted production integration. The initial evaluation recorded 1.7.18 and MIT. Its default scrypt requires an Argon2id adapter for our policy. Verify required MFA, pre-session isolation, atomic TOTP replay rejection, restricted recovery, and transactional audit in source/tests; plugin defaults are not proof.

If it cannot meet the contract, record a maintained replacement. Sources: [password configuration](https://better-auth.com/docs/authentication/email-password), [two-factor plugin](https://better-auth.com/docs/plugins/2fa). Recheck version/security status during implementation.

## Limits

Bootstrap, real password/TOTP sign-in, invitations/transfers, connectors, outbox, and real pilot are unimplemented. The shell is an initial phase 2 delivery, not a completed component/state catalog. Baseline CSP permits framework inline scripts; strict nonce CSP and required web-runtime secret validation must accompany real authentication.
