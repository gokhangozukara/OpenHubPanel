# ADR-008: Owner-selected sign-in protection

Status: accepted, 2026-11-07, explicit owner instructions. This supersedes the previous mandatory-TOTP and fifteen-character rules for the live installation.

The minimum password length is six characters. Keep Argon2id, password compromise checking, session expiry, revocation and request controls.

Sign-in starts with eight illustrated animal choices: camel, duck, lion, fox, panda, owl, rabbit and turtle. The owner selects their remembered character during activation/settings. A wrong selection cannot access password verification. A correct selection issues a short-lived, server-stored, IP-bound permission; direct password requests without it are rejected before password checking. Limit failed choices and expire/consume permissions. This is an additional sign-in gate.

The next step is username and password. Google Authenticator/TOTP is optional at the owner's discretion. When enabled, require it for every sign-in, without trusted-device skipping. Enabling verifies a newly enrolled factor; disabling requires the current password and current factor. Recovery retains its restricted-enrollment semantics for enabled factors.

Allow the owner to configure IPv4/IPv6 addresses and CIDR ranges in sign-in settings. Obtain the address only from the configured reverse proxy, trusting Cloudflare address headers only when the transport peer belongs to Cloudflare's published ranges. Enforce current allowlists on sign-in and every protected request. Reject a settings change that would exclude the current IP. Policy changes revoke existing sessions and pending sign-in permissions. Trusted-console recovery remains the way to recover from a changed/lost network address.

Configuration saves use current TOTP when enabled, or current-password confirmation otherwise. Sign-in protection settings always require the current password and, when currently enabled, TOTP. Existing general-product roadmap claims remain incomplete; this decision does not turn the single-owner adapter into a multi-client identity system.
