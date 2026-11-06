# Initial design review

Recorded 2026-11-06. Scope: local plans, architectural decisions, selected reference security flows, and source-release preparation. This is a design review, not a penetration test or certification.

## Findings and corrections

| Priority | Issue                                                                   | Resolution                                                                          |
| -------- | ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| High     | Email/SMS fallback could bypass required TOTP                           | Separate verification from sign-in; restricted recovery enrollment only             |
| High     | Sensitive management preceded step-up                                   | Build step-up in phase 3 and use it in phase 4                                      |
| High     | Bootstrap, complete factor loss, invitations, last-admin rules missing  | Single-use bootstrap, restricted/manual recovery, atomic administrator guards       |
| High     | Permission names lacked object/delegation boundaries                    | Resource/workspace/application scope and indirect escalation prevention             |
| High     | Service URLs lacked a trust boundary                                    | Static manifests, operator allowlists, scoped identity, SSRF/DNS/redirect controls  |
| High     | Remote writes appeared atomic with local audit                          | Outbox, idempotency, reconciliation                                                 |
| High     | Local research/deployment details could leak                            | Git/Docker exclusions and private operational findings                              |
| Medium   | Identity linking, replay races, pre-sessions, revocation underspecified | Explicit account linking, atomic consumption, pre-auth isolation, current authority |
| Medium   | Audit immutability/retention claims too broad                           | State operator boundary; include retention/restore in P0                            |
| Low      | Manifest ranges/counts conflated                                        | Separate locked versions and document recount scope                                 |

The original review proposed one organization, one read-only adapter, and later writes. [ADR-005](../decisions/005-admin-hub.md) supersedes that scope: P0 has client workspaces, two independent examples, and one real write. Use the current [roadmap](../roadmap/implementation.md).

## Evidence and limits

The references contained 794 files in total. Selected authentication, sessions, writes, audit, uploads, manifests, and lockfiles were read; not every line of every file. No reference code was copied. No live service was tested/deployed during the review. Missing source checks alone do not prove live exploitability.

Pattern checks did not identify a real private key, provider token, or credential-bearing URL in the checked patterns. Two secret-name matches were translation labels. This did not replace a full scanner/privacy review. Some address-like data was not verified as synthetic; all copies remain excluded. Images did not receive OCR/privacy review. Concrete findings remain in ignored notes. Scan actual source and history before sharing.

The initial review did not validate runtime OpenHubPanel security. Current implementation evidence belongs in [PROJECT_STATUS.md](../../PROJECT_STATUS.md).

## Follow-up

Verify the authentication library, email provider, manual recovery operator, retention acceptance, and backup responsibilities. MIT, owner/contact, and multi-workspace direction have since been chosen. The first vertical slice remains bootstrap → password/TOTP → server session → scoped read → revocation/audit.

[ADR-004](../decisions/004-security-review.md) records security corrections. The [threat model](../architecture/threat-model.md) expands 18 original scenarios to 24. Sources included OWASP MFA/Authorization/SSRF, NIST SP 800-63B-4, and OpenID Connect Core, linked from the security design.
