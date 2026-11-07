# Single-owner live installation

This is the explicitly requested first owner's compatibility deployment (ADR-007). It replaces the read-only pilot as the main interface. It is not the general multi-client P0 release.

## Delivered behavior

- An independent account with an Argon2id password, optional TOTP at every sign-in when enabled and hashed, revocable opaque sessions. No management data before factor verification. Fifteen-minute idle and eight-hour absolute session limits.
- Trusted-console, fifteen-minute, one-use activation. The owner chooses the password and enrolls their own authenticator. Eight random 256-bit recovery codes are displayed once; password plus a recovery code permits only factor replacement.
- Real application catalog and configuration probes through a narrow loopback connector. No direct source-database mount or credential-table access by the web process.
- Native advertising, pop-up, announcement/maintenance, version, subscription and private-note forms. Explicit version preconditions, per-save TOTP or password confirmation, persistent request IDs and atomic host-side audit. Conflicts do not overwrite another save. Unknown results are reconciled, not blindly resubmitted.
- Security/configuration history, password change and logout from all native sessions. Password changes revoke sessions and pending challenges.
- Native push composer and notification history, with home/screen/application/HTTPS targets. The host retains Firebase credentials and routing rules. A transactional audit and durable operation reservation precede delivery; duplicate request IDs never send twice. Unknown results are reconciled without automatically repeating a Firebase request.
- English, Turkish and German; responsive layouts. No navigation to the old panel. Studio and specialized music workflows are not native features.

The source adapter is single-owner and single-instance. It does not provide client workspaces, teams, invitations, arbitrary connector credentials, installation-admin delegation or distributed rate limiting. Do not enable replicas/additional accounts or claim all general-product threat scenarios passed. Retire the host's old template/login/editor handlers and remove their templates/assets from the runtime tree. Old management addresses redirect to native management; old form mutations return 410. Preserve mobile configuration APIs, source data and Firebase credentials. A private rollback archive is not a served alternative interface.

## Runtime

Build the standalone Linux artifact on the maintainer's laptop/WSL with `scripts/build-linux-release.sh`. Use the same `OPENHUB_BASE_PATH` at build and runtime. The script includes the pinned Node runtime, license files, a bundled trusted-console bootstrap tool, the host connector and backup tool. GitHub performs source checks without compiling the application.

Run the web artifact as a dedicated unprivileged account, loopback only, with a read-only release tree and a dedicated writable state directory. Keep the environment outside the release/repository. Startup rejects invalid origin, keys, connector target or missing identity schema.

At the native reverse proxy, append `no-transform` to the upstream `Cache-Control` value. Cloudflare email obfuscation otherwise rewrites authenticated HTML and injects a script that nonce CSP correctly blocks, causing a React hydration mismatch. Preserve the nonce policy; prevent the CDN transformation instead. See [Cloudflare's documented exclusion](https://developers.cloudflare.com/waf/tools/scrape-shield/email-address-obfuscation/). Verify the final authenticated page through the CDN as well as the standalone fixture.

Required environment:

| Variable                   | Value                                                                |
| -------------------------- | -------------------------------------------------------------------- |
| `OPENHUB_OPERATOR`         | `1`                                                                  |
| `APP_ORIGIN`               | Exact HTTPS installation origin                                      |
| `OPENHUB_BASE_PATH`        | Build-time prefix                                                    |
| `OPERATOR_EMAIL`           | Sole owner's email                                                   |
| `OPERATOR_STATE_FILE`      | Absolute independent identity database path                          |
| `OPERATOR_KEY`             | 32 random bytes, lowercase hex; factor-encryption key                |
| `OPERATOR_CONNECTOR_TOKEN` | At least 32 random bytes, base64url; dedicated host service identity |
| `PILOT_UPSTREAM_ORIGIN`    | Exact operator-approved `http://127.0.0.1:port`                      |
| `OPERATOR_BACKUP_KEY`      | Independent 32-byte hexadecimal backup key                           |
| `OPERATOR_BACKUP_DIR`      | Absolute protected backup directory                                  |

The existing host mounts `connectors/hubstag.cjs` under `/internal/openhub` using its Express/sqlite3 modules and its real database filename. Configure the key file and fixed operator identity on the host. The connector checks loopback transport and its service token, exposes only allowlisted fields and owns all source-database writes. Block the internal prefix at the public reverse proxy. Do not expose this as a public API or grant the web process database writes.

Reverse-proxy the application prefix to the dedicated web port and overwrite `X-OpenHub-Client-IP` with the trusted peer address. Route the main entry to the native `/live` screen. Redirect old `/app/:slug?tab=...` bookmarks to `/live?app=:slug&tab=...` using strictly validated slugs and an explicit tab allowlist. Redirect the old panel/login/Studio entry to the native panel. Preserve existing mobile APIs and application/media data. No general URL redirects are allowed. Mount the host connector with a `push` adapter from `connectors/firebase-push.cjs`, passing the host's installed JWT library and existing push-routing module. Install `connectors/push.cjs` beside the connector. Never give the native web process Firebase service-account files.

## First owner

From the trusted console, using the production environment and service account:

```sh
node --env-file=/protected/operator.env /release/operator-bootstrap.mjs
```

The command migrates the independent identity schema and prints one activation URL. Deliver it privately or open it on the owner's device. Its fragment is removed from browser history once read and never reaches HTTP/access logs. It expires in fifteen minutes. A new invocation rotates an unclaimed token; an existing account cannot be replaced by normal bootstrap. Do not collect the owner's password or authenticator code in chat.

The owner selects a character and username, chooses a password of 6–256 characters and optionally enables Google Authenticator. If enabled, they scan the QR, verify the current code and save recovery codes. Password safety checking uses the Have I Been Pwned k-anonymity range API; only a SHA-1 prefix is sent. An unavailable check blocks enrollment/password changes. The deployment process does not invent or enroll the owner's factor.

## Recovery and encrypted restore

Normal recovery starts with the account password and one unused recovery code. It revokes existing native sessions and offers only replacement-factor enrollment. Completing replacement invalidates pending challenges and old recovery codes. Old authenticators cannot authorize new native sessions.

If every factor/code is lost, the trusted server operator verifies the owner's identity through an independent established channel, records the reason, and notifies the owner through the established channel. Then run:

```sh
node --env-file=/protected/operator.env /release/operator-bootstrap.mjs --recover --reason=verified-identity-and-reason
```

This preserves the single owner record, immediately blocks its old authority, revokes sessions/challenges/recovery codes and issues a restricted one-use activation link. Only a newly chosen password and verified replacement TOTP restore access. Email/SMS cannot remove MFA. The operator notification/identity verification is a manual runbook step, not an implemented email service.

Run `operator-backup.mjs` with the private environment for a consistent SQLite online snapshot compressed and encrypted with AES-256-GCM under the separate backup key. Schedule it daily; keep encrypted archives for the operator's approved retention period. Back up keys separately from the identity archive and source code. Existing source-catalog backups remain the host's responsibility.

Before restoring, stop native management, preserve the current identity database, and restore to an independent protected path:

```sh
node --env-file=/protected/operator.env /release/operator-backup.mjs restore-test /backup/identity.ohpb /protected/restored.sqlite
```

The tool verifies database integrity, revokes every restored session/challenge/bootstrap/recovery code, marks the owner for trusted re-enrollment and adds a security event. Never point a live service at a raw decrypted snapshot. Install only this revoked restored state, issue trusted-console recovery, then restart. Loss of the separate encryption key is not an MFA bypass. Record measured restore time; the general RTO target is not a measured production guarantee.

## Verification and rollback

Run type checks, lint, unit/integration tests and the source/history/dependency scans. Build with the real prefix and run `node scripts/test-owner-installation.mjs` against the standalone artifact. It creates an independent synthetic catalog/account, local HTTPS proxy and ephemeral certificate; it does not enroll or alter the live owner. It checks pre-MFA denial, Origin/CSRF, native write/audit, languages/mobile layout, old-session rejection, restricted recovery and encrypted restore.

Before cutover, use the host SQLite backup API, verify integrity, fingerprint all real public configurations, and preserve host source/proxy/service/environment and prior release. Live write checks use exactly one uniquely named synthetic application; remove that application afterward. Do not send a real push or alter a real app's maintenance, advertising, subscription or content settings as a deployment test.

Rollback restores the saved host/proxy/service source and previous release pointer, validates the proxy and restarts only affected services. Never restore an old source database over legitimate newer writes just to remove OpenHubPanel. Keep native audit/idempotency tables and identity state; additive tables do not break the original editor. The first owner's interactive activation and acceptance are recorded separately from automated installation tests.

## Owner-selected sign-in protection

The owner explicitly changed the policy in ADR-008: first select the remembered animal from eight illustrated choices, then enter username/password (minimum six characters). A wrong character cannot reach password verification. Google Authenticator is optional in activation/settings, and is requested at every sign-in when enabled. Sign-in settings also support IPv4/IPv6 and CIDR allowlists, check every protected request and prevent excluding the current IP. Saving protection changes revokes existing sessions. Trust Cloudflare client headers only from its published proxy ranges; the native upstream receives an overwritten client-IP header.
