# General workspace MVP

The general product runs at `/workspace` with `/api/general/*`. It uses its own PostgreSQL identity and workspace services. The single-owner `/live` installation remains a separate SQLite adapter.

## Prepare an independent installation

Use Node.js 24, the pinned pnpm version, PostgreSQL 18 and an HTTPS reverse proxy. Install dependencies with `npx --yes pnpm@12.18.0 install --frozen-lockfile`. Use a fresh database for this MVP. Existing foundation databases need an operator-reviewed migration baseline; the migration command deliberately does not infer an existing database's history.

Provision these values privately through the process supervisor or a secret manager:

| Variable                         | Purpose                                                                                             |
| -------------------------------- | --------------------------------------------------------------------------------------------------- |
| `GENERAL_ENABLED=1`              | Enable the general product; `/` then redirects to `/workspace`                                      |
| `APP_ORIGIN`                     | Exact public HTTPS origin, without a path                                                           |
| `GENERAL_DATABASE_URL`           | Restricted `openhub_app` database login                                                             |
| `GENERAL_ENCRYPTION_KEY`         | Independent random 32-byte key, hexadecimal encoded                                                 |
| `GENERAL_MIGRATION_DATABASE_URL` | Privileged migration connection, available only to the migration command                            |
| `GENERAL_TRUST_PROXY`            | Leave unset unless a trusted proxy exclusively controls access and overwrites `x-openhub-client-ip` |

Keep the web listener private on loopback behind the HTTPS proxy. Do not trust an IP header on a publicly accessible backend. Without proxy trust, sign-in requests deliberately share a conservative IP-limit bucket. Retain keys separately from encrypted database backups. Do not share the general key with the owner adapter or place credentials in Git, command arguments or build logs.

1. As the trusted database operator, run `npx --yes pnpm@12.18.0 general:migrate`. Migration history and all five migrations commit together under an advisory lock. Repeating the command skips recorded migrations.
2. Through a private PostgreSQL operator session, enable login on `openhub_app` and set its unique password using the interactive `\password openhub_app` command. Do not grant the web login membership in the migration or `openhub_policy` roles.
3. Remove migration credentials from the web environment. The web startup check rejects superuser, BYPASSRLS, inherited privileged roles and ownership of application tables.
4. Build with `npx --yes pnpm@12.18.0 build`. Start the standalone artifact with its static assets, or use the documented project start command behind HTTPS. General configuration is evaluated at runtime.
5. In a private operator terminal, run `npx --yes pnpm@12.18.0 general:bootstrap`. Copy the one-use token into **First installation** at `/workspace`. It expires after 15 minutes. Issuing another unused token replaces the earlier token; bootstrap closes when the first account is created, even before its TOTP enrollment completes.
6. Choose an email address and a password of 6–256 characters. Common passwords and positive breach-list matches are rejected. Breach lookup sends only a five-character SHA-1 prefix to the fixed Pwned Passwords range endpoint; provider failure blocks password creation.
7. Add the displayed manual key to an authenticator and verify its current code. Optionally check **Trust this device for 30 days** on a private device. Save the eight generation-only recovery codes privately. There is no management session before verified TOTP enrollment.
8. Create a workspace and an application. Invite members using the generated one-use link. **No email is sent.** Send the link through an appropriate private channel. A new invitee enrolls a password and TOTP; an existing account signs in and accepts without resetting its credentials. Possession of the invitation authorizes its bound address; this is not a claim that an email delivery service verified the mailbox.

No public account signup, email provider, password-reset delivery or automatic external-panel SSO is included. Keep this early MVP under operator supervision until deployment, restore, load and complete manual accessibility acceptance have been performed.

## Daily use

Workspace selection reloads data under current membership. Every API operation derives the actor from an opaque, server-checked session. Owners manage ownership; admins manage allowed team roles, applications, connections and audit; editors can read and write supported content; viewers can read permitted data. Admins cannot grant admin/owner access or change an owner. Ownership is offered by an owner and accepted by the target member with current TOTP. The last active owner cannot be removed or demoted.

Sensitive forms take a current authenticator code. Verification and the requested mutation share a transaction: the consumed factor step is bound to that session, workspace, action and submitted payload through the transaction rather than a reusable client proof. A code accepted at enrollment, sign-in or another sensitive action cannot be reused. Wait for a new code before the next sensitive action.

Invitations last 24 hours, store only a token hash, and recheck the inviter's active authority on lookup and acceptance. Resend creates a replacement link and invalidates the old one. Removing a member invalidates outstanding invitations for that address in the workspace. Acceptance cannot overwrite an active member's role.

Sessions use separate `__Host-hubgeneral_*` Secure, HttpOnly, SameSite=Strict cookies. Absolute expiry is eight hours; idle expiry is 15 minutes. Sign out on all devices revokes every session and trusted-device record. Password, IP and browser limits use shared PostgreSQL counters, independent of rolled-back business transactions; new challenges do not reset failures. TOTP challenges allow five attempts and expire in five minutes. Successful full authentication clears the applicable account/browser failure buckets; sensitive-operation failures retain their counter until success or expiry.

## Trusted browsers

The unchecked **Trust this device for 30 days** option appears below the authenticator code. It takes effect only after that code succeeds. Subsequent sign-ins in this browser still need the password but may skip the code for a fixed 30 days. Remembered sign-ins do not extend that deadline or the normal session lifetime. Sensitive operations still need a current code. Another browser, cleared cookies, expiry, changed password/factor or disabled account restores normal verification. Recovery always requires replacement enrollment.

Use **Security → Forget this trusted device** to require a code at the next sign-in on this browser. Regular sign-out retains trust; **Sign out on all devices** removes it everywhere. Cookie copying can copy a browser profile's trust: do not use this on a shared computer. No device token is exposed to JavaScript or stored in Git. See [ADR-011](../decisions/011-trusted-general-devices.md). Existing general installations must apply migration 0005 before running this version; no automatic live migration is performed at startup.

## Connections and title changes

An application's panel URL opens that external website; it does not authenticate there. API connections store credentials using AES-GCM with both workspace and connection IDs in authenticated context. API responses omit credentials and raw manifests. Connections start read-only and unchecked. Explicit testing reads the 1.0 health/manifest contract, records its check time, and reports an unavailable service honestly.

The shared transport permits approved public HTTPS targets, pins a validated DNS result, rejects private/rebinding targets and redirects, and bounds time/response size. Approving a target explicitly authorizes sending its API key there. A remote that reflects that key into a manifest or returned article fields is rejected.

Enable writes separately with current TOTP after checking advertised article-update capability. Title changes require the connection revision, article version and idempotency key. A local intent and audit commit before dispatch; current membership and connection authority are checked again before sending. Remote keys are independently generated and scoped to the local workspace/connection/actor/session/payload. Repeating an identical finished request returns the stored safe result. Changed payloads conflict. Uncertain requests only reconcile through the remote operation endpoint; they are not blindly resent. A crash before dispatch may leave an unresolved intent. Automated dispatch/retry workers and a general outbox operations UI are not included.

The UI keeps ordinary form drafts after a failed request and clears passwords/API keys/authenticator codes after submission. Field errors identify and focus the invalid field. Network loss, timeout, changed data and an uncertain write have separate translated messages. Saved success appears only after a valid result and refreshed scope. For an uncertain write, use **Check result**: it retains the original scoped idempotency key and checks the existing remote operation rather than blindly PATCHing again. If the request never created a server intent, a fresh authenticator code in the original form is needed. A conflict requires reloading and reviewing current data before another edit.

Disabling a connection changes its revision, erases its encrypted key and prevents new reads/writes. Metadata remains for audit. Revoke the corresponding key in the target application too. Revocation cannot undo a remote request already dispatched.

## Recovery and operations

A password plus one unused recovery code grants only a short-lived replacement-factor challenge. Existing sessions and challenges are revoked. The user must verify a new TOTP secret before obtaining management access, and receives a replacement recovery-code set. The old set becomes invalid. There is no password-only management recovery.

For complete loss of factors and codes, stop automated recovery. The trusted database operator must verify identity through an independent established channel, document the reason and notify the account holder privately. Use a reviewed maintenance transaction to revoke sessions/challenges/trusted-device records and old recovery codes, insert one freshly generated 256-bit recovery-code hash and append an `operator.recovery-issued` security event. Deliver the raw code once through that verified channel; it still requires the existing password and replacement TOTP enrollment. Remove an unused maintenance code within 15 minutes. This is a supervised maintenance procedure, not a public recovery endpoint or tested self-service password reset.

Backups need the database plus a separately protected encryption key. Before any general-product restored database is exposed, invalidate sessions, trusted-device records, challenges, invitations, transfers and recovery codes, and require supervised re-enrollment unless a trusted current factor/revocation record is available. A full general-product restore/rotation exercise remains release work; the owner adapter's restore results do not establish this product's restore safety.

Local mutations and successful workspace audits share a transaction. Security events are separate from tenant audit and cannot be changed by the web role. `openhub_policy` is a non-login, narrowly granted policy/function owner that resolves recursive membership checks and audited creation/acceptance. The web login never inherits it. Database operators retain infrastructure authority; append-only web privileges do not claim protection against a database administrator.

See the [acceptance evidence](../research/general-workspace-mvp.md) for tested boundaries and remaining release work.
