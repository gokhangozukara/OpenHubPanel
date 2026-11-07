# OpenHubPanel project status

Updated: 2026-11-07.

Repository: [gokhangozukara/OpenHubPanel](https://github.com/gokhangozukara/OpenHubPanel). **Private until the owner explicitly requests public visibility.**

## Current delivery

Initial implementation: pnpm monorepo, Next.js interface, synthetic preview, PostgreSQL RLS, shared security/contracts, and automated checks. The general multi-client P0 is incomplete.

The owner's explicitly requested first live installation now has a separate [single-owner adapter](docs/deployment/owner-installation.md): Character selection, username and six-character-minimum Argon2id passwords, optional TOTP at every enabled sign-in, IP allowlists, opaque revocable sessions, restricted recovery/manual re-enrollment, native forms for six configuration sections and push delivery/history, version preconditions, per-save step-up, persistent idempotency, transactional host audit and encrypted identity backup/restore. It reads real application metadata through a narrow host connector. The owner has completed activation as the first live account. At the owner's request, the old panel links/templates/login have been removed from the running installation; native push replaces the old notification page. This is a single-instance compatibility delivery, not the general multi-client P0. Studio and specialized music workflows are not native features.

| Area                   | Status                                                                                                                                     |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Identity/license       | OpenHubPanel; MIT; Gokhan Gozukara                                                                                                         |
| Repository conventions | English names, code, comments, and documentation                                                                                           |
| Interface languages    | English, Turkish, German; shared catalogs, remembered selection                                                                            |
| Foundation             | Node 24, pnpm 12.18.0, strict TypeScript, six app/package workspaces, pinned lockfile                                                      |
| Database               | Separate application login, FORCE RLS, membership and append-only audit foundation                                                         |
| Infrastructure         | Pinned images, PostgreSQL/Redis Compose, safe health/protected readiness; minimal ping worker                                              |
| Interface              | Compact workspace, grouped/collapsible sidebar, scoped keyboard search, application shortcuts/filters, three languages                     |
| Preview boundary       | Synthetic only; no external writes/invitations; production preview disabled, management API 503                                            |
| Real authentication    | Character/password, optional TOTP, IP policy and server sessions for the single-owner adapter; general multi-client identity is incomplete |
| Real management        | Six native owner configuration sections; general workspace/member management remains preview-only                                          |
| Connectors/outbox      | Compatible host adapter with audited writes and persistent intents; general connector contract is incomplete                               |
| Release/pilot          | First live owner active; sign-in preferences and native push deployed; old panel removed from runtime                                      |

## Verification evidence

The onboarding update adds real application registration/details, a configuration-URL guide, API connections/panel shortcuts, independent empty storage and a trusted Linux setup tool. It passes 83 tests in 14 files, 17 existing-host production browser scenarios and six independent-storage browser scenarios. Two independent Node/Python API examples pass their local contract checks. HTTPS transport tests cover DNS/private-network rejection, address pinning, redirects and response limits; connection lifecycle tests cover encrypted secrets, read-only defaults, explicit writes and unknown-result reconciliation. The [source CI](https://github.com/gokhangozukara/OpenHubPanel/actions/runs/42420672360) passed and the laptop-built Linux package is deployed. Live registration/replay used one synthetic application, removed afterward; all 13 real configurations and mobile APIs were preserved. All 13 new public configuration relay URLs passed and exclude private fields. The Linux setup tool also passed in an isolated directory under the unprivileged service account: zero initial applications, no old host, successful independent runtime startup, private file modes and rejected key/account overwrite. The live owner was preserved. See [ADR-009](docs/decisions/009-owner-onboarding-and-connections.md) and the [standalone guide](docs/deployment/standalone-installation.md).

The current owner delivery passes 70 unit/integration tests and 16 standalone-production browser scenarios, including character-first sign-in, six-character activation, optional MFA, IP settings, authenticated native push, notification history and absence of old-panel navigation links. Push tests use a synthetic delivery callback: no real devices receive test messages. Duplicate sends, uncertain network outcomes and audit-failure-before-send are covered. Type checks, lint and production build pass. General multi-client threat acceptance remains separate.

The [native push source CI](https://github.com/gokhangozukara/OpenHubPanel/actions/runs/42416354081) passed. The laptop-built Linux release is deployed. Live checks verified native push status/history for all 13 applications, preserved all 13 mobile configuration APIs, unchanged real configuration fingerprints, retired old POST handlers, removed runtime templates and old-address redirects to native management. The owner's actual authenticated browser opened the former notification bookmark directly in the native composer, without old-panel links. A proxy `no-transform` directive prevents CDN email rewriting from breaking React hydration; the final live page opened without console errors.

The [foundation review](docs/research/foundation-review.md) passed 43 unit/tooling tests, 10 real PostgreSQL checks, and 17 Chromium E2E tests locally. DB checks cover application/RLS boundaries, workspace impersonation, transaction context, audit actor/foreign-key/rollback, and revoked membership. Browser checks include all three interface languages, persistence, browser-language fallback, blocked localStorage, unchanged typed data/workspace, and German mobile accessibility/layout. Type checks, lint, and production build are also verified before committing.

The prior [code CI run](https://github.com/gokhangozukara/OpenHubPanel/actions/runs/42284627767) passed checks/container jobs. It verified production preview 404 even with the flag, unauthorized readiness 404, healthy DB/Redis readiness 200, and Redis outage 503.

The license inventory records installed package/version entries. Gitleaks scans source/history with one exact documented historical false positive for a deliberately invalid CI token. Results are point-in-time evidence, not security guarantees.

The [workspace redesign](docs/design/workspace-review.md) replaces promotional dashboard cards with task-focused navigation and connection follow-up. The updated screenshot uses synthetic data only.

## Limits and next work

Helper/RLS/preview checks do not establish all 24 general multi-client end-to-end threat scenarios. General identity, workspace-scoped management, invitation/transfer lifecycle, distributed outbox and email remain incomplete. The separate owner adapter has its own verified MFA/recovery, native writes and restored-state revocation coverage above. Automated accessibility checks do not prove full WCAG conformance.

The [authentication candidate review](docs/research/authentication-candidate-review.md) identifies required lifecycle adaptations; default plugin behavior is not accepted. Next prove or replace the candidate integration, then bootstrap → password/TOTP → server session → scoped read → revocation/audit. Finish phase 2 component/state acceptance separately. Follow the [roadmap](docs/roadmap/implementation.md) and [implementation brief](docs/contributing/implementation-brief.md).

Our team is the intended first pilot. The current installation contains 13 application records; mobile-client support remains application-specific. Responsive web comes first, PWA is a candidate, native distribution/naming remain open.

The [operator compatibility pilot](docs/deployment/operator-pilot.md) now reads the existing installation's 13 real applications, checks their configuration APIs, and opens their existing management pages. A Linux standalone artifact was built in WSL on the maintainer's laptop. Live checks passed for all 13 APIs, authenticated catalog access, forged/absent-session rejection, mobile layout, and language changes. Six existing setting sections were saved/read back using one temporary record; it was removed, and all 13 real configuration fingerprints remained unchanged. This is not full native management or proof of mobile-client behavior. Private deployment paths and evidence remain outside Git.

See [development](docs/DEVELOPMENT.md), [security](docs/architecture/security.md), [integrations](docs/architecture/integrations.md), and the [release checklist](docs/roadmap/release-checklist.md). Native management has replaced the pilot and original panel; the existing host now supplies source data, Firebase integration and mobile APIs.
