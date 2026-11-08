# Trusted browser verification

Recorded: 2026-11-08. Applies to the subsequent user-requested [30-day general sign-in policy](../decisions/011-trusted-general-devices.md), on `feat/general-workspace-mvp`. The separate single-owner `/live` adapter and live deployment are unchanged.

## Implemented behavior

The authenticator form has a default-unchecked **Trust this device for 30 days** checkbox in English, Turkish and German. Only a successful code can issue trust. Regular sign-out preserves it; future sign-ins still verify the password and current account. The expiry does not slide. The Security screen can forget the current trusted browser, and logout-all revokes every trusted browser. Sensitive operations and recovery retain their TOTP requirements. Password/factor bindings prevent old records from satisfying sign-in after a credential change.

Opaque token and browser cookies are Secure, HttpOnly, SameSite=Strict, host-only and limited to 30 days. Server storage contains hashes/bindings and a fixed expiry, not the raw token. Cookies are not JSON responses or script storage. Trust is a browser-profile bearer credential, not a hardware guarantee. Existing general installations need migration 0005; this feature does not run a live migration.

## Evidence

- [Real PostgreSQL tests](../../apps/web/src/server/general/trusted-devices.integration.ts) add seven checks: opt-in/valid-factor issuance; hash/private binding, ordinary session creation and unchanged expiry; wrong-password/account/browser/token denial; server expiry; forget-device and concurrent logout-all; password change/restricted recovery/factor replacement; atomic rollback on failed security audit. Existing identity, workspace, RLS and independent HTTP tests remain enabled.
- [Production browser extension](../../scripts/fixtures/general-trusted-browser.ts) adds five scenarios: translated/accessible checkbox and private 30-day cookies; normal sign-out plus remembered password login and mandatory sensitive step-up; copied token without browser binding; explicit forget/server expiry/opt-out; revoked trust even after old cookies are restored.
- The isolated fixture applies all five migrations twice, including the real migration CLI. Expiry tests move only synthetic database timestamps; no clock or production bypass is added. Successful MFA still uses actual TOTP codes and the real server APIs.
- The checkbox passes `wcag2a`, `wcag2aa`, `wcag21aa` in EN/TR/DE at 390/1280px. The earlier normal/error state suite still checks four widths. The generated checkbox screenshot was visually inspected and stays under ignored `.local/`.

Validation completed: frozen install (unchanged lockfile), typecheck, lint, 93 unit/translation tests, 44 real PostgreSQL checks, 17 preview browser tests, and the production gate with 4 CSP/security tests plus all 30 general browser scenarios (25 baseline + 5 trusted-device cases). Source/history scans and the PR CI status are checked separately when publishing the branch. No merge, deployment or live-data change is included.
