# Source and product release checklist

The repository is **public** as of `v0.1.0` following explicit authorization by Gokhan Gozukara. Source availability is separate from production deployment readiness.

## Before sharing source

- [x] Repository/product: `gokhangozukara/OpenHubPanel`.
- [x] MIT with `2026 Gokhan Gozukara`; owner/contact in README/security policy.
- [x] Early-development status and synthetic preview separate from production.
- [x] Local research, private findings, credentials, runtime env, backups, generated artifacts excluded from Git/Docker.
- [x] Locked dependencies, license inventory, minimal CI permissions, SHA-pinned actions.
- [x] Recheck final staged content and full history with Gitleaks; retain only exact justified false positives.
- [x] Verify English names/code/comments/docs and relative links. Translated copy belongs in interface catalogs.
- [x] Review screenshots/examples for private data and misleading claims.
- [x] Configure release policy and CI gates for public visibility.
- [x] Enable GitHub private vulnerability reporting alongside the maintainer security email.
- [x] Owner's explicit instruction received for public visibility (`v0.1.0`).

Ignore rules do not remove tracked files or historical secrets. Revoke/rotate exposed secrets first, then review history/artifacts. Share reviewed Git content, not a ZIP of the research working directory.

## Before application deployment

Complete phase 8: negative/race tests, dependency/container scans, keys, encrypted backup/measured restore, rollback/upgrade, operating responsibilities, narrow real pilot. Close critical/high findings.

Open decisions include email provider/domain, authentication acceptance, manual recovery owner, retention approval, and backup targets. See [implementation](implementation.md), [security](../architecture/security.md), and [status](../../PROJECT_STATUS.md). Source availability does not prove production readiness.
