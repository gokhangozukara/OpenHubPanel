# Independent single-owner installation

Start with a separate owner and empty application storage, without an existing panel, host database or HubStag service. This supports application registration/configuration, public configuration URLs, panel shortcuts and the narrow API contract below. General client workspaces, members and invitations remain incomplete. Standalone Firebase delivery is not configured by this installer.

## Build and install

Use an authorized checkout and Node.js 24 on Linux/WSL. Build on the maintainer's laptop, not in GitHub Actions:

```sh
git archive --format=tar --output=/tmp/openhubpanel-source.tar HEAD
OPENHUB_BASE_PATH=/openhub bash scripts/build-linux-release.sh \
  /tmp/openhubpanel-source.tar /tmp/openhubpanel-release.tar.gz
```

Transfer the archive, verify its SHA-256 and unpack it into a read-only release directory such as `/opt/openhubpanel/release`. It includes Node, notices, application, connector modules, bootstrap/backup tools and `setup.mjs`.

An administrator creates the dedicated service account and private directory; run setup as that unprivileged account:

```sh
sudo useradd --system --home-dir /var/lib/openhubpanel --create-home \
  --shell /usr/sbin/nologin openhubpanel
sudo install -d -m 700 -o openhubpanel -g openhubpanel /var/lib/openhubpanel
sudo -u openhubpanel /opt/openhubpanel/release/runtime/node \
  /opt/openhubpanel/release/setup.mjs \
  --origin=https://panel.example.com --email=owner@example.com \
  --state=/var/lib/openhubpanel
```

Setup requires Linux, a non-root account and a new state directory. It refuses existing accounts/keys, writes private `operator.env`, independent `backup.env`, an empty database and an HTTPS Nginx include, then prints the start command and one-use fifteen-minute activation link. It never assigns a password or enrolls an authenticator. The build prefix comes from `BUILD_BASE_PATH`; the default loopback listener is port 3047 (`--port=...` selects another unprivileged port).

Configure a valid TLS certificate and include the generated `nginx.conf` inside the matching HTTPS server. Keep the upstream loopback-only. If a CDN/proxy precedes Nginx, configure only its authenticated transport ranges before using client-IP restrictions. Do not trust arbitrary forwarding headers. The example preserves nonce CSP and prevents CDN HTML transformation.

Run the printed command to verify startup, then install a systemd service:

```ini
[Unit]
Description=OpenHubPanel
After=network.target

[Service]
Type=simple
User=openhubpanel
Group=openhubpanel
WorkingDirectory=/opt/openhubpanel/release
EnvironmentFile=/var/lib/openhubpanel/operator.env
ExecStart=/opt/openhubpanel/release/runtime/node /opt/openhubpanel/release/apps/web/server.js
Restart=on-failure
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/var/lib/openhubpanel
UMask=0077

[Install]
WantedBy=multi-user.target
```

If the initial link expires before HTTPS is ready, run `operator-bootstrap.mjs` with `--env-file=/var/lib/openhubpanel/operator.env` as the service user. It rotates an unclaimed link and refuses replacing an enrolled owner.

## First use

1. Activate the account: remembered animal, username, password of at least six characters and optional Google Authenticator. Enabled MFA is required at every sign-in.
2. Open **Add application**, enter a unique lowercase ID, name and optional package/bundle ID and category, then confirm with the current factor/password. Application, settings, audit and replay record commit together.
3. Open **Application details → Connect your application**. Copy `/api/config/{id}` into the real client's configuration integration. Registration does not modify a mobile binary or connect an unrelated backend automatically. Public responses exclude notes and management credentials.
4. Open **Connections** for the built-in application API, external connections and setup steps. A panel shortcut opens the other service and may require its own login; it is not SSO.

## API integration

The implemented [1.0 content contract](../architecture/integrations.md) provides authenticated health, manifest, article list/detail, title changes and operation lookup. Registration requires current owner proof, approval of the HTTPS host and a scoped bearer token. Tokens are encrypted and never returned by list/read APIs. New connections start read-only; title changes require separate owner approval and manifest support.

An intent/audit precedes each write. Stale versions conflict. Unknown results are reconciled by operation ID without repeating a write automatically. The initial interface lists up to 100 articles and changes their titles; it does not generate arbitrary database admin screens.

Transport uses HTTPS/443, validated DNS results, pinned addresses, TLS verification, rejected redirects, five-second DNS/request deadlines and a 256 KiB response limit. Private/reserved addresses are rejected. The existing operator-configured local host connector is a separate exception, not a destination accepted by the form.

Disable locally before revoking the token at the remote service; the UI states that manual revocation step. Remote data remains. Re-adding with a fresh scoped token is the current rotation path. Connection revisions invalidate pending authority after policy changes.

Independent examples:

- [Node.js API](../../examples/content-api/server.mjs): persistent SQLite data, versioned title writes, atomic audit/idempotency and operation lookup.
- [Python API](../../examples/read-only-api/server.py): read-only health, manifest, list/detail and rejected writes using the standard library.

Both require an operator-generated `API_TOKEN` of at least 32 characters, bind loopback (ports 3901/3902) and need HTTPS reverse proxying for a real connection. Node also accepts a private `DATA_FILE`. They illustrate this narrow contract, not general customer isolation.

## Backup and verification

Schedule `operator-backup.mjs` with the generated `backup.env`; protect archives and the independent keys outside Git/releases. Standalone snapshots include application data and encrypted connection credentials. Restore to an independent path revokes sessions/recovery/bootstrap, requires trusted owner re-enrollment and disables restored external connections/writes. Review/reconnect those services. See the [restore runbook](owner-installation.md#recovery-and-encrypted-restore).

Tests cover empty independent storage, atomic registration/audit rollback, credential encryption, read-only/write approval, conflict/replay/reconciliation, private-network/DNS/redirect/size controls and both real local example processes. Production browser fixtures cover activation, first application, public API/private-note exclusion, connections, setup instructions and mobile layout. These are not a completed multi-client P0 or an external operator's setup trial.
