# ADR-009: Independent setup, application registration and visible connections

Accepted 2026-11-07, explicit owner request. A panel containing only the existing application catalog is insufficient for a new installation or a new application.

Add server-backed application creation/details, configuration integration instructions and a Connections screen. Application/settings/audit/idempotency commit together; identifiers stay stable and duplicates conflict. Existing source data and mobile APIs remain intact.

Add independent storage selected by `OPERATOR_DATA_MODE=embedded`. It starts empty and uses the owner's SQLite state without requiring the compatibility host. The trusted Linux setup tool creates separate keys and an activation link; it refuses overwriting existing accounts/keys. Web setup never assigns a password or enrolls a factor for the owner.

Separate panel shortcuts from API integrations and SSO. Shortcuts open HTTPS panels and may require another login. The initial API integration accepts the strict shared 1.0 manifest for article lists and optional title updates, with two independent examples. It is not arbitrary database CRUD or generated external admin screens.

In this single-owner installation, the sole owner is also the installation operator: a current proof and explicit host approval authorize a new public HTTPS destination. Workspace roles are not enabled by this decision and must not inherit this power later. Validate all DNS answers, reject private/reserved networks and redirects, pin the selected address, verify TLS, and bound time/size on every request. Credentials use the existing authenticated encryption with connection-specific associated data and never return in normal browser responses.

Start read-only; separately approve title writes if supported. Bind current proof, payload, connection revision, intent and audit before a remote effect. Reconcile unknown outcomes by operation ID without automatic write retry. Disabling locally stops access; the owner must revoke the remote key manually. Restores disable external connections/writes as well as revoking sessions.

These changes expand the working single-owner installation. General client isolation, invitations, roles, SSO and the full multi-client P0 retain their separate acceptance requirements.
