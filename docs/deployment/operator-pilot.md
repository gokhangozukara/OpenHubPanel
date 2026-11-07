# Operator compatibility pilot

The optional `/pilot` screen reads a compatible existing SQLite catalog and tests its application configuration endpoints. It is a restricted migration aid for one configured operator. Native OpenHubPanel authentication, MFA, workspaces, invitations, and editing are not implemented by this adapter. Management links open the existing installation's editor.

## Access and data boundaries

- Disabled unless `OPENHUB_PILOT=1`; the normal preview remains unavailable in production.
- Verify the host's HS256 session signature, operator identity, issue/expiry claims, and an eight-hour maximum token age. This compatibility check does not add authoritative session revocation or MFA to the host.
- Configure an operator-selected database file and open it read-only. Only application identity, category, package, version, and maintenance state reach the browser. Credential/configuration tables are not returned.
- Probe only known catalog IDs at a configured loopback HTTP origin. Reject redirects, unexpected application identities, non-JSON responses, oversized bodies, and timeouts. "API reachable" does not prove a deployed mobile client consumes that API.
- Return private, non-cacheable pages and connection results. Keep the existing public configuration endpoints and editors in place.

The source schema expected by this adapter is `apps(slug,name,category,package,sort)` joined with `app_config(slug,latest_version,maintenance_mode)`. Other installations need a separate adapter; do not point this at an unrelated database.

## Build and install

Build on the maintainer's Linux machine or WSL. The canonical checkout stays on the laptop; the script creates a temporary source build directory, not another Git checkout.

```sh
git archive --format=tar --output=source.tar HEAD
OPENHUB_BASE_PATH=/openhub bash scripts/build-linux-release.sh source.tar release.tar.gz
```

The archive includes the standalone application, static assets, the build machine's Node runtime, and license notices. Use the pinned Node version from the root manifest/tooling and verify official runtime checksums before building. Transfer the archive, verify its SHA-256 on the server, and extract it into a new release directory. Retain the previous release for rollback.

Run under a dedicated unprivileged service account bound to loopback. Keep environment configuration outside the release and repository, with access restricted to that account. Required pilot values:

| Variable                | Meaning                                                        |
| ----------------------- | -------------------------------------------------------------- |
| `OPENHUB_PILOT`         | `1` explicitly enables the compatibility screen                |
| `OPENHUB_BASE_PATH`     | Must equal the value used at build time                        |
| `APP_ORIGIN`            | The HTTPS origin of the existing installation                  |
| `PILOT_DATA_FILE`       | Read-only mounted catalog database                             |
| `PILOT_UPSTREAM_ORIGIN` | Operator-approved `http://127.0.0.1:port` target               |
| `PILOT_SESSION_SECRET`  | Existing host session verification key; at least 32 characters |
| `PILOT_ACCOUNT`         | The sole allowed host operator identity                        |
| `PILOT_SESSION_COOKIE`  | Existing host cookie name                                      |
| `PILOT_LOGIN_URL`       | Fixed host sign-in URL, supplied by the operator               |

Use a read-only bind mount for the catalog. Do not grant the application access to the host's environment file, credential directories, or database writes. A reverse-proxy prefix such as `/openhub/` can allow only GET/HEAD while the pilot remains read-only. Existing application/API routes continue to target their original service.

## Verify before cutover

Back up the existing database with its online backup API, verify database integrity, and retain the original proxy configuration. Record application counts and public configuration fingerprints before deployment. Verify unauthenticated/forged-session rejection, authenticated catalog/probes, CSP, mobile layout, language switching, and existing management links. Compare configuration fingerprints afterward.

Test legacy writes only with a uniquely named synthetic application and remove that exact record afterward. Never send a real push notification, trigger billing, or change real maintenance/advertising settings as a smoke test. A server-side round trip does not establish mobile-device delivery or billing integration.

Rollback removes only the new proxy prefix/entry and stops the pilot service. The pilot requires no source database migration. Do not restore the old database backup over newer legitimate writes merely to remove this read-only screen.

Application builds and browser/container checks run on the maintainer's machine. GitHub CI performs type/lint/unit/database/dependency/secret checks without compiling a deployment image or production application.
