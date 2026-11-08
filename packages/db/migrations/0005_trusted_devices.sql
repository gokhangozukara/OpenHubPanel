CREATE TABLE hub_identity.trusted_devices (
  hash text PRIMARY KEY CHECK (hash ~ '^[a-f0-9]{64}$'),
  user_id uuid NOT NULL REFERENCES hub_identity.accounts(id) ON DELETE CASCADE,
  browser_hash text NOT NULL,
  factor_hash text NOT NULL,
  password_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT now()+interval '30 days',
  revoked boolean NOT NULL DEFAULT false,
  UNIQUE (user_id,browser_hash),
  CHECK (expires_at>created_at AND expires_at<=created_at+interval '30 days')
);
-- A device token authorizes only the sign-in factor exception, never a session by itself.
GRANT SELECT, INSERT, UPDATE, DELETE ON hub_identity.trusted_devices TO openhub_app;
