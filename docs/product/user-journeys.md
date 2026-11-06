# User journeys

These journeys are acceptance targets, not completed features.

## Developer connects a client website

Create a workspace, register an approved connection, test read-only access, and inspect declared resources. Enable one permitted write only after scoped credentials, step-up, audit, and retry handling pass their tests. Invite the client with limited access. The client changes supported content inside OpenHubPanel without sharing the external panel password.

## Agency manages several clients

Use a separate workspace for each client. Add members and application access per workspace. Switching workspace clears previous lists, forms, caches, and pending responses. Knowing another client's object identifier never grants access.

## Team member accepts an invitation

Open a valid invitation with the intended verified email. An existing account signs in using its own password and MFA; a new account completes enrollment. Recheck the inviter's current authority before creating membership. Expired, canceled, superseded, or concurrently consumed invitations cannot add access.

## Owner hands a workspace to a client

The owner starts a transfer with step-up. An existing, verified member with MFA accepts. Recheck both parties and commit ownership, the former owner's agreed role, and audit together. Do not remove the last owner or agency access before acceptance. Rotate credentials known to the departing party.

## User finds an existing external panel

A link card opens its allowed external address and warns that another sign-in may be needed. API actions run inside OpenHubPanel. SSO is shown only for applications with tested support through a common provider.

## Connection fails

Show connection state and last successful check. An unavailable service is not an empty or deleted dataset. A write with an unknown result stays unresolved until reconciled. Disconnection stops new jobs before remote credential revocation; it never deletes remote customer content.

## User changes language on a phone

Choose English, Turkish, or German without losing workspace or typed form data. Labels, accessible names, notices, and errors follow the selection. Reloading remembers it. Menus and tables remain usable with longer German labels and at mobile widths.

See [operational details](operational-details.md) for lifecycle acceptance rules.
