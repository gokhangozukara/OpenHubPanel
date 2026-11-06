# Product requirements

These requirements describe the intended product. See [project status](../../PROJECT_STATUS.md) for what is implemented.

## P0: first usable release

**Identity:** email/username and password, Argon2id, required TOTP for every role, single-use recovery codes, verified email, CLI bootstrap, invitation acceptance, restricted factor recovery, and a manual procedure for losing all factors. Email and SMS do not replace TOTP. Sensitive actions require short-lived, single-use step-up proof bound to the operation and target. Users can review sessions and revoke access. Successful and failed security events are recorded.

**Administration:** client/team workspaces, authorized workspace switching, scoped invitations and memberships, pending invitation resend/cancellation, ownership transfer, roles and permissions, application registration, connection credentials, settings, and clear operation results. Workspace owners and installation operators have separate authority. Global account changes require operator authority; a workspace owner can remove only the membership they control.

**Interface:** simple application lists, search/filtering within a screen, responsive layouts, light/dark/system themes, and English, Turkish, and German throughout visible screens, forms, notices, and errors. Remember language preference and set the document language correctly. English remains the language of source files and project documentation.

**Audit and operations:** actor, time, target, result, and selected field changes; no secrets in logs. Local mutations roll back when audit insertion fails. Include filtered audit views, retention/IP handling, encrypted backups, and a tested restore procedure.

**Integration:** a language-independent HTTP/JSON contract, schemas, documentation, and working examples. Phase 6A connects two independent applications for health/list/detail without core changes. Phase 6B adds one permitted title update in the first example with optimistic concurrency, transactional outbox, idempotency, and audit. Show permissions and connection status, support credential rotation and safe disconnection, and verify boundaries with two client workspaces. The target API must enforce its own customer/resource scope.

## P1: selected improvements

SMS notifications/phone verification, Google OIDC sign-in, passkeys, and SSO for compatible external panels through a maintained common identity provider. Additional connectors, global search, command palette, favorites, recent items, quick actions, persistent notifications, device/risk rules, real-time health, backup screens, maintenance controls, approvals, and bulk administration follow a useful P0.

Basic TOTP, recovery, revocation, step-up, and workspace isolation must not be deferred to P1. Each later release repeats relevant release gates.

## P2: growth

More organization hierarchy, centrally hosted service operation, SDKs in additional languages, a reviewed connector catalog, automations, analytics, broader API-key administration, and advanced retention/export/deletion screens. Basic workspace support, the connector contract, and operating policies are already P0.

## Out of scope for the first release

Unrelated demo dashboards, a copy of the reference theme, migration of every legacy screen, microservices, arbitrary plugin execution, universal automatic CRUD, SSO for every external panel, or a connector marketplace.

A public source repository and a production-ready product are separate milestones. P0 deployment requires the [release gate](../roadmap/implementation.md) and applicable [negative security tests](../architecture/threat-model.md).
