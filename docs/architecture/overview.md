# Architecture

OpenHubPanel starts as a **modular monolith**, with clear boundaries and a separate worker process. This keeps development, testing, and deployment manageable without premature microservices.

## Technology and repository structure

The current foundation uses pnpm, strict TypeScript, Next.js App Router, PostgreSQL with the postgres driver and reviewed SQL migrations, Redis/BullMQ, Zod, Biome, Vitest, and Playwright. Dependencies are pinned in manifests/lockfile. Styling uses original CSS tokens and components. Structured logging is the starting point for future OpenTelemetry-compatible observability.

```text
apps/
  web/                    # Interface and server routes
  worker/                 # Background process; currently a ping skeleton
packages/
  contracts/              # API/manifest schemas
  db/                     # Database, migrations, transaction boundaries
  observability/          # Redacted structured logging
  security/               # Shared security helpers
infra/
  docker/                 # Container and development infrastructure
docs/
  architecture/
  contributing/
  decisions/
  design/
  product/
  research/
  roadmap/
```

Future example services, connector adapters, shared UI/config packages, reverse proxy, and backup tooling are added when implemented. This tree distinguishes existing code from the larger target design.

## Layers and contracts

Routes/UI handle transport and interaction; domain rules decide business invariants and permissions; application use cases own transactions; infrastructure adapters own database, email, HTTP, and storage access. Screens do not call external services directly. Routes do not embed business SQL.

Version APIs under `/api/v1`, validate inputs/outputs with schemas, use consistent safe errors and request IDs, bounded cursor pagination, explicit idempotency requirements, and server authorization on every operation. The current management endpoint intentionally returns 503.

An application manifest declares identity, contract version, resources, navigation, capabilities, and required permissions. It is reviewed static data, not executable code or an arbitrary URL/secret carrier. Capability declarations and filtered navigation do not grant authority. See [integrations](integrations.md).

## Data and scope

The target model covers global users/credentials/factors/recovery, sessions/devices/challenges, workspaces/memberships, roles/permissions, applications/connections/encrypted credentials, invitations, settings, notifications, audit/security events, scoped idempotency, and outbox jobs. Not all tables exist yet.

Tenant rows carry `workspace_id`; relationships use composite constraints to keep related rows in the same workspace. Identity and membership are separate. PostgreSQL RLS supplements server authorization. Missing tenant context denies access; application/worker roles cannot own or bypass scoped tables. Use transaction-local context and test pool reuse.

Store timestamps in UTC and format for the user's locale when presenting actual dates. Include workspace/application in cache, cursor, storage, rate-limit, idempotency, audit, and queue scope. Prevent late responses from a previous workspace from updating the new screen.

## Side effects

Local mutation and audit share a transaction. Remote changes require local intent/audit/outbox in one transaction, then a worker with current authorization and remote idempotency. Record results separately. Unknown timeouts need reconciliation, not an optimistic success notice. A service lacking idempotency cannot receive blind automatic write retries.

## Service boundary

Operator-controlled protocol/host/port/path allowlists cover every HTTP call, including health and media. Check DNS/resolved targets, disable automatic redirects, reject loopback/link-local/metadata addresses in production, and narrowly document necessary private-network exceptions. Add network egress rules, TLS verification, scoped per-service credentials, timeouts, response limits, concurrency limits, and bounded retries.

## Deployment target and quality gates

The first production target is one VPS with web, worker, PostgreSQL, Redis, and a reverse proxy, HTTPS, private infrastructure ports, separate database roles, encrypted backups, and alerts. Current Compose is development infrastructure, not a finished production deployment. Public health stays generic; detailed readiness is protected. Git/Docker exclude local research and secrets.

Require type/lint/build checks, meaningful critical-flow tests, migration/rollback plans, source/history secret scans, dependency/container checks, license inventory, minimal CI permissions, and SHA-pinned actions. External PRs get no deployment secrets. Verify authentication-library maintenance, advisories, licensing, and contract compatibility before integration. Use maintained crypto/protocol implementations.
