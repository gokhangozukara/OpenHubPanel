# Interface principles

OpenHubPanel should feel calm, clear, and quick to learn. Keep the product useful before adding decorative dashboards.

The [workspace review](workspace-review.md) records the owner's reference comparison and the current revision: neutral chrome, grouped and collapsible navigation, direct application shortcuts, keyboard search, and combined connection filters. Keep promotional cards out of the daily workspace.

## Structure and behavior

Use clear application identity, an obvious workspace selector, small main navigation, page title/description, and one primary action. The current shell covers overview, applications, team, activity, security, and settings. Small forms/details use accessible dialogs.

Create original layouts, components, and tokens. Reference panels inform workflow questions, not copied themes. Open-source primitives require preserved notices.

- Distinguish loading, empty, filtered, denied, stale, failed, and successful states.
- Explain connection status, last successful check, and whether an action reads or changes data.
- Show honest progress/results: previews are labeled and unknown remote outcomes are not saved.
- Keep wide tables locally scrollable without page overflow on phones.
- Use clear labels, visible focus, logical headings, sufficient contrast, and accessible names. Dialogs support keyboard entry, Escape, and focus return.
- Support light/dark/system themes and reduced motion.

## Language

Source names/comments and documentation are English. User-facing copy lives in English, Turkish, and German catalogs, including notices, errors, placeholders, and accessible labels. Translate whole messages with named placeholders instead of sentence fragments. Preserve proper names and user-entered content.

Language changes preserve screen, workspace, and typed data. Remember selection; otherwise use supported browser preferences, with English fallback. Set HTML language for assistive technology. Test longer German labels at phone widths. Language is never an authorization input.

## Mobile

P0 is responsive web with reliable touch/keyboard navigation, usable tables, and fitting dialogs. A PWA follows pilot evidence; native apps and stores are separate decisions.

## Target screen patterns

Onboarding starts with create workspace → connect application → test connection → invite team → do the first task, rather than an empty dashboard. Keep the active workspace/application visible. Light is the default theme. A collapsible/pinnable sidebar and compact mobile drawer may evolve from the initial shell. Filter navigation by current permissions while enforcing the same rules on the server.

Management pages use title/description, one primary action, search/filters, list/detail, selected-item actions, and explicit loading/empty/error states. Shareable filter/sort/page state belongs in the URL only when safe: never include tokens, OTPs, or sensitive personal search text. Server authorization still applies to shared links.

Forms have concise labels, inline validation, a change summary before save, preserved input after errors, explicit destructive confirmation and undo where practical, and step-up for sensitive changes. Target tables include cursor pagination, optional columns, filtering, selection, sticky headers, mobile alternatives, and keyboard support; broader/bulk features follow their roadmap phase.

Use short toasts for results and a later persistent notification center for lasting warnings. Give security events appropriate severity and offer per-user notification preferences. The overview prioritizes application health, pending work, relevant security events, and system warnings. Start with a simple fixed layout; configurable widgets can follow.

Global search, favorites, recents, and the `Ctrl/Cmd + K` command palette are P1. Search/commands may cover users, roles, apps, settings, audit, and quick actions, with permissions checked again on execution.

Target WCAG 2.2 AA through keyboard flows, visible focus, labels, contrast, announced errors, and reduced motion. Automated checks alone do not establish conformance. Avoid unnecessary client JavaScript, load heavy charts/tables lazily, show skeletons on slow connections, and use optimistic UI only when its outcome is safe.

## Planned first-release screens

Sign-in, factor verification/enrollment, recovery-code display, invitation acceptance, password reset, restricted recovery, overview, workspace creation/switching/members, application connection/testing/troubleshooting, resource list/detail/title update, applications/details, users/details, roles/permissions, audit, sessions, and profile/security settings. These are targets beyond the existing preview.

Connection setup shows technical settings only where needed; daily users see their work. Distinguish link/API/SSO states and offer a synthetic example at onboarding. Recovery screens offer only re-enrollment/logout until the new factor is verified; initial enrollment never asks for a code from a factor that does not exist.
