# Source and product release checklist

The repository is **private**. Keep it private until Gokhan Gozukara explicitly requests public visibility. Source preparation/commits do not authorize opening it. Deployment is a separate milestone.

## Before sharing source

- [x] Repository/product: `gokhangozukara/OpenHubPanel`.
- [x] MIT with `2026 Gokhan Gozukara`; owner/contact in README/security policy.
- [x] Early-development status and synthetic preview separate from production.
- [x] Local research, private findings, credentials, runtime env, backups, generated artifacts excluded from Git/Docker.
- [x] Locked dependencies, license inventory, minimal CI permissions, SHA-pinned actions.
- [x] Recheck final staged content and full history with Gitleaks; retain only exact justified false positives.
- [x] Verify English names/code/comments/docs and relative links. Translated copy belongs in interface catalogs.
- [x] Review screenshots/examples for private data and misleading claims.
- [ ] Configure branch review protections and release policy for current visibility/account features.
- [x] Recheck GitHub vulnerability-reporting availability before opening; private email is established.
- [ ] Wait for the owner's explicit instruction before public visibility.

Ignore rules do not remove tracked files or historical secrets. Revoke/rotate exposed secrets first, then review history/artifacts. Share reviewed Git content, not a ZIP of the research working directory.

## Before application deployment

Complete phase 8: negative/race tests, dependency/container scans, keys, encrypted backup/measured restore, rollback/upgrade, operating responsibilities, narrow real pilot. Close critical/high findings.

Open decisions include email provider/domain, authentication acceptance, manual recovery owner, retention approval, and backup targets. See [implementation](implementation.md), [security](../architecture/security.md), and [status](../../PROJECT_STATUS.md). Source availability does not prove production readiness.
