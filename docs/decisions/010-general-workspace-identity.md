# ADR-010: Separate general workspace identity and management

Status: accepted for the requested feature branch. Recorded: 2026-11-08.

The general product uses PostgreSQL identity tables in `hub_identity`, authenticated workspace services, `/api/general/*` and `/workspace`. It does not expand the single-owner SQLite `operator_user(id=1)` model. The owner's optional-MFA preference remains specific to `/live`; the general product requires password plus TOTP on every sign-in.

Use the installed maintained Argon2id and otplib implementations. Store opaque session/challenge/recovery/invitation token hashes, encrypted user-bound factors and workspace/connection-bound credentials. Recovery grants replacement-factor enrollment only. Verify TOTP steps atomically across all challenges and sensitive actions.

For this MVP, shared PostgreSQL rate counters replace the security design's proposed Redis dependency for general authentication. Counters commit independently before business transactions and fail closed on database failure. Authentication can therefore run with the same authoritative database across web processes, without a second rate-limit service. This does not change the separate owner adapter.

Reuse one browser-safe permission map in UI and server code. Enforce active sessions, active membership, role and object scope on the server and tenant RLS in PostgreSQL. A separate non-login `openhub_policy` role owns narrowly scoped SECURITY DEFINER helpers to avoid recursive membership policies and perform atomic audited workspace creation, invitation acceptance and ownership acceptance. It is not granted to the application login. Startup rejects privileged/inherited-privileged/table-owning application connections.

Sensitive requests submit a fresh TOTP code directly into the authorized transaction. The atomic step guard and mutation bind its acceptance to the current session/workspace/action/payload; no detached reusable step-up token is issued. Local mutations and audit share a transaction. Remote title changes use a durable scoped intent, a separate dispatch-authority check, remote idempotency and explicit unknown-result reconciliation. No background automatic retry worker is claimed.

Without email delivery, invitations are explicitly copyable one-use links. The fragment carries the invitation token so it is not sent as a document query string or referrer. Existing users authenticate normally; new invitees enroll before accepting membership. Mailbox verification, self-service password reset, external SSO and general-product restore acceptance remain separate release work.

See [setup and operations](../deployment/general-workspaces.md) and [evidence](../research/general-workspace-mvp.md).
