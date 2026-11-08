# Implementation roadmap

A phase is complete only when acceptance has evidence. This describes the target product; [project status](../../PROJECT_STATUS.md) records delivery. Foundation/preview do not complete P0.

The general workspace MVP now implements the core authentication, workspace management and scoped connector paths on its feature branch. Its [acceptance record](../research/general-workspace-mvp.md) separates verified PostgreSQL/browser behavior from remaining complete HTTP-write, UI-state and operational release acceptance. This does not mark every phase below complete.

| Phase                 | Scope                                                                                           | Acceptance                                                                                                                                       |
| --------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1 · Foundation        | Pinned monorepo, strict TypeScript, CI, DB/RLS, config, licenses, auth-library evaluation       | Repeatable setup/build, real DB boundaries, separate roles, safe health/readiness, secret scans                                                  |
| 2 · Interface         | Original components/navigation, responsive layouts, themes, three languages, interaction states | Keyboard/mobile, no stale cross-workspace display, translated screens/notices/errors, persisted language, component catalog                      |
| 3 · Authentication    | CLI bootstrap, password/TOTP, restricted/manual recovery, sessions/revocation, limits, step-up  | No access before MFA, atomic replay guards, safe bootstrap races, no MFA bypass through recovery/outages                                         |
| 4 · Management        | Workspaces/members/invitations/transfers, users/roles, applications/credentials, settings/audit | Server/object scope, no indirect escalation, last-owner/admin guards, next-request revocation, mutation/audit atomicity, two-client isolation    |
| 6A · Read integration | Versioned HTTP/JSON, safe adapter, two independent examples, developer guide                    | Both connect without core changes; health/list/detail, scoped identity, SSRF/DNS/redirect/timeout/size controls                                  |
| 6B · First write      | Article title update, optimistic concurrency, outbox, idempotency, reconciliation               | Actual update once; stale writes conflict; unknown timeout not success; revoked authority stops jobs; scoped step-up/audit                       |
| 8 · Release gate      | Security/accessibility/load, scans, restore/rollback, docs, pilot                               | Applicable threat cases pass, no open critical/high findings, measured restore/upgrade recovery, export/deletion procedure, external setup trial |

## P1 work

Phase 5 adds global search, command palette, favorites, recent items, quick actions, and useful widgets. Results obey current permissions; document shortcuts and retain mobile usability.

Phase 6C adds product connectors, including possible HubStag/SwzHub integrations, after the contract works. Phase 7 adds selected SMS notification/verification, Google OIDC, common-provider SSO, passkeys, device/risk controls, and backup interfaces. Required TOTP, recovery, revocation, and step-up are already P0.

Every later release repeats relevant phase 8 checks. P1 features need not ship together.

## Dependency order

```text
1 -> 2 and 3
2 + 3 -> 4
4 -> 6A -> 6B
4 + 6B -> 8 (first usable release)
4 -> 5 (P1)
6B -> 6C (P1)
3 + 4 -> 7 (P1)
selected later work -> relevant phase 8 checks
```

## Release evidence

Record commands/results, scan dates, dependency/container findings, supported versions, measured resource needs, migration failures, and rollback limits. Test encrypted restore with separately stored keys; do not revive old sessions/recovery state.

The example visitor flow must continue when OpenHubPanel is down; target data needs its own backup. Export excludes secrets and other clients. Pilot with our team, then an external developer using the docs. A first read-only connection within 30 minutes is an unmeasured target, not a claimed result.
