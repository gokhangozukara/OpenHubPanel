# Threat model and security acceptance

Recorded 2026-11-06. This matrix is an implementation/test contract; it is not a statement that all scenarios have been implemented or passed.

## Assets, attackers, and boundaries

Protect administrator authority, sessions/factor secrets, service identities, user/customer data, audit, and backups. Boundaries include browser→web, web/worker→PostgreSQL/Redis, connector→remote API, application→notification providers, and CI→package/container registries.

Consider anonymous attackers, low-privilege accounts, another client's member/owner, stolen passwords/sessions, malicious uploads/responses, and compromised dependencies. Root/database-superuser compromise is a separate disaster-recovery boundary; application code cannot promise to prevent privileged infrastructure access.

## Negative acceptance matrix

| ID     | Scenario                                                                | Required result                                                              | Phase          |
| ------ | ----------------------------------------------------------------------- | ---------------------------------------------------------------------------- | -------------- |
| SEC-01 | Concurrent first-admin setup; expired/replayed invitation               | One bootstrap; reject invalid/reused tokens and client-selected roles        | 3              |
| SEC-02 | Correct password but incomplete MFA calls API/action                    | No management data/effects; pre-session only                                 | 3              |
| SEC-03 | Concurrent use of the same TOTP step or recovery code                   | At most one success; atomic database consumption                             | 3              |
| SEC-04 | Reset counters through new challenge/resend/device; Redis outage        | Aggregate account limits persist; verification fails closed                  | 3              |
| SEC-05 | Email/SMS/reset used to remove TOTP                                     | MFA remains required; recovery cannot call management                        | 3              |
| SEC-06 | Old cookie after logout/revocation/password/factor change               | Reject on next protected request                                             | 3–4            |
| SEC-07 | Replayed step-up or proof for another actor/action/target/payload       | Only the bound operation succeeds once                                       | 3–4            |
| SEC-08 | Other application/object/file IDs; direct action/search/export          | Reject server-side object scope; no data/effect leakage                      | 4, 6           |
| SEC-09 | Delegation/indirect role escalation; concurrent last-admin removal      | No escalation; preserve an active installation administrator                 | 4              |
| SEC-10 | Forged Origin/forwarded IP, absent CSRF, unsafe redirect                | No mutation; trust proxy headers only from approved proxies                  | 3–4            |
| SEC-11 | Database/audit failure and business rollback                            | No local mutation/success; failed security event survives                    | 3–4            |
| SEC-12 | Remote timeout/redelivery/revoked authority                             | Idempotent or reconciled result; no duplicate effect or unauthorized new job | 6B             |
| SEC-13 | Metadata/loopback/private target, DNS change, redirect                  | No destination outside allowlist; private exceptions explicit and narrow     | 6A             |
| SEC-14 | Forged MIME/extension, SVG/HTML, oversized/quota-exceeding upload       | Reject before storage; no unauthorized download                              | Before uploads |
| SEC-15 | Wrong OIDC issuer/audience/nonce, replay, same-email different identity | Reject callback or require explicit linking; no automatic merge              | 7              |
| SEC-16 | Secrets/cross-user data in logs, traces, queue errors, caches           | No secret disclosure or shared private response                              | 1–8            |
| SEC-17 | Restored backup revives sessions/recovery/factors                       | Apply revocation/re-enrollment runbook; test missing-key recovery            | 8              |
| SEC-18 | Research/env/backups included in Git or container context               | Block sharing; only placeholder `.env.example` is allowed                    | 0–8            |
| SEC-19 | Foreign workspace IDs/FKs, RLS owner/bypass, pooled stale context       | Reject; application role cannot bypass RLS or inherit tenant context         | 1–4            |
| SEC-20 | Late response after switching; cache/cursor/idempotency collision       | No previous-workspace display; scoped keys                                   | 2–6            |
| SEC-21 | Queued work/key use after membership/connection revocation              | Stop new work, revoke target key, reconcile started work                     | 4–6B           |
| SEC-22 | Workspace owner changes global account/other memberships                | No installation privilege; own workspace only                                | 4              |
| SEC-23 | Executable/HTML manifest, incompatible version, unapproved capability   | No execution/mutation; clear safe compatibility/permission error             | 6A–6B          |
| SEC-24 | Concurrent stale-version write; cross-workspace step-up                 | Conflict/permission rejection; no duplicate effect or scope bypass           | 6B             |

Test both success and rejection paths. A 401/403 alone is insufficient: verify database and remote effects did not occur. Use parallel requests against real PostgreSQL for races, controlled clocks for expiry, and synthetic data. Connector fault tests target controlled example services, not live systems.

Phase 1 establishes commands, CI, and dependency/license records. Authentication/authorization/audit/revocation become change gates in phases 3–4. Phase 8 records test reports, scan dates, restore/rollback evidence, and closure of critical/high findings. Existing helper/RLS/preview results are listed separately in [project status](../../PROJECT_STATUS.md).

References: [OWASP Authorization](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html), [OWASP MFA](https://cheatsheetseries.owasp.org/cheatsheets/Multifactor_Authentication_Cheat_Sheet.html), [OWASP SSRF](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html). Phase assignments and numerical limits are OpenHubPanel design decisions.
