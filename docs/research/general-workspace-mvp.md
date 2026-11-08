# General workspace MVP acceptance evidence

Recorded: 2026-11-08. Scope: `feat/general-workspace-mvp`, local synthetic fixtures only. No VPS connection, deployment, production data change or Firebase delivery was performed.

This checklist measures the requested MVP acceptance, not overall product maturity or independent security certification.

## Evidence sources

- [Identity integration](../../apps/web/src/server/general/auth.integration.ts): real restricted-login PostgreSQL bootstrap races, password/MFA separation, browser binding, cross-challenge TOTP replay rejection, revocation/expiry, restricted recovery, audit rollback and shared counters.
- [Workspace integration](../../apps/web/src/server/general/workspaces.integration.ts): real accounts, two workspaces, four roles, forged IDs, invitations, current inviter authority, removed memberships, ownership acceptance and atomic audit.
- [Connection integration](../../apps/web/src/server/general/connections.integration.ts): real PostgreSQL with controlled transport; encrypted credentials, scope binding, read-only defaults, revision/idempotency/conflict, uncertain results, reflected-secret rejection, post-intent revocation and audit-before-dispatch.
- [Independent HTTP integration](../../apps/web/src/server/general/http.integration.ts): separate real content process, verified HTTPS socket, independent SQLite/audit inspection, replay/conflict, lost-reply GET reconciliation and stopped service. See the [LOOP-2 matrix](loop-2-release-gate.md) for the explicit test-only transport boundary.
- [Production browser fixture](../../scripts/test-general-browser.ts): isolated PostgreSQL, real migration/bootstrap CLIs, restricted web login, standalone Next production artifact and local HTTPS. Twenty-five scenarios cover setup/TOTP, two workspaces, real independent HTTPS title forms, idempotency/reconciliation, failed/disabled connections, invitation lifecycle, genuine offline/expiry/role/removal errors, four scoped response races, malformed responses, duplicate guards, four-width state/accessibility checks, Tab/Enter/paste sign-in and revocation.
- [Password provider tests](../../apps/web/src/server/general/auth.test.ts): prefix privacy, breach rejection, padding and fail-closed errors. Browser tests preload a deterministic range response in the test process only. Production has no environment-based password-check bypass.

## Requested checklist

| #   | Criterion                            | Result and evidence                                                                                                                                                                                             |
| --- | ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1*  | One-use secure first setup           | Pass: actual CLI in browser fixture, concurrent bootstrap accepts exactly one account; expiry/hash/closure enforced                                                                                             |
| 2*  | Multi-user password sign-in          | Pass: Argon2id for first/invited users; browser accepts six characters and still requires MFA                                                                                                                   |
| 3*  | Mandatory TOTP/replay protection     | Pass: no management before verified factor; concurrent challenges accept one factor step                                                                                                                        |
| 4*  | Session revocation/expiry            | Pass: next-request revocation, idle/absolute expiry and restored revoked-cookie rejection                                                                                                                       |
| 5*  | Restricted recovery                  | Pass: one-use recovery challenge cannot manage; replacement factor precedes new session/code set                                                                                                                |
| 6   | Create workspace                     | Pass: real UI and audited PostgreSQL creation                                                                                                                                                                   |
| 7   | Safe switching                       | Pass: two real workspace/application views, membership checks, stale-data clearing and generation guards                                                                                                        |
| 8*  | Invitation creation/once acceptance  | Pass: owner/invitee browsers, concurrent acceptance, token hashes/current inviter authority                                                                                                                     |
| 9   | Cancel/expire/replace invitation     | Pass: real DB service rejects cancelled/replaced/expired links; UI displays expiry                                                                                                                              |
| 10* | Four roles enforced                  | Pass: central permission checks, direct RLS mutation rejection, delegation ceiling and scoped audit                                                                                                             |
| 11  | Change/remove member                 | Pass: DB role change/removal plus UI removal and rejection of old-page/API access                                                                                                                               |
| 12  | Last owner/ownership transfer        | Pass: last-owner trigger; owner offer/target TOTP acceptance, disabled-owner rejection and atomic role/audit changes                                                                                            |
| 13  | Workspace applications               | Pass: real creation UI, DB edit/archive, foreign application rejection                                                                                                                                          |
| 14* | Connection lifecycle/secret safety   | Pass: real UI/API/DB create, honest failed test, key erasure/disable/read denial; successful contract over independent HTTPS plus encryption/scope checks                                                       |
| 15  | Read-only reads                      | Pass: independent HTTPS/PG article list allowlist; writes blocked before separate approval                                                                                                                      |
| 16  | Complete real HTTP title-write trial | Pass: separate content process and real HTTPS from the production UI; SQLite title/version/audit, remote and panel audits, once-only replay, changed/stale conflicts, GET reconciliation and stopped-service UI |
| 17* | Atomic audit                         | Pass: audit failure rolls back workspace/application changes and prevents dispatch; web login cannot update/delete audit                                                                                        |
| 18* | Two-workspace leakage rejection      | Pass: real DB app/member/connection/operation/audit isolation, actor in both workspaces, disabled authority and forged browser requests                                                                         |
| 19  | Complete UI state acceptance         | Pass: LOOP-2 error/empty/loading/feedback matrix, real offline and scope races, login/enrollment/six authenticated screens, four widths, keyboard/paste/focus, translated live regions and axe AA               |
| 20* | All gates/docs/source boundary       | Pass: all eight required commands passed; source scan and full-history Gitleaks are clean                                                                                                                       |

`*` denotes a critical criterion. LOOP-1 recorded 18/20. LOOP-2 verified acceptance is **20/20 = 10/10 for the requested MVP gate**, with all critical criteria passing. This is not an overall product-maturity or independent accessibility/security certification. The [detailed LOOP-2 record](loop-2-release-gate.md) distinguishes actual network/database behavior from controlled presentation variants.

## Verification record

Final local gate run passed on 2026-11-08:

| Command         | Result                                                                                     |
| --------------- | ------------------------------------------------------------------------------------------ |
| Frozen install  | Lockfile unchanged; all seven workspaces installed                                         |
| typecheck       | Passed, including web route generation and tooling                                         |
| lint            | Passed; 195 files checked                                                                  |
| test            | 93 tests in 16 files passed                                                                |
| test:db         | 37 real PostgreSQL checks passed                                                           |
| test:e2e        | Production build, 17 preview tests and 25 general production browser scenarios passed      |
| test:production | Production build, four CSP/security tests and the same 25 general browser scenarios passed |
| scan:secrets    | 211 tracked source files passed                                                            |

Additional regressions passed: 17 existing-host owner production scenarios, six independent owner installation scenarios, and two independent Node/Python API contract checks. Owner browser fixtures used a test-process-only deterministic breach-provider response and synthetic delivery callbacks; no real devices or production accounts were touched. Both required browser gates ran the full general suite successfully. LOOP-2 desktop/mobile unavailable-state and field-error screenshots were visually inspected; long-name and 320/390/768/1280px reflow checks passed. Login and enrollment include normal/error axe checks at every width.

Dependency audit reported no known vulnerabilities. Gitleaks 8.30.0 scanned the full local Git history with redaction and found no leaks. All 45 local file links across the seven updated guides/status pages resolved. GitHub CI is a separate remote check; no CI result is inferred from these local results.

Required commands, from the repository root:

```sh
npx --yes pnpm@12.18.0 install --frozen-lockfile
npx --yes pnpm@12.18.0 typecheck
npx --yes pnpm@12.18.0 lint
npx --yes pnpm@12.18.0 test
npx --yes pnpm@12.18.0 test:db
npx --yes pnpm@12.18.0 test:e2e
npx --yes pnpm@12.18.0 test:production
npx --yes pnpm@12.18.0 scan:secrets
```

Both browser gates run the general fixture. Real TOTP steps can require waiting for the next 30-second code. Synthetic secrets/database/certificate files stay under ignored `.local/` paths. The source scan is distinct from full-history Gitleaks.

The [setup guide](../deployment/general-workspaces.md) covers role separation, invitation delivery, credential handling and supervised recovery. General restore/key rotation, measured load/retention operations, background outbox processing, email and external setup trials remain release work. Owner deployment evidence is not substituted for those checks.
