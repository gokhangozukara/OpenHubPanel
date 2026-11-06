# Foundation review

Reviewed: 2026-11-06. Scope: the existing source, development setup, dependency graph, security helpers, database boundaries, and synthetic interface. No live services were modified. The repository remains private.

## Findings addressed

| Finding                                                                                | Change and verification                                                                                                                                                                                    |
| -------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Lint rules were disabled                                                               | Enable Biome's recommended rules and fail on warnings. Keep one explained exception for the cosmetic language cookie.                                                                                      |
| Origin checks accepted noncanonical input; development allowed non-web origins         | Require serialized browser origins, validate configured HTTP/HTTPS origins, and reject empty tokens. Add negative cases.                                                                                   |
| Log redaction missed alternate secret names and could invoke getters or fail on bigint | Normalize sensitive field names, avoid accessors, mask binary data and errors, and bound nested serialization. Exercise hostile objects and cycles.                                                        |
| Worker URL parsing lost Redis database selection and encoded credentials               | Use the Redis client's URL parser, preserve TLS/IPv6, and disconnect the shared connection during shutdown. Test parsed options without contacting a server.                                               |
| Worker startup did not load local configuration                                        | Add a root worker command that loads the root environment file. Align generated URLs and example credentials with local infrastructure. Test setup in an isolated directory, including rerun preservation. |
| Connector manifests allowed ambiguous duplicate identifiers                            | Reject repeated resource IDs/capabilities and blank display names.                                                                                                                                         |
| Unused ORM tooling pulled in vulnerable development code                               | Remove unused Drizzle packages. The project already uses the postgres driver and SQL migrations. Audit development dependencies in CI at moderate severity.                                                |
| System theme toggle used the saved preference instead of the effective theme           | Observe system theme changes and toggle from the displayed theme. Verify in Chromium.                                                                                                                      |
| Hidden mobile navigation remained keyboard-accessible                                  | Mark hidden navigation/background inert, move focus when opening, restore it on Escape, and hide the backdrop at desktop widths.                                                                           |
| Unauthorized readiness responses lacked an explicit cache policy                       | Return `Cache-Control: no-store` for concealed readiness responses.                                                                                                                                        |

The removed development dependency included an esbuild version covered by [GHSA-67mh-4wv8-2f99](https://github.com/evanw/esbuild/security/advisories/GHSA-67mh-4wv8-2f99). The affected development server was not part of the application's runtime.

## Verification

- Strict TypeScript checks, recommended lint rules, and production build.
- 43 unit/tooling tests, including configuration, redaction, contracts, Redis URL options, and setup preservation.
- 10 real PostgreSQL checks for RLS, workspace context, audit integrity, rollback, and membership revocation.
- 13 Chromium tests covering the three languages, accessibility scans, keyboard navigation, themes, and preview boundaries.
- Dependency audit reports no known vulnerabilities at review time; license inventory contains 105 installed package/version entries.

See CI for Linux and container results for the associated commit. Local Windows verification does not replace container verification.

## Remaining work

This is still a foundation with a synthetic preview. Password/TOTP authentication, server sessions, real invitations, scoped management operations, connector execution, and the transactional outbox are not implemented. Do not mistake preview controls or security helper tests for those complete flows.

Next implement and verify the authentication slice described in the [implementation brief](../contributing/implementation-brief.md). Production acceptance also requires nonce-based CSP, recovery/revocation scenarios, backup restoration, operational monitoring, and a controlled pilot. Redaction requires callers to use allowlisted structured fields; arbitrary strings are not guaranteed secret-free. Passing these checks is evidence for this revision, not a guarantee of defect-free software.
