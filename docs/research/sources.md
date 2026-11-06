# Research sources

Recorded on 2026-11-06. These observations come from local manifests/lockfiles, not recommendations that the recorded versions are current or safe. The remote branch and recorded commit were not reverified during the local review.

## Reference panels

Research copies stay under ignored `.local/reference-panels/`. Deployment URLs, server paths, credentials, and concrete security findings remain in private local notes.

| Observation             | Existing customized panel | Upstream reference |
| ----------------------- | ------------------------- | ------------------ |
| Package                 | `swzhub-admin`            | Studio Admin       |
| Package version         | `2.2.0`                   | `2.2.0`            |
| Next.js                 | `16.3.5`                  | `16.4.5`           |
| React                   | `19.3.0`                  | `19.3.1`           |
| Shadcn package          | `4.21.0`                  | `4.23.0`           |
| Tailwind manifest range | `^4.1.5`                  | `^4.1.5`           |
| Tailwind lockfile       | `4.3.3`                   | `4.3.4`            |

The upstream project is `arhamkhnz/next-shadcn-admin-dashboard`. Initial research identified commit `05b2b927f556e0dce18c9023afa23f8219f39c93`, dated `2026-11-06T10:36:05+05:30`, titled `feat: add upcoming dashboards to sidebar`, MIT, and no release tag. These are historical notes, not fresh remote verification. The customized copy had no Git history.

A local recount found 403 regular files in the customized copy and 391 upstream, including hidden files. Of 334 shared relative paths, 329 differed at byte level. Counts alone do not establish customization quality/extent. An earlier count of 362 had no documented scope and was replaced.

The customized panel included social tools, meeting monitoring, QR codes, activity/settings screens, localization, auth/session APIs, MySQL, and media configuration/upload routes.

These copies explain existing workflows; their code/theme/updates are not transferred into OpenHubPanel. Original licenses stay with the copies. Current OpenHubPanel versions are pinned in its own manifests/lockfile; installed metadata is in [dependency-licenses.json](../dependency-licenses.json).
