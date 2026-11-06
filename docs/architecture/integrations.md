# Integrations and workspaces

This is a target contract under [ADR-005](../decisions/005-admin-hub.md). Initial schemas exist; a working connector and SSO service do not.

## Terms and connection levels

An **installation** is an operator-run OpenHubPanel instance. A **workspace** is one client/team's data and permission boundary. An **application** registers a site/service/panel in that workspace. A **connector** adapts its API; a **connection** supplies the approved target, scope, and server credentials. A **resource** is a managed record type; a **capability** is a declared operation.

| Level                | Behavior                                                 | Sign-in                                                        |
| -------------------- | -------------------------------------------------------- | -------------------------------------------------------------- |
| Link card            | Opens an approved external panel                         | The external panel may require its own login                   |
| API integration · P0 | Lists/edits supported data inside OpenHubPanel           | One local session; server-side scoped service identity         |
| OIDC SSO · P1        | Opens compatible external panels using a shared provider | Both applications must integrate with that maintained provider |

Do not collect external passwords, mimic SSO with autofill/shared cookies, or present an iframe as identity integration. Identify OIDC users correctly and preserve local membership/MFA policy. Login, logout, and cross-application revocation are separate tests. Provider outage is a separate availability dependency.

A user may belong to several workspaces with different roles. Workspace owners do not gain installation privileges. An infrastructure/root operator remains privileged; the product does not promise cryptographic privacy against that operator.

## HTTP/JSON contract

Draft contract revision `0.1` is not a published release API promise. PHP, Python, Node.js, or any backend can implement it without a language-specific SDK. Manifests contain identity, schema/version, capabilities, and permission declarations, never executable JavaScript/SQL/templates, secrets, or arbitrary full URLs.

The first resource is `articles`: `id`, `title`, `status`, and `version`. Limit the first write to title update rather than arbitrary table CRUD. The independent second example is read-only.

| Operation    | Relative endpoint                      | Required behavior                                 |
| ------------ | -------------------------------------- | ------------------------------------------------- |
| Health       | `GET /hubpanel/v1/health`              | Generic status and supported contract version     |
| List         | `GET /hubpanel/v1/articles?cursor=...` | Allowed fields, bounded pages, opaque cursor      |
| Detail       | `GET /hubpanel/v1/articles/{id}`       | Object scope plus version/ETag                    |
| Update title | `PATCH /hubpanel/v1/articles/{id}`     | Allowed fields, expected version, idempotency key |

Phase 6A supplies JSON Schema/OpenAPI, synthetic examples, a working sample server, safe errors with code/message/request ID, and distinct handling of 401/403/404/409/429/unavailability. Incompatible major contract versions stop the connection with a clear error.

Use a bounded set of original list/detail/form components. Never execute connector data as HTML/code. Hide unsupported operations, but still verify capability, current membership, and resource permission server-side. The target API must independently enforce the credential's customer/resource scope; caller-supplied workspace/actor headers are not trusted proof.

## Connection lifecycle

1. The workspace owner selects an operator-approved connector and target. Workspace input cannot open a new network destination.
2. Validate address/credentials on the server. Connection tests only read health/permission scope, never mutate data.
3. Show requested permissions and start read-only.
4. Enable writes only with separate permission/scope, step-up, and completed outbox/idempotency checks.
5. Show connected, permission error, unavailable, or incompatible states and the last successful check.
6. On removal, disable locally first, stop new jobs, and cancel/reconcile pending work. Revoke the remote key before deleting the local secret. If revocation fails, remain disabled and show pending remote revocation; retain the secret only for a restricted revocation process or document manual revocation. Never use it for normal calls. Keep audit; do not claim started remote work was rolled back or delete remote customer data.

Credentials must be separate, least-privileged, revocable per connection/customer, encrypted server-side, and absent from browser/log output. A broad shared key is unacceptable when the target cannot enforce tenant scope; use separate identities or service instances.

Apply protocol/host/port/path allowlists, DNS/resolved-address validation, redirect rejection, timeouts, response limits, TLS verification, and network egress restrictions to all requests. Private services require explicit narrow exceptions; metadata/loopback targets are not normal production destinations.

## Workspace isolation

- Tenant records, roles, connections, and relationships include workspace scope; composite foreign keys prevent cross-workspace references.
- Verify membership before accepting a selected workspace from URL/header/form input.
- Use FORCE ROW LEVEL SECURITY; application/worker logins are neither table owners nor BYPASSRLS roles. Migration/operator roles are separate. Context is local to a transaction, never leaked through pool reuse.
- Scope caches, cursors, files, limits, audit, idempotency, and jobs by workspace/application. Recheck authority before worker execution and impose per-workspace quotas/concurrency.
- Clear old lists/forms/cache when switching. Discard late previous-workspace responses. Make workspace identity clear in actual management URLs.
- Invitation membership affects only its workspace. Removal denies the next request there without changing unrelated memberships.
- Protect each last owner separately from the last installation administrator. P0 has no destructive workspace-delete UI; document authorized export/deletion procedures at release.

RLS is an additional boundary, not a replacement for authorization. Test with real PostgreSQL and two clients. References: [PostgreSQL row security](https://www.postgresql.org/docs/current/ddl-rowsecurity.html), [OWASP Multi-Tenant Security](https://cheatsheetseries.owasp.org/cheatsheets/Multi_Tenant_Security_Cheat_Sheet.html), [OWASP SSRF](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html).

## Developer acceptance

The target application owns its content. OpenHubPanel backups do not replace target database/file backups. P0 integration must not add a runtime dependency to the target's visitor flow. See [operational details](../product/operational-details.md).

Connect through the contract/adapter and approved configuration without client-specific core changes. Supply setup, minimal examples, permission tables, troubleshooting, and compatibility tests together. Measure an external developer's first read-only connection attempt; 30 minutes is an unmeasured target, not an achieved result.
