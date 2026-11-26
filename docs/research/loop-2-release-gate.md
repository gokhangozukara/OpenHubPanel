# LOOP-2 release gate

Recorded: 2026-11-08. Scope: local synthetic fixtures on `feat/general-workspace-mvp`. **20/20 requested MVP criteria passed (10/10 bounded MVP acceptance).**

## Independent service boundary

The PostgreSQL integration and production browser launch the unmodified `examples/content-api/server.mjs` in a separate Node process, with a random API token and a private SQLite database. A certificate-verified local HTTPS proxy carries real sockets to that process. Neither layer returns a fabricated health, manifest, article or operation response.

The service integration injects an explicit HTTPS transport into `generalConnections`. The production browser instead preloads `scripts/general-test-network.mjs` into its **test process**, outside the Next artifact. This maps only `content-fixture.example.test` to the fixture TLS socket, verifies its generated CA/name, and supplies a public DNS fixture result before the unchanged `remoteJson` address checks. It does not establish real public DNS routing. No production runtime imports the preload or reads its metadata variable. All other hosts retain the original DNS/request functions. The normal public-HTTPS, DNS pinning, private-address, localhost, redirect, size and timeout tests remain required.

The UI creates the account, workspaces, application and API connection; tests connectivity; proves read-only default; rejects a reused authenticator code; enables writes separately; reads articles and submits the title form. The first response must be exactly `ok: true, version: 2`. Independent SQLite must contain **Production browser HTTPS title**, version **2**, one operation and one audit. PostgreSQL must contain intent, dispatch and completion events.

Identical replay returns the saved result without another PATCH. Changed replay and stale expected versions conflict. The proxy then drops a response only after the independent service has committed; **Check result** reconciles the same key by GET, with no second PATCH. The final independent article is **Reconciled browser HTTPS title**, version **3**, with exactly two successful operation/audit records. Stopping the actual service process produces an alert and no saved-success message.

## State and accessibility matrix

| Case                                  | Verification                                                                                                                                           |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Initial loading                       | Hold a real state response; status remains visible and forms stay unavailable until it completes                                                       |
| API unavailable / malformed / unknown | 503, malformed successful mutation and opaque unexpected error bodies produce safe translated alerts; never false success                              |
| Offline                               | Chromium context goes genuinely offline; form submission fails, draft remains, reconnect/reload works                                                  |
| Expired session                       | Real PostgreSQL idle/absolute timestamps expire the cookie; next request is 401 and stale workspace data clears                                        |
| Role / removal / forged scope         | Real membership downgrade/removal and altered outgoing IDs produce server-side 403; no application is created                                          |
| Forged object / stale article         | Real panel API rejects unknown connection IDs and stale versions; form keeps its title, no success coexists                                            |
| Unknown write / stopped service       | Actual lost HTTPS reply and terminated independent process; explicit same-key reconciliation, safe read error                                          |
| Failed / disabled connection          | Actual invalid remote connection records unavailable; disable erases its key and denies subsequent read                                                |
| Invalid / long fields                 | Required and oversized form errors link to fields and focus the first invalid input; non-secret drafts remain                                          |
| Empty states                          | Real no-workspace bootstrap state; presentation fixtures for empty application/member/connection/audit arrays over real API responses                  |
| Invitations                           | Expired, cancelled, replaced, used and no-longer-authorized inviter records in real PostgreSQL; each link fails safely through enrollment UI           |
| Duplicate / workspace switch          | Same-tick clicks produce one mutation; selector and submit remain disabled while its real response is held                                             |
| Late scope result/error               | Hold real A responses while selecting B on Applications, Connections, Members and Audit; old success/error cannot overwrite B or its loading/focus/tab |
| TOTP replay                           | Successfully consumed code reused in a real sensitive form is rejected before enabling writes                                                          |
| Messages / privacy                    | Live regions, safe unknown-code fallback, no simultaneous saved-success/error, no credential-bearing fixtures in Git                                   |

Axe uses `wcag2a`, `wcag2aa`, `wcag21aa` against the standalone production artifact. Login and enrollment run both normal and invalid-credentials/code variants at 1280, 768, 390 and 320 CSS pixels. The six authenticated screens run normal, empty and unavailable variants at all four widths. A 320px viewport covers the narrow reflow equivalent of a 640px view at 200% zoom; it is not a claim that browser zoom was changed.

Long workspace/application/user names are loaded into the real fixture database. Tests check horizontal overflow, reduced-motion preference, language and document `lang`, live region roles, associated labels, field errors, OTP attributes, named controls, draft preservation and pending-state duplicate guards. Final login uses Tab/Enter navigation, a visible focus indicator and real clipboard paste into a password-manager-compatible field. Basic application creation uses Enter submission. Unexpected application console errors and page errors fail the browser run; expected browser network-resource diagnostics from deliberate failures are excluded.

Desktop/mobile error screenshots and private service/databases/certificates stay under ignored `.local/general-browser-*`. Visual inspection covers the error alert, reload control, wrapped navigation and field-level errors. These automated/manual checks establish the requested MVP gate, not an independent WCAG certification or full assistive-technology audit.

The empty-list and unavailable-response presentation variants are intentionally controlled browser fixtures, not claims of independent service outages or impossible ownerless workspaces. Offline, HTTP writes, stopped content process, scoped service errors, invitation state and identity expiry use real browser/network/database behavior. A separate fixture owner preserves the database last-owner invariant while simulating another owner's demotion/removal; the trigger remains enabled.

## Final verification record

All eight required local commands passed on 2026-11-08: frozen install (unchanged lockfile), typecheck, lint (195 files), unit tests (93 in 16 files), PostgreSQL integration (37 checks), E2E (17 preview tests + 25 general scenarios), production (4 CSP/security tests + the same 25 general scenarios), and source scan (211 tracked files). Isolated owner regressions passed 17 existing-host and 6 independent-installation scenarios with no browser errors; both independent Node/Python contract checks passed. Dependency audit found no known vulnerabilities, and redacted full-history Gitleaks found no leaks. No CI result is inferred from the local results.

Operational restore/key rotation, measured load, email delivery and a background outbox worker remain outside this LOOP-2 MVP acceptance.
