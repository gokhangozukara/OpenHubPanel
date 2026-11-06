# ADR-005: A general admin panel and hub

Status: accepted. Recorded 2026-11-06.

OpenHubPanel is a general management hub for developers, agencies, teams, and clients. It is independent of the maintainer's own applications. **All in one panel.** describes a shared admin interface and a home for connected tools.

P0 includes client workspaces/scoped membership from the foundation. A language-independent HTTP/JSON contract connects two independent examples without core changes. The first supports one controlled real write; the second is read-only. This supersedes the earlier single-organization/read-only release scope.

Link cards, API integration, and external SSO are separate. P0 uses a local session and server service credentials. P1 SSO requires compatible applications and a maintained common provider, not collected external passwords or an invented protocol.

Own-team use is the first planned real pilot; an external developer's setup trial precedes community release. Mobile starts with responsive web. MIT matches the owner's intent for commercial use and voluntary contributions.

Expanded scope adds isolation/integration obligations. It does not authorize live deployment or make the preview production-ready. See [integrations](../architecture/integrations.md) and the [roadmap](../roadmap/implementation.md).
