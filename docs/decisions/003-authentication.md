# ADR-003: Authentication foundation

Status: accepted with clarifications in [ADR-004](004-security-review.md).

Use server-side sessions, Argon2id passwords, TOTP authenticator support, recovery codes, and audit. Browser sessions use secure HttpOnly cookies; do not store bearer JWTs in localStorage.

The original plan included email/SMS and later Google OIDC/passkeys. ADR-004 clarifies that email/SMS verify addresses or deliver notifications, never replace required TOTP. Recovery grants only factor enrollment, and sensitive operations need step-up before P0 management ships.

Use the current [security design](../architecture/security.md) for exact lifecycle/limits. This decision is a requirement, not evidence of an implemented authentication service.
