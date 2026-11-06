# ADR-004: Security review corrections

Status: accepted. Recorded 2026-11-06.

The planning review found contradictions that could weaken MFA, authorization, and audit. These rules supersede older ambiguous descriptions.

- TOTP is required for every P0 role. Email/SMS and password reset cannot replace/remove it. Password plus recovery code permits only restricted enrollment; management waits for verified replacement TOTP.
- Define CLI bootstrap, purpose-bound short-lived challenges, atomic replay/consumption, manual complete-factor-loss recovery, and last-active-administrator guards.
- Build step-up in phase 3 and use it in phase 4. Bind one-use proof to actor/session/scope/action/target/payload and consume transactionally with idempotency.
- Check current account/session authority and object/application scope on every protected server request. Prevent direct delegation and indirect role escalation.
- Use reviewed non-executable manifests, operator target allowlists, scoped service identities, and DNS/redirect/SSRF controls.
- Local mutation and audit commit together. Remote writes use intent/audit/outbox, idempotency, and reconciliation rather than claimed cross-service atomicity.
- State audit limits: application roles cannot edit/delete records, but database operators retain infrastructure authority. Include retention, private logging, encrypted backup, and restored-state revocation in P0.
- Exclude research, private findings, credentials, backups, and runtime files from Git/Docker; scan source and full history before release.

The original review narrowed P0 to one organization and a read-only adapter. [ADR-005](005-admin-hub.md) expands scope to client workspaces and a real write without relaxing security. The [security contract](../architecture/security.md) and [24 negative scenarios](../architecture/threat-model.md) define acceptance.
