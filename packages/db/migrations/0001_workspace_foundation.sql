-- Run as migration operator, never as the application role.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'openhub_app') THEN
    CREATE ROLE openhub_app NOLOGIN NOSUPERUSER NOBYPASSRLS;
  END IF;
END $$;

CREATE TABLE users (
  id uuid PRIMARY KEY,
  display_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE workspaces (
  id uuid PRIMARY KEY,
  name text NOT NULL CHECK (length(name) BETWEEN 1 AND 100),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE workspace_memberships (
  workspace_id uuid NOT NULL REFERENCES workspaces(id),
  user_id uuid NOT NULL REFERENCES users(id),
  role text NOT NULL CHECK (role IN ('owner', 'admin', 'editor', 'viewer')),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, user_id)
);
CREATE TABLE applications (
  workspace_id uuid NOT NULL REFERENCES workspaces(id),
  id uuid NOT NULL,
  name text NOT NULL,
  connector_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, id)
);
CREATE TABLE audit_events (
  workspace_id uuid NOT NULL REFERENCES workspaces(id),
  id uuid NOT NULL,
  actor_id uuid NOT NULL REFERENCES users(id),
  application_id uuid,
  action text NOT NULL,
  target_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, id),
  FOREIGN KEY (workspace_id, application_id) REFERENCES applications(workspace_id, id)
);

CREATE FUNCTION current_actor_id() RETURNS uuid LANGUAGE sql STABLE
  SET search_path = pg_catalog
  AS $$ SELECT nullif(current_setting('app.actor_id', true), '')::uuid $$;
CREATE FUNCTION current_workspace_id() RETURNS uuid LANGUAGE sql STABLE
  SET search_path = pg_catalog
  AS $$ SELECT nullif(current_setting('app.workspace_id', true), '')::uuid $$;

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE users FORCE ROW LEVEL SECURITY;
CREATE POLICY own_identity ON users USING (id = current_actor_id());

ALTER TABLE workspace_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_memberships FORCE ROW LEVEL SECURITY;
-- Only the current actor's own membership is exposed at this foundation stage.
-- Member administration is intentionally not granted until its audited use-cases exist.
CREATE POLICY own_membership ON workspace_memberships
  FOR SELECT USING (user_id = current_actor_id() AND workspace_id = current_workspace_id() AND active);

ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspaces FORCE ROW LEVEL SECURITY;
CREATE POLICY workspace_member ON workspaces FOR SELECT USING (
  id = current_workspace_id() AND EXISTS (
    SELECT 1 FROM workspace_memberships m WHERE m.workspace_id = id AND m.user_id = current_actor_id()
  )
);

ALTER TABLE applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE applications FORCE ROW LEVEL SECURITY;
CREATE POLICY app_member_read ON applications FOR SELECT USING (
  workspace_id = current_workspace_id() AND EXISTS (
    SELECT 1 FROM workspace_memberships m WHERE m.workspace_id = applications.workspace_id AND m.user_id = current_actor_id()
  )
);

ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_events FORCE ROW LEVEL SECURITY;
CREATE POLICY audit_reader ON audit_events FOR SELECT USING (
  workspace_id = current_workspace_id() AND EXISTS (
    SELECT 1 FROM workspace_memberships m WHERE m.workspace_id = audit_events.workspace_id
      AND m.user_id = current_actor_id() AND m.role IN ('owner', 'admin')
  )
);
CREATE POLICY audit_writer ON audit_events FOR INSERT WITH CHECK (
  workspace_id = current_workspace_id() AND actor_id = current_actor_id() AND EXISTS (
    SELECT 1 FROM workspace_memberships m WHERE m.workspace_id = audit_events.workspace_id AND m.user_id = current_actor_id()
  )
);

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO openhub_app;
GRANT SELECT ON users, workspaces, workspace_memberships, applications, audit_events TO openhub_app;
GRANT INSERT ON audit_events TO openhub_app;
-- No UPDATE/DELETE on audit, and no production mutation until auth + audited use-cases are implemented.
