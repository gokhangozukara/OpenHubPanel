# Initial review brief

This records the review preceding implementation. Read the [report](../research/initial-review.md) and its limits before treating it as evidence.

Review scope, phase dependencies, identity/recovery/sessions, server authorization, workspace boundaries, connector trust, remote effects, audit, release exclusions, and operations. Record contradictions with concrete fixes and acceptance tests. Do not copy reference code or test live deployments.

Separate observations from assumptions. Read versions from manifests/lockfiles, record licenses, and keep deployment findings private. A pattern check is not a full secret/privacy review.

Later decisions take precedence: [ADR-004](../decisions/004-security-review.md) tightens security and [ADR-005](../decisions/005-admin-hub.md) adds client workspaces and a real write to P0. Continue under the [implementation brief](implementation-brief.md).
