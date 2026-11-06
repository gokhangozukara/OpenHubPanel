# Product vision

OpenHubPanel brings admin work from separate websites and applications into one place. It can be an application's admin panel and a hub for several existing tools. The slogan is **All in one panel.**

The problem is familiar: every project arrives with another panel, another account, and another set of repeated screens. A developer should be able to connect an application through a documented contract instead of building team access and basic management again.

## Who we are building for

| User                           | Work OpenHubPanel should help with                                |
| ------------------------------ | ----------------------------------------------------------------- |
| Independent developer          | Connect a client website and hand over scoped access              |
| Application team               | Manage declared resources through shared management screens       |
| Agency                         | Keep clients in separate workspaces and assign appropriate access |
| Business running several tools | Find applications and complete supported daily tasks in one place |

The core must work without access to the maintainer's own applications. HubStag and SwzHub are possible pilot integrations, not product dependencies.

## First useful release

P0 includes secure sign-in, client workspaces, team invitations, roles, session management, audit, a general connector contract, and a real management operation in a synthetic example application. A second independent example connects read-only without changing core code.

The first write proves the integration boundary. It does not prove every customer's administration needs are solved. Choose one complete daily task for the first real pilot and make it usable before widening scope.

The interface supports English, Turkish, and German. The repository uses English throughout. Mobile starts with responsive web; PWA and native distribution depend on evidence from actual use.

## Product commitments

Original product code and design, straightforward self-hosting, clear access boundaries, and honest feature status. An external link is labeled as a link; API integration and SSO are separate capabilities. Planned security controls must not be presented as completed work.

MIT is the chosen license. Commercial use is allowed under its terms; returning changes is voluntary. The owner wants adoption and useful contributions rather than revenue thresholds or mandatory contributions.

## Roles, success, and risks

The installation operator manages infrastructure and approved connector targets. A workspace owner controls one client's members/apps/settings. An application administrator is limited to assigned modules/users; an operator performs daily content/tasks; an auditor reviews appropriately masked records. Technical role names and permissions must be documented consistently before real management ships.

Measure completed user work, setup time, and successful troubleshooting, with telemetry disabled by default. Aim for the main daily task within two actions after sign-in, visible application status, audited role changes, working end-to-end TOTP/recovery, denied unauthorized APIs, next-request session revocation, and usable desktop/mobile flows. These are targets, not current results.

Keep core integration/security in the MIT project without revenue thresholds or mandatory contributions. Prioritize self-hosting, a portable contract, open documentation, and synthetic onboarding. Use maintained accessibility/security/date/currency libraries rather than hand-rolled equivalents.

Open risks: existing application contracts have not been inventoried, email/SMS providers are unselected, Google OAuth needs explicit client configuration, incorrectly implemented MFA could create false confidence, and trying to migrate every legacy module would delay a useful core.
