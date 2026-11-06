# Operational details

These are acceptance rules for planned team and integration features.

## Invitations

Show active members separately from pending invitations. Resending invalidates the old token; cancellation and membership removal invalidate pending access for that recipient in the same workspace. Acceptance requires the intended verified email, a valid single-use token, and the inviter's current delegation authority. Existing account credentials/factors are never reset. Concurrent acceptance creates at most one membership. Failed email delivery must not be shown as successful delivery.

## Ownership and handover

Only the current owner initiates a transfer, after step-up. The recipient must be a current verified member with MFA and explicitly accept. Recheck both memberships and permissions at acceptance; ownership, the previous owner's agreed role, and audit commit atomically. Preserve the last active owner. Workspace ownership does not transfer server/root ownership.

Remove agency access only after acceptance and rotate service credentials known to the agency. Show remaining access. Moving between installations needs a safe operator procedure; P0 does not promise one-click migration.

## Outages and disconnection

The connected application remains the source of truth. Its normal visitor/backend flow must not depend on OpenHubPanel availability. Losing the hub may interrupt central management but must not stop/delete the application. Common identity-provider availability is a separate P1 dependency.

Show stale data and last-check times honestly. Reconcile unknown remote write results before another attempt. Removing a connection disables local work first, revokes the remote key, then removes the local secret. If remote revocation fails, retain only restricted material needed to finish revocation and show a pending state. Do not claim already-started remote work was rolled back.

## Data, backups, and leaving

OpenHubPanel holds identity, membership, connection, permission, audit, and limited cache data. Its backup does not back up the target application's database/files. Assign responsibility for both.

The release procedure must explain authorized workspace export, safe separate handling of secrets, retention, and local deletion. Exports must never contain another client's data/keys. Remote content export depends on connector support. Advanced export/deletion screens can follow later.

## Installation and upgrades

Test clean installation, upgrade, migration failure, and recovery. Measure minimum CPU/RAM/disk rather than inventing capacity claims. Document backups and schema compatibility; image rollback does not automatically reverse a migration.

Before community release, an external developer connects an example and a client accepts an invitation and edits their own content using documentation. Verbal help identifies a product/documentation gap.

## Keep the pilot narrow

A title update is the first technical proof. Choose one daily job with the real pilot user, list required fields/operations, and follow it through to completion. New connectors and automation should not delay that job.
