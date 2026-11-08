# Security design

This is an implementation contract, not a claim that these controls are complete. See [project status](../../PROJECT_STATUS.md), [ADR-004](../decisions/004-security-review.md), and the [threat model](threat-model.md).

## Identity assurance

The separate general product follows [ADR-010](../decisions/010-general-workspace-identity.md): password plus mandatory TOTP for every role, PostgreSQL identity and shared rate counters, restricted enrollment recovery and workspace-scoped management. The owner's optional-TOTP policy below applies to the `/live` compatibility adapter only. See [general acceptance evidence](../research/general-workspace-mvp.md) for implemented checks and remaining release work.

The owner-selected policy in [ADR-008](../decisions/008-owner-sign-in-preferences.md) uses a server-validated character gate before username/password. TOTP is optional; when enabled it is required on every sign-in without trusted-device skipping. Email verifies an address and carries notifications/recovery requests; SMS initially verifies a phone or carries notifications. Neither replaces TOTP, authorizes management, resets MFA, or supplies step-up. A provider failure never enables a weaker sign-in. Google Authenticator implements TOTP; Google sign-in is a separate future OIDC feature. TOTP is not phishing-resistant. Passkeys need a separate verified policy.

Login verifies the password, applies risk/limit checks, then verifies the enrolled factor. Until MFA completes, the user has only an opaque pre-session with no management access. Bind the challenge to user, browser pre-session, and purpose; store expiry, attempts, and consumption server-side. On success consume it and issue a new independent server-session token. Initial MFA challenge limits: 5 minutes and 5 attempts. Record successful and failed security steps.

## Passwords

Use maintained Argon2id with a unique salt. The initial minimum is `m=19456 KiB, t=2, p=1`; benchmark memory/concurrent-login load on the actual host and increase appropriately. Store parameters with the hash and rehash on successful login when policy changes. Plain SHA-256 is not password storage.

Require at least 6 characters, accept at least 64, and never silently truncate. Support password managers and paste; do not require arbitrary character mixtures or periodic changes. Check common/compromised passwords. Password changes require the current strong factor. Never log passwords.

References: [OWASP Password Storage](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html), [NIST password requirements](https://pages.nist.gov/800-63-4/sp800-63b.html#passwordver).

## TOTP and factor secrets

Use standard 30-second TOTP with at most one adjacent time window in either direction. Atomically update the last accepted factor step; at most one concurrent request can accept a step. Verify the new secret before activating enrollment. Initial enrollment requires verified password and bootstrap/invitation authority, not a code from a factor that does not yet exist. Replacing a factor requires current TOTP or restricted recovery.

Store factor secrets using authenticated encryption such as AES-GCM, never plaintext. Each encryption needs a unique nonce, key version, and user/factor-bound additional authenticated data. Keep encryption keys outside the database/repository and separate from database backups. Test key rotation and encrypted restore. Provide QR and manual enrollment keys only on authorized non-cacheable screens.

## Email/SMS codes

Email OTP uses 6–8 cryptographically random digits, a 5-minute lifetime, and at most 5 failed attempts per challenge. Store an HMAC under a separate key outside the database; plain hashing does not protect short codes against offline guessing. Bind user, purpose, and challenge, consume once atomically, and invalidate the previous code on resend without resetting aggregate failures.

Initial send limits: at least 60 seconds between sends, 5 per account/hour, 30 per IP/hour, plus provider cost quotas. Verify email changes separately. SMS follows the same purpose, HMAC, expiry, attempt, and atomic-consumption rules; mask phone numbers and require the current strong factor for changes. Use provider-independent adapters and safe errors. SMS sign-in would require a separate decision.

[NIST excludes email from out-of-band authentication](https://pages.nist.gov/800-63-4/sp800-63b.html#ooba); our email flow is address verification/notification, not administrator MFA.

## Recovery and bootstrap

Recovery codes contain at least 128 bits of randomness each, are hashed, displayed only when generated, and consumed once atomically with an event. A new set invalidates the whole old set and requires current TOTP step-up or completed recovery. Password plus a recovery code grants only a short-lived factor-enrollment session. No management is permitted before replacement TOTP is verified. Factor changes revoke sessions/pending challenges and notify the user.

Only a trusted server operator can run the first-administrator CLI bootstrap. No shared default password or public setup endpoint. Bootstrap tokens contain at least 256 random bits, are stored hashed, expire within 15 minutes, and are single-use. Administrator creation and bootstrap closure are atomic; concurrent setup cannot create two initial administrators.

Invitations are single-use and bound to recipient, workspace, purpose, and delegated scope; initial lifetime is 24 hours. Match the verified email at acceptance and recheck the inviter's current authority and delegation ceiling. New accounts enroll password/TOTP; existing accounts authenticate without having credentials/factors reset. Never take the role from client input. Resend, cancellation, and membership removal invalidate old invitations.

Password-reset tokens contain at least 256 random bits, are stored hashed, last 15 minutes, and are single-use. Give generic responses that do not reveal account existence. Reset does not remove MFA and revokes existing sessions and other reset tokens.

If all factors and recovery codes are lost, email/SMS cannot instantly disable MFA. Before real users, deliver an operator runbook covering identity verification, reason, notification, audit, and re-enrollment. Atomically preserve the last active installation administrator and, separately, the last active owner of every workspace.

## Sessions and abuse prevention

Use server-side sessions with at least 256-bit random opaque tokens; store only hashes in the database. Cookie: `__Host-hubpanel_session`, `Path=/`, `HttpOnly`, `Secure`, `SameSite=Lax` or stricter, without `Domain`. Initial server-enforced expiry is 15 minutes idle and 8 hours total.

Check current account state, session expiry/revocation, membership, and permissions from the authoritative source on every protected request. A cached role or cookie claim is insufficient. Repeat critical checks inside the mutation transaction. Password reset/change, factor changes, recovery, and account disablement revoke sessions; revoked access fails on the next protected request. Disabling enabled MFA requires the current password and current TOTP; enabling it requires verified enrollment. Support device/session review and logout from all devices; minimize IP/device data.

Apply account/IP/device limits with escalating delay and distributed Redis counters. Initial password baseline: 10 failed attempts per account/15 minutes and 30 sign-in requests per IP/minute, subject to NAT/load testing. Challenge creation, resends, and device changes must not reset aggregate account/IP failures. Avoid permanent lockout as an attacker-controlled denial of service; CAPTCHA is risk-triggered only.

When the authoritative limit store is unavailable, new sign-in, code delivery, and recovery fail closed. The general MVP uses shared PostgreSQL counters under ADR-010 rather than requiring Redis for authentication. Trust forwarded IP headers only from configured reverse proxies. Use generic authentication errors; notification delivery must be explicit when no provider exists.

## Request and authorization boundaries

Cookie-authenticated mutations require exact allowed Origin plus CSRF protection. If Origin is absent, require a trustworthy Referer and valid CSRF proof; reject if evidence is missing. No substring/suffix matching. GET is read-only. CORS is not authentication. Machine calls use separately scoped service identity; webhooks need signatures, expiry, and replay checks. External redirects use allowlists.

Deny by default on every API/server action. Check current membership, role, application, resource, and object scope for records, files, search, exports, and jobs. Middleware/layout/menu checks never replace operation checks. Delegation cannot exceed the actor's own scope, including indirect escalation through role editing. Editors/viewers cannot manage roles. Assigning installation administrators requires an existing authorized administrator, step-up, and audit.

Workspace owners control their own workspace, not global accounts or other memberships. Ownership transfer requires the current owner's step-up and a verified MFA-enrolled member's explicit acceptance. Recheck permissions at acceptance and commit new ownership, old-role change, and audit atomically. Pending transfer never removes the last owner. Keep installation/operator privileges separate from workspace roles.

## Sensitive operations and step-up

Require current TOTP for role changes, account disable/delete, factor replacement, connection/key creation/rotation/revocation or expanded scope, secret access, bulk export, backup download, and critical settings. Restricted lost-factor recovery can only enroll a factor; it cannot authorize these operations.

Bind proof to user, session, workspace/application, action, target, and critical payload digest. Lifetime is at most 5 minutes; consume once in the same transaction as the operation. Recheck authority and target. Retry with the same scoped idempotency key returns the original result without another effect. Changed action/payload/permissions require fresh proof. Two-person approval is P1.

## Audit and remote effects

Record actor, time, target, result, minimized IP/device context, and allowlisted changes. Do not record passwords, tokens, factor secrets, recovery codes, or entire request/response bodies. Mask personal fields for auditor views.

The application role can insert audit events and read them only under authorized workspace RLS; it cannot update or delete them. Retention/maintenance uses separate operator authority. This does not claim immutability against a database administrator. Local mutation and audit share a transaction; failed audit rolls back the mutation. Authentication failure events survive business rollback in a separate security-event path. If that event cannot be recorded, authentication/recovery cannot complete successfully. Complete authorization-denial event coverage remains release work.

Remote writes are not atomic with local database commits. Store intent, audit, and outbox atomically; recheck current permissions before delayed execution, use a remote idempotency key, and record/reconcile results. Unknown outcomes are not success. Do not blindly retry a non-idempotent remote service. See [integrations](integrations.md). Hash chaining or periodic log signing may be evaluated in P1.

## Runtime, uploads, and private data

Use HSTS, CSP, nosniff, and referrer policy. Fail production startup for missing/invalid required secrets; development defaults cannot reach production. Redact logs/errors. Keep database ports private and application/migration/maintenance roles separate. Auth/private responses are not shared-cacheable; secret enrollment pages use `no-store` and a restrictive referrer policy. Public health reveals no infrastructure or credentials.

The web proxy generates a fresh 256-bit nonce per request and supplies it to Next.js rendering and the response policy. Production scripts require a nonce and permit neither generic inline execution nor eval; development retains framework-required eval/style exceptions. Pages are dynamically rendered and not shared-cacheable. Do not bypass the proxy for document requests or cache nonce-bearing HTML at a CDN. Production browser checks cover hydration, script rejection, and client header spoofing. CSP does not replace output encoding, authorization, or authentication.

Before uploads ship, verify extension, MIME, and content signature; reject SVG/HTML in MVP. Enforce size at proxy and streaming layers, user quotas, UUID storage names, storage outside the web root, and authorized downloads. Do not trust filenames or serve private uploads through a shared public cache.

## Retention and restore

Proposed initial retention: audit 180 days, security events 90 days, raw IP at most 7 days before masking/deletion. Operators must approve/document their requirements; these are product defaults, not compliance claims.

Initial encrypted-backup targets: daily, retained 30 days, RPO 24 hours and RTO 4 hours. Accept these only after a restore exercise; assign an owner and back up encryption keys separately. Restore must revoke old sessions, invitations, reset/MFA challenges, and recovery state. Without a trusted current revocation record, restored factor/recovery state requires re-enrollment rather than reviving old access.

## Future OIDC

Use a maintained common provider and allowlisted redirects. Authorization Code with PKCE S256, one-use state/nonce bound to the initiating browser, and ID-token signature/algorithm, issuer, audience, azp where applicable, expiry, and nonce verification are required. Provider/JWKS configuration is never taken from arbitrary user input.

Identify external accounts by `(issuer, subject)`. Matching verified email does not automatically link an existing account; require explicit linking after local step-up. Preserve invitation and MFA policy, support domain restrictions, and retain an alternative sign-in method when unlinking. Test sign-in, logout, and membership revocation separately.

References: [OpenID Connect Core](https://openid.net/specs/openid-connect-core-1_0.html#IDTokenValidation), [OWASP OAuth2](https://cheatsheetseries.owasp.org/cheatsheets/OAuth2_Cheat_Sheet.html).
