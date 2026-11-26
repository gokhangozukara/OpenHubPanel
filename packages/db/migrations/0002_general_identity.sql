-- Separate general-product identity. The single-owner SQLite adapter is unchanged.
CREATE SCHEMA hub_identity;
REVOKE ALL ON SCHEMA hub_identity FROM PUBLIC;
GRANT USAGE ON SCHEMA hub_identity TO openhub_app;

CREATE TABLE hub_identity.accounts (
  id uuid PRIMARY KEY REFERENCES public.users(id),
  email text NOT NULL UNIQUE CHECK (email = lower(email)),
  password_hash text NOT NULL,
  active boolean NOT NULL DEFAULT true
);
CREATE TABLE hub_identity.factors (
  user_id uuid PRIMARY KEY REFERENCES hub_identity.accounts(id),
  secret text NOT NULL,
  last_step bigint NOT NULL DEFAULT -1
);
CREATE TABLE hub_identity.bootstrap (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  token_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  consumed boolean NOT NULL DEFAULT false
);
CREATE TABLE hub_identity.challenges (
  hash text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES hub_identity.accounts(id),
  purpose text NOT NULL CHECK (purpose IN ('login','enroll','recovery')),
  secret text,
  browser_hash text NOT NULL,
  expires_at timestamptz NOT NULL DEFAULT now() + interval '5 minutes',
  attempts integer NOT NULL DEFAULT 0,
  consumed boolean NOT NULL DEFAULT false
);
CREATE TABLE hub_identity.sessions (
  hash text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES hub_identity.accounts(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  seen_at timestamptz NOT NULL DEFAULT now(),
  revoked boolean NOT NULL DEFAULT false
);
CREATE TABLE hub_identity.recovery_codes (
  user_id uuid NOT NULL REFERENCES hub_identity.accounts(id),
  hash text NOT NULL,
  PRIMARY KEY (user_id, hash)
);
CREATE TABLE hub_identity.rate_limits (
  key text PRIMARY KEY,
  count integer NOT NULL,
  until_at timestamptz NOT NULL
);
CREATE TABLE hub_identity.security_events (
  id uuid PRIMARY KEY,
  user_id uuid REFERENCES hub_identity.accounts(id),
  action text NOT NULL,
  outcome text NOT NULL CHECK (outcome IN ('success','denied')),
  created_at timestamptz NOT NULL DEFAULT now()
);
-- Identity access is server-only; never expose arbitrary SQL or account rows to a client.
GRANT SELECT, INSERT, UPDATE, DELETE ON hub_identity.accounts, hub_identity.factors,
  hub_identity.challenges, hub_identity.sessions, hub_identity.recovery_codes,
  hub_identity.rate_limits TO openhub_app;
GRANT SELECT, INSERT, UPDATE ON hub_identity.bootstrap TO openhub_app;
GRANT INSERT ON hub_identity.security_events TO openhub_app;
GRANT INSERT ON users TO openhub_app;
CREATE POLICY identity_registration ON users FOR INSERT WITH CHECK (id = current_actor_id());
