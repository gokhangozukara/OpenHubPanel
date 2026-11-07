# OpenHubPanel project status

Updated: 2026-11-07.

Repository: [gokhangozukara/OpenHubPanel](https://github.com/gokhangozukara/OpenHubPanel). **Private until the owner explicitly requests public visibility.**

## Current delivery

Initial implementation: pnpm monorepo, Next.js interface, synthetic preview, PostgreSQL RLS, shared security/contracts, and automated checks. Full P0 and production management are incomplete.

The owner's explicitly requested first live installation now has a separate [single-owner adapter](docs/deployment/owner-installation.md): Argon2id password plus required TOTP, opaque revocable sessions, restricted recovery/manual re-enrollment, native forms for six configuration sections, version preconditions, per-save step-up, persistent idempotency, transactional host audit and encrypted identity backup/restore. It reads real application metadata through a narrow host connector. Specialized push/music/Studio tools retain their existing interfaces and authentication. This is a single-instance compatibility delivery, not the general multi-client P0. The owner's interactive activation is separate from automated fixture enrollment.

| Area                   | Status                                                                                                                 |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Identity/license       | OpenHubPanel; MIT; Gokhan Gozukara                                                                                     |
| Repository conventions | English names, code, comments, and documentation                                                                       |
| Interface languages    | English, Turkish, German; shared catalogs, remembered selection                                                        |
| Foundation             | Node 24, pnpm 12.18.0, strict TypeScript, six app/package workspaces, pinned lockfile                                  |
| Database               | Separate application login, FORCE RLS, membership and append-only audit foundation                                     |
| Infrastructure         | Pinned images, PostgreSQL/Redis Compose, safe health/protected readiness; minimal ping worker                          |
| Interface              | Compact workspace, grouped/collapsible sidebar, scoped keyboard search, application shortcuts/filters, three languages |
| Preview boundary       | Synthetic only; no external writes/invitations; production preview disabled, management API 503                        |
| Real authentication    | Required password/TOTP and server sessions for the single-owner adapter; general multi-client identity is incomplete   |
| Real management        | Six native owner configuration sections; general workspace/member management remains preview-only                      |
| Connectors/outbox      | Compatible host adapter with audited writes and persistent intents; general connector contract is incomplete           |
| Release/pilot          | Single-owner installation package verified; deployment/owner activation tracked separately from the general release    |

## Verification evidence

The [foundation review](docs/research/foundation-review.md) passed 43 unit/tooling tests, 10 real PostgreSQL checks, and 17 Chromium E2E tests locally. DB checks cover application/RLS boundaries, workspace impersonation, transaction context, audit actor/foreign-key/rollback, and revoked membership. Browser checks include all three interface languages, persistence, browser-language fallback, blocked localStorage, unchanged typed data/workspace, and German mobile accessibility/layout. Type checks, lint, and production build are also verified before committing.

The prior [code CI run](https://github.com/gokhangozukara/OpenHubPanel/actions/runs/42284627767) passed checks/container jobs. It verified production preview 404 even with the flag, unauthorized readiness 404, healthy DB/Redis readiness 200, and Redis outage 503.

The license inventory records installed package/version entries. Gitleaks scans source/history with one exact documented historical false positive for a deliberately invalid CI token. Results are point-in-time evidence, not security guarantees.

The [workspace redesign](docs/design/workspace-review.md) replaces promotional dashboard cards with task-focused navigation and connection follow-up. The updated screenshot uses synthetic data only.

## Limits and next work

Helper/RLS/preview checks do not establish all 24 end-to-end threat scenarios. Real MFA/recovery, scoped management, invitation/transfer lifecycle, outbox, email, restored-state revocation, and pilot remain unverified. Nonce CSP now passes four standalone-production browser checks. Real authentication startup validation remains required. Automated accessibility checks do not prove full WCAG conformance.

The [authentication candidate review](docs/research/authentication-candidate-review.md) identifies required lifecycle adaptations; default plugin behavior is not accepted. Next prove or replace the candidate integration, then bootstrap → password/TOTP → server session → scoped read → revocation/audit. Finish phase 2 component/state acceptance separately. Follow the [roadmap](docs/roadmap/implementation.md) and [implementation brief](docs/contributing/implementation-brief.md).

Our team is the intended first pilot. The current installation contains 13 application records; mobile-client support remains application-specific. Responsive web comes first, PWA is a candidate, native distribution/naming remain open.

The [operator compatibility pilot](docs/deployment/operator-pilot.md) now reads the existing installation's 13 real applications, checks their configuration APIs, and opens their existing management pages. A Linux standalone artifact was built in WSL on the maintainer's laptop. Live checks passed for all 13 APIs, authenticated catalog access, forged/absent-session rejection, mobile layout, and language changes. Six existing setting sections were saved/read back using one temporary record; it was removed, and all 13 real configuration fingerprints remained unchanged. This is not full native management or proof of mobile-client behavior. Private deployment paths and evidence remain outside Git.

See [development](docs/DEVELOPMENT.md), [security](docs/architecture/security.md), [integrations](docs/architecture/integrations.md), and the [release checklist](docs/roadmap/release-checklist.md). The pilot runs alongside the existing production service; the original editors and mobile APIs remain in place.
