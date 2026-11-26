# Changelog

## v0.1.0

### Added

- **Multi-user workspaces (`/workspace`):** PostgreSQL-backed accounts with Argon2id passwords, mandatory TOTP enrollment, recovery codes, revocable server sessions, and opt-in 30-day trusted browsers (migration `0005`).
- **Workspace management & RBAC:** Scoped workspaces, four roles, team members, copyable invitation links, ownership transfer, and PostgreSQL row-level security (`FORCE RLS`).
- **Applications & encrypted API connections:** Workspace-scoped application registration, encrypted connection credentials, read-only defaults, durable write intents, version checks, idempotent reconciliation, and audited writes.
- **Interactive preview (`/preview`):** Zero-setup synthetic preview (disabled in production) with English, Turkish, and German interface catalogs and light/dark themes.
- **Security & CI gates:** Nonce-based CSP (`src/proxy.ts`), same-origin checks, SSRF/private-network protections, full Git-history Gitleaks scan, dependency audit, Vitest unit tests, real PostgreSQL RLS checks, and Playwright browser E2E tests.
