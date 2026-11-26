CREATE TABLE workspace_connections (
  workspace_id uuid NOT NULL,
  id uuid NOT NULL,
  application_id uuid NOT NULL,
  name text NOT NULL,
  url text NOT NULL,
  secret text NOT NULL,
  manifest jsonb NOT NULL DEFAULT '{}',
  write_enabled boolean NOT NULL DEFAULT false,
  disabled boolean NOT NULL DEFAULT false,
  revision uuid NOT NULL,
  checked_at timestamptz,
  status text NOT NULL DEFAULT 'unchecked',
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(workspace_id,id),
  FOREIGN KEY(workspace_id,application_id) REFERENCES applications(workspace_id,id)
);
CREATE TABLE connection_operations (
  workspace_id uuid NOT NULL,
  connection_id uuid NOT NULL,
  id uuid NOT NULL,
  remote_key uuid NOT NULL UNIQUE,
  actor_id uuid NOT NULL REFERENCES users(id),
  session_hash text NOT NULL,
  payload_hash text NOT NULL,
  state text NOT NULL CHECK(state IN ('pending','dispatched','completed','conflict','unknown')),
  result jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(workspace_id,connection_id,id),
  FOREIGN KEY(workspace_id,connection_id) REFERENCES workspace_connections(workspace_id,id)
);
ALTER TABLE workspace_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_connections FORCE ROW LEVEL SECURITY;
CREATE POLICY connection_read ON workspace_connections FOR SELECT USING (
  workspace_id=current_workspace_id() AND workspace_role(workspace_id) IS NOT NULL
);
CREATE POLICY connection_insert ON workspace_connections FOR INSERT WITH CHECK (
  workspace_id=current_workspace_id() AND workspace_role(workspace_id) IN ('owner','admin')
);
CREATE POLICY connection_update ON workspace_connections FOR UPDATE USING (
  workspace_id=current_workspace_id() AND workspace_role(workspace_id) IN ('owner','admin')
) WITH CHECK(workspace_id=current_workspace_id() AND workspace_role(workspace_id) IN ('owner','admin'));
-- Read-only status is recorded separately by an audited helper; editors cannot expand write scope.
GRANT SELECT,INSERT,UPDATE ON workspace_connections TO openhub_app;
ALTER TABLE connection_operations ENABLE ROW LEVEL SECURITY;
ALTER TABLE connection_operations FORCE ROW LEVEL SECURITY;
CREATE POLICY operation_actor ON connection_operations USING (
  workspace_id=current_workspace_id() AND actor_id=current_actor_id() AND workspace_role(workspace_id) IN ('owner','admin','editor')
) WITH CHECK(workspace_id=current_workspace_id() AND actor_id=current_actor_id() AND workspace_role(workspace_id) IN ('owner','admin','editor'));
GRANT SELECT,INSERT,UPDATE ON connection_operations TO openhub_app;
