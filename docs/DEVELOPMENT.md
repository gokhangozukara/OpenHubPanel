# Developing OpenHubPanel

OpenHubPanel is an early implementation, not a production-ready administration system. The repository contains a working local design preview and a tested database/security foundation. Authentication and real management operations are not enabled yet.

## Start the local preview

Prerequisites: Git and Node.js 24 (tested with 24.18.0). No API key, cloud account, Docker, or production credentials are required for the preview.

```sh
git clone https://github.com/gokhangozukara/OpenHubPanel.git
cd OpenHubPanel
npx --yes pnpm@12.18.0 install --frozen-lockfile
npx --yes pnpm@12.18.0 dev
```

Open http://127.0.0.1:3000/preview. The development server binds only to loopback. The preview uses synthetic fixtures, has no authentication, sends no invitations, and makes no requests to your applications. Its editing controls change only browser memory. Never connect production data to it. The preview route returns 404 in production even if the preview environment flag is set.

The theme preference is the only value saved in localStorage. Workspace switching clears preview form state. Other screens demonstrate navigation, search, dialogs, membership views, and security states; they do not represent completed backend features.

## Validate changes

```sh
npx --yes pnpm@12.18.0 check
npx --yes pnpm@12.18.0 test:db
npx --yes pnpm@12.18.0 exec playwright install chromium
npx --yes pnpm@12.18.0 test:e2e
npx --yes pnpm@12.18.0 audit --prod --audit-level=high
```

`test:db` starts a real, isolated PostgreSQL 18.6 process on a randomly selected loopback port. It generates credentials in memory, migrates a separate database, tests RLS through the unprivileged application login, and stops the process. Its local data stays under ignored `.local/`; no existing database is touched. Native binaries are supplied by the pinned development dependency `embedded-postgres`. Do not run it as root; CI uses a normal runner user.

E2E starts an isolated Next.js development server on port 3100. Stop your OpenHubPanel dev server before running it: Next.js does not allow two dev servers for the same app output directory. Tests cover sample workspace switching, role-specific UI, search/empty state, dialog keyboard use, local-only editing, persisted theme, automated WCAG AA checks, mobile overflow, and safe health responses. Automated checks do not establish full WCAG conformance or production security.

## Optional local infrastructure

Install Docker separately if needed. Generate local secrets without printing them, then start PostgreSQL and Redis:

```sh
npx --yes pnpm@12.18.0 setup:local
npx --yes pnpm@12.18.0 infra:up
```

The script preserves an existing `.env`. Docker Compose reads the root `.env`, binds database ports to loopback, and initializes only a new volume. The migration operator and application login are separate; application tables use `FORCE ROW LEVEL SECURITY`. The application role has no management writes yet and cannot update/delete audit records. Authentication and audited use-cases must be implemented before granting additional writes.

`infra:down` stops containers and preserves their named volumes. Changing `.env` does not rotate existing PostgreSQL/Redis credentials. Plan credential changes and backups explicitly. There is intentionally no automatic data-destroying reset command.

Compose is development infrastructure. It is not a production deployment with TLS, backups, alerts, or a completed security review. The production container currently serves only the project page and safe status routes. `/api/v1` returns 503 instead of exposing an unprotected management API.

## Checks before publishing

```sh
npx --yes pnpm@12.18.0 scan:secrets
npx --yes pnpm@12.18.0 licenses:inventory
```

The source scanner checks tracked filenames and common credential formats; CI separately runs Gitleaks 8.30.0 over the full Git history with redacted output. Gitleaks release downloads are checksum verified. The license inventory records installed package metadata; original third-party LICENSE and NOTICE files remain authoritative.

The root `.gitignore` and `.dockerignore` exclude local reference panels, private deployment notes, runtime env files, local PostgreSQL data, test traces, and credentials. Publish only reviewed Git contents; never ZIP the entire research directory.
