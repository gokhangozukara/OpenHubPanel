# Authentication candidate review

Reviewed: 2026-11-06. Candidate: Better Auth 1.7.18, confirmed against the npm registry and upstream release tag. This is a source/documentation assessment, not an integration acceptance test. The package is not installed or exposed through application routes.

## Decision

Do not mount the default two-factor plugin as OpenHubPanel's authentication service. It offers useful functionality, but its default lifecycle does not satisfy our mandatory TOTP and restricted-recovery contract. This is a product-policy mismatch, not a claim of an upstream vulnerability.

## Observations

The official [password documentation](https://better-auth.com/docs/authentication/email-password) describes scrypt hashing and configurable password functions. OpenHubPanel requires a tested Argon2id adapter, at least 15 characters, and compromised-password checks.

The [two-factor documentation](https://better-auth.com/docs/plugins/2fa) exposes password-authorized factor disablement, trusted devices that skip subsequent MFA challenges, and backup-code verification that can establish a session. All three need server-enforced restrictions here. Client options such as `disableSession` cannot establish a security boundary. Email/SMS factors must not become substitutes for required TOTP.

In the pinned [TOTP handler](https://github.com/better-auth/better-auth/blob/v1.7.18/packages/better-auth/src/plugins/two-factor/totp/index.ts), successful verification checks the code and proceeds to session/enrollment handling. The corresponding [schema](https://github.com/better-auth/better-auth/blob/v1.7.18/packages/better-auth/src/plugins/two-factor/schema.ts) contains attempt/lockout state but no persisted last-accepted TOTP step. These files do not establish our atomic, cross-challenge replay guard. An integration must prove that guard with concurrent requests, not infer it from per-challenge consumption.

The [backup-code implementation](https://github.com/better-auth/better-auth/blob/v1.7.18/packages/better-auth/src/plugins/two-factor/backup-codes/index.ts) defaults to ten alphanumeric characters per code, below our 128-bit requirement even under a uniform 62-character alphabet. Its storage interface supports recoverable codes; our design requires one-way hashes, generation-only display, and transactional single use. Calling its default recovery endpoint is therefore insufficient.

## Required acceptance work

Before choosing an adapter or replacement, demonstrate:

1. Operator-only bootstrap with atomic closure, expiry, and concurrent-use tests.
2. Password verification followed by a restricted pre-session; no management access until TOTP completes.
3. Atomic TOTP-step replay rejection across separate challenges and servers.
4. Recovery that permits only replacement-factor enrollment, with hashed high-entropy codes and session revocation.
5. Required MFA with no disable/trusted-device bypass, including direct HTTP calls.
6. Account/IP limits that fail closed during Redis outages and do not reset on new challenges.
7. State changes and success audit in one transaction; failure events survive business rollback.
8. Server session expiry/revocation checked on every protected operation.

A collection of before/after hooks is not acceptance evidence. Prefer a small, testable integration over maintaining a fork. If the candidate cannot express the lifecycle cleanly, evaluate another maintained implementation before adding public authentication routes. Existing management endpoints remain unavailable.

## Browser prerequisite delivered

The web proxy now creates a fresh 256-bit nonce per response, replaces incoming nonce/policy headers, and supplies the policy to Next.js rendering. Production permits neither generic inline scripts nor eval. Dynamic pages are not shared-cacheable. Four production Chromium checks run against the standalone build, including parser-injected script rejection and successful hydration. Development keeps only the framework-required eval/style exceptions. This control reduces script-injection exposure; it does not implement identity or authorization.
