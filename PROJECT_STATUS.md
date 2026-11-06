# OpenHubPanel project status

Updated: 2026-11-06.

Repository: [gokhangozukara/OpenHubPanel](https://github.com/gokhangozukara/OpenHubPanel). **Private until the owner explicitly requests public visibility.**

## Current delivery

Initial implementation: pnpm monorepo, Next.js interface, synthetic preview, PostgreSQL RLS, shared security/contracts, and automated checks. Full P0 and production management are incomplete.

| Area                   | Status                                                                                                  |
| ---------------------- | ------------------------------------------------------------------------------------------------------- |
| Identity/license       | OpenHubPanel; MIT; Gokhan Gozukara                                                                      |
| Repository conventions | English names, code, comments, and documentation                                                        |
| Interface languages    | English, Turkish, German; shared catalogs, remembered selection                                         |
| Foundation             | Node 24, pnpm 12.18.0, strict TypeScript, six app/package workspaces, pinned lockfile                   |
| Database               | Separate application login, FORCE RLS, membership and append-only audit foundation                      |
| Infrastructure         | Pinned images, PostgreSQL/Redis Compose, safe health/protected readiness; minimal ping worker           |
| Interface              | Overview, search, workspace switch, team/activity/security examples, themes, mobile navigation, dialogs |
| Preview boundary       | Synthetic only; no external writes/invitations; production preview disabled, management API 503         |
| Real authentication    | Not implemented; ADR-006 candidate review is not acceptance                                             |
| Real management        | Not implemented; preview memberships/forms are not backend operations                                   |
| Connectors/outbox      | Initial schemas only; no external connection or remote write                                            |
| Release/pilot          | Incomplete; no live migration or VPS deployment                                                         |

## Verification evidence

The [foundation review](docs/research/foundation-review.md) passed 43 unit/tooling tests, 10 real PostgreSQL checks, and 13 Chromium E2E tests locally. DB checks cover application/RLS boundaries, workspace impersonation, transaction context, audit actor/foreign-key/rollback, and revoked membership. Browser checks include all three interface languages, persistence, browser-language fallback, blocked localStorage, unchanged typed data/workspace, and German mobile accessibility/layout. Type checks, lint, and production build are also verified before committing.

The prior [code CI run](https://github.com/gokhangozukara/OpenHubPanel/actions/runs/42248895932) passed checks/container jobs. It verified production preview 404 even with the flag, unauthorized readiness 404, healthy DB/Redis readiness 200, and Redis outage 503.

The license inventory records 105 installed package/version entries. Gitleaks scans source/history with one exact documented historical false positive for a deliberately invalid CI token. Results are point-in-time evidence, not security guarantees.

## Limits and next work

Helper/RLS/preview checks do not establish all 24 end-to-end threat scenarios. Real MFA/recovery, scoped management, invitation/transfer lifecycle, outbox, email, restored-state revocation, and pilot remain unverified. Strict nonce CSP and real authentication startup validation are required. Automated accessibility checks do not prove full WCAG conformance.

Next verify the authentication candidate, then bootstrap → password/TOTP → server session → scoped read → revocation/audit. Finish phase 2 component/state acceptance separately. Follow the [roadmap](docs/roadmap/implementation.md) and [implementation brief](docs/contributing/implementation-brief.md).

Our team is the intended first pilot. The owner reports more than ten apps; inventory is unreviewed. Responsive web comes first, PWA is a candidate, native distribution/naming remain open.

See [development](docs/DEVELOPMENT.md), [security](docs/architecture/security.md), [integrations](docs/architecture/integrations.md), and the [release checklist](docs/roadmap/release-checklist.md). Existing production services have not been changed.
