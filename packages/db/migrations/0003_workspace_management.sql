-- A non-login policy helper can inspect memberships without recursive RLS.
-- The web login never owns tables, inherits this role, or receives BYPASSRLS.
DO $$ BEGIN
  IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='openhub_policy') THEN
    CREATE ROLE openhub_policy NOLOGIN NOSUPERUSER BYPASSRLS;
  END IF;
END $$;
GRANT USAGE ON SCHEMA public TO openhub_policy;
GRANT SELECT ON workspace_memberships, workspaces TO openhub_policy;
CREATE FUNCTION workspace_role(scope uuid) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER
  SET search_path=pg_catalog,public AS $$
  SELECT role FROM public.workspace_memberships
  WHERE workspace_id=scope AND user_id=public.current_actor_id() AND active
    AND EXISTS(SELECT 1 FROM hub_identity.accounts a WHERE a.id=public.current_actor_id() AND a.active)
$$;
ALTER FUNCTION workspace_role(uuid) OWNER TO openhub_policy;
REVOKE ALL ON FUNCTION workspace_role(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION workspace_role(uuid) TO openhub_app;

DROP POLICY own_membership ON workspace_memberships;
CREATE POLICY member_read ON workspace_memberships FOR SELECT USING (
  (user_id=current_actor_id() AND workspace_id=current_workspace_id() AND active AND workspace_role(workspace_id) IS NOT NULL) OR
  (workspace_id=current_workspace_id() AND workspace_role(workspace_id) IN ('owner','admin'))
);
CREATE POLICY member_insert ON workspace_memberships FOR INSERT WITH CHECK (
  workspace_id=current_workspace_id() AND
  (workspace_role(workspace_id)='owner' OR
    (workspace_role(workspace_id)='admin' AND role IN ('editor','viewer')))
);
CREATE POLICY member_update ON workspace_memberships FOR UPDATE USING (
  workspace_id=current_workspace_id() AND
  (workspace_role(workspace_id)='owner' OR
    (workspace_role(workspace_id)='admin' AND role IN ('editor','viewer')))
) WITH CHECK (
  workspace_id=current_workspace_id() AND
  (workspace_role(workspace_id)='owner' OR
    (workspace_role(workspace_id)='admin' AND role IN ('editor','viewer')))
);
GRANT INSERT, UPDATE ON workspace_memberships TO openhub_app;

CREATE FUNCTION list_own_workspaces() RETURNS TABLE(id uuid,name text,role text)
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
  SELECT w.id,w.name,m.role FROM public.workspace_memberships m JOIN public.workspaces w ON w.id=m.workspace_id
  WHERE m.user_id=public.current_actor_id() AND m.active
    AND EXISTS(SELECT 1 FROM hub_identity.accounts a WHERE a.id=m.user_id AND a.active) ORDER BY m.created_at,w.id
$$;
ALTER FUNCTION list_own_workspaces() OWNER TO openhub_policy;
REVOKE ALL ON FUNCTION list_own_workspaces() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION list_own_workspaces() TO openhub_app;

GRANT SELECT ON users TO openhub_policy;
CREATE FUNCTION workspace_member_identities(scope uuid) RETURNS TABLE(user_id uuid,display_name text,role text,active boolean)
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
  SELECT m.user_id,u.display_name,m.role,m.active FROM public.workspace_memberships m JOIN public.users u ON u.id=m.user_id
  WHERE m.workspace_id=scope AND scope=public.current_workspace_id()
    AND public.workspace_role(scope) IN ('owner','admin') ORDER BY m.created_at,m.user_id
$$;
GRANT EXECUTE ON FUNCTION workspace_role(uuid) TO openhub_policy;
ALTER FUNCTION workspace_member_identities(uuid) OWNER TO openhub_policy;
REVOKE ALL ON FUNCTION workspace_member_identities(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION workspace_member_identities(uuid) TO openhub_app;

CREATE FUNCTION protect_last_owner() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
  SET search_path=pg_catalog,public AS $$
BEGIN
  PERFORM id FROM public.workspaces WHERE id=OLD.workspace_id FOR UPDATE;
  IF OLD.active AND OLD.role='owner' AND (NOT NEW.active OR NEW.role<>'owner') AND
    NOT EXISTS (SELECT 1 FROM public.workspace_memberships WHERE workspace_id=OLD.workspace_id
      AND user_id<>OLD.user_id AND active AND role='owner') THEN
    RAISE EXCEPTION 'LAST_OWNER';
  END IF;
  RETURN NEW;
END $$;
GRANT UPDATE ON workspaces TO openhub_policy;
ALTER FUNCTION protect_last_owner() OWNER TO openhub_policy;
REVOKE ALL ON FUNCTION protect_last_owner() FROM PUBLIC;
CREATE TRIGGER last_owner BEFORE UPDATE ON workspace_memberships FOR EACH ROW EXECUTE FUNCTION protect_last_owner();

CREATE POLICY workspace_update ON workspaces FOR UPDATE USING (
  id=current_workspace_id() AND workspace_role(id)='owner'
) WITH CHECK (id=current_workspace_id() AND workspace_role(id)='owner');
GRANT UPDATE ON workspaces TO openhub_app;

ALTER TABLE applications ADD COLUMN archived boolean NOT NULL DEFAULT false;
ALTER TABLE applications ADD COLUMN panel_url text;
CREATE POLICY app_insert ON applications FOR INSERT WITH CHECK (
  workspace_id=current_workspace_id() AND workspace_role(workspace_id) IN ('owner','admin')
);
CREATE POLICY app_update ON applications FOR UPDATE USING (
  workspace_id=current_workspace_id() AND workspace_role(workspace_id) IN ('owner','admin')
) WITH CHECK (workspace_id=current_workspace_id() AND workspace_role(workspace_id) IN ('owner','admin'));
GRANT INSERT, UPDATE ON applications TO openhub_app;

ALTER TABLE audit_events ADD COLUMN outcome text NOT NULL DEFAULT 'success' CHECK(outcome IN ('success','denied','unknown','conflict'));
ALTER TABLE audit_events ADD COLUMN changes jsonb NOT NULL DEFAULT '{}';

CREATE FUNCTION create_workspace(workspace uuid, title text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER
  SET search_path=pg_catalog,public AS $$
DECLARE actor uuid := public.current_actor_id();
BEGIN
  IF actor IS NULL THEN RAISE EXCEPTION 'UNAUTHENTICATED'; END IF;
  INSERT INTO public.workspaces(id,name) VALUES(workspace,title);
  INSERT INTO public.workspace_memberships(workspace_id,user_id,role) VALUES(workspace,actor,'owner');
  INSERT INTO public.audit_events(workspace_id,id,actor_id,action,target_id)
    VALUES(workspace,workspace,actor,'workspace.created',workspace::text);
  RETURN workspace;
END $$;
GRANT INSERT ON workspaces,workspace_memberships,audit_events TO openhub_policy;
ALTER FUNCTION create_workspace(uuid,text) OWNER TO openhub_policy;
REVOKE ALL ON FUNCTION create_workspace(uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION create_workspace(uuid,text) TO openhub_app;

CREATE TABLE workspace_invitations (
  workspace_id uuid NOT NULL REFERENCES workspaces(id),
  id uuid NOT NULL,
  email text NOT NULL,
  role text NOT NULL CHECK(role IN ('admin','editor','viewer')),
  inviter_id uuid NOT NULL REFERENCES users(id),
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL DEFAULT now()+interval '24 hours',
  cancelled boolean NOT NULL DEFAULT false,
  accepted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(workspace_id,id)
);
ALTER TABLE workspace_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_invitations FORCE ROW LEVEL SECURITY;
CREATE POLICY invitation_manage ON workspace_invitations USING (
  workspace_id=current_workspace_id() AND workspace_role(workspace_id) IN ('owner','admin')
) WITH CHECK (
  workspace_id=current_workspace_id() AND inviter_id=current_actor_id() AND
  (workspace_role(workspace_id)='owner' OR (workspace_role(workspace_id)='admin' AND role IN ('editor','viewer')))
);
GRANT SELECT,INSERT,UPDATE ON workspace_invitations TO openhub_app;

-- A bearer invitation can be inspected during enrollment but never enumerated globally.
GRANT SELECT, UPDATE ON workspace_invitations TO openhub_policy;
CREATE FUNCTION invitation_lookup(proof text) RETURNS TABLE(workspace_id uuid,id uuid,email text,role text,inviter_id uuid)
  LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
  SELECT i.workspace_id,i.id,i.email,i.role,i.inviter_id FROM public.workspace_invitations i
  WHERE i.token_hash=proof AND NOT i.cancelled AND NOT i.accepted AND i.expires_at>now()
  AND EXISTS(SELECT 1 FROM public.workspace_memberships m WHERE m.workspace_id=i.workspace_id
    AND m.user_id=i.inviter_id AND m.active AND (m.role='owner' OR (m.role='admin' AND i.role IN ('editor','viewer')))
    AND EXISTS(SELECT 1 FROM hub_identity.accounts a WHERE a.id=m.user_id AND a.active))
$$;
ALTER FUNCTION invitation_lookup(text) OWNER TO openhub_policy;
REVOKE ALL ON FUNCTION invitation_lookup(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION invitation_lookup(text) TO openhub_app;

GRANT USAGE ON SCHEMA hub_identity TO openhub_policy;
GRANT SELECT ON hub_identity.accounts,hub_identity.factors TO openhub_policy;
CREATE FUNCTION accept_invitation(proof text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER
  SET search_path=pg_catalog,public AS $$
DECLARE invitation public.workspace_invitations; actor uuid:=public.current_actor_id(); address text;
BEGIN
  SELECT email INTO address FROM hub_identity.accounts a WHERE a.id=actor AND a.active
    AND EXISTS(SELECT 1 FROM hub_identity.factors f WHERE f.user_id=actor);
  IF address IS NULL THEN RAISE EXCEPTION 'UNAUTHENTICATED'; END IF;
  SELECT * INTO invitation FROM public.workspace_invitations WHERE token_hash=proof FOR UPDATE;
  IF NOT FOUND OR invitation.email<>address OR invitation.cancelled OR invitation.accepted OR invitation.expires_at<=now()
    THEN RAISE EXCEPTION 'INVALID_INVITATION'; END IF;
  PERFORM id FROM public.workspaces WHERE id=invitation.workspace_id FOR UPDATE;
  IF NOT EXISTS(SELECT 1 FROM public.workspace_memberships m WHERE m.workspace_id=invitation.workspace_id
    AND m.user_id=invitation.inviter_id AND m.active AND
    (m.role='owner' OR (m.role='admin' AND invitation.role IN ('editor','viewer')))
    AND EXISTS(SELECT 1 FROM hub_identity.accounts a WHERE a.id=m.user_id AND a.active))
    THEN RAISE EXCEPTION 'INVALID_INVITATION'; END IF;
  IF EXISTS(SELECT 1 FROM public.workspace_memberships WHERE workspace_id=invitation.workspace_id AND user_id=actor AND active)
    THEN RAISE EXCEPTION 'ALREADY_MEMBER'; END IF;
  INSERT INTO public.workspace_memberships(workspace_id,user_id,role) VALUES(invitation.workspace_id,actor,invitation.role)
    ON CONFLICT(workspace_id,user_id) DO UPDATE SET active=true,role=excluded.role;
  UPDATE public.workspace_invitations SET accepted=true WHERE id=invitation.id AND workspace_id=invitation.workspace_id;
  INSERT INTO public.audit_events(workspace_id,id,actor_id,action,target_id)
    VALUES(invitation.workspace_id,invitation.id,actor,'invitation.accepted',invitation.id::text);
  RETURN invitation.workspace_id;
END $$;
GRANT UPDATE ON workspace_memberships TO openhub_policy;
ALTER FUNCTION accept_invitation(text) OWNER TO openhub_policy;
REVOKE ALL ON FUNCTION accept_invitation(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION accept_invitation(text) TO openhub_app;

CREATE FUNCTION lock_workspace(scope uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER
  SET search_path=pg_catalog,public AS $$
BEGIN
  IF scope<>public.current_workspace_id() OR public.workspace_role(scope) IS NULL THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;
  PERFORM id FROM public.workspaces WHERE id=scope FOR UPDATE;
END $$;
GRANT EXECUTE ON FUNCTION workspace_role(uuid) TO openhub_policy;
ALTER FUNCTION lock_workspace(uuid) OWNER TO openhub_policy;
REVOKE ALL ON FUNCTION lock_workspace(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION lock_workspace(uuid) TO openhub_app;

CREATE FUNCTION invalidate_removed_member_invitations() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
  SET search_path=pg_catalog,public AS $$
BEGIN
  IF OLD.active AND NOT NEW.active THEN
    UPDATE public.workspace_invitations SET cancelled=true WHERE workspace_id=NEW.workspace_id AND
      email=(SELECT email FROM hub_identity.accounts WHERE id=NEW.user_id);
  END IF;
  RETURN NEW;
END $$;
ALTER FUNCTION invalidate_removed_member_invitations() OWNER TO openhub_policy;
REVOKE ALL ON FUNCTION invalidate_removed_member_invitations() FROM PUBLIC;
CREATE TRIGGER invalidate_member_invitations AFTER UPDATE ON workspace_memberships
  FOR EACH ROW EXECUTE FUNCTION invalidate_removed_member_invitations();

CREATE TABLE ownership_transfers (
  workspace_id uuid PRIMARY KEY REFERENCES workspaces(id),
  owner_id uuid NOT NULL REFERENCES users(id),
  target_id uuid NOT NULL REFERENCES users(id),
  expires_at timestamptz NOT NULL DEFAULT now()+interval '24 hours',
  accepted boolean NOT NULL DEFAULT false,
  CHECK(owner_id<>target_id)
);
ALTER TABLE ownership_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE ownership_transfers FORCE ROW LEVEL SECURITY;
CREATE POLICY transfer_read ON ownership_transfers FOR SELECT USING (
  workspace_id=current_workspace_id() AND workspace_role(workspace_id) IS NOT NULL
  AND (owner_id=current_actor_id() OR target_id=current_actor_id())
);
CREATE POLICY transfer_insert ON ownership_transfers FOR INSERT WITH CHECK (
  workspace_id=current_workspace_id() AND workspace_role(workspace_id)='owner' AND owner_id=current_actor_id()
);
CREATE POLICY transfer_update ON ownership_transfers FOR UPDATE USING (
  workspace_id=current_workspace_id() AND workspace_role(workspace_id)='owner' AND owner_id=current_actor_id()
) WITH CHECK(workspace_id=current_workspace_id() AND workspace_role(workspace_id)='owner' AND owner_id=current_actor_id());
GRANT SELECT,INSERT,UPDATE ON ownership_transfers TO openhub_app;
GRANT SELECT,UPDATE ON ownership_transfers TO openhub_policy;
CREATE FUNCTION accept_ownership(scope uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER
  SET search_path=pg_catalog,public AS $$
DECLARE transfer public.ownership_transfers; actor uuid:=public.current_actor_id();
BEGIN
  PERFORM public.lock_workspace(scope);
  SELECT * INTO transfer FROM public.ownership_transfers WHERE workspace_id=scope FOR UPDATE;
  IF NOT FOUND OR transfer.accepted OR transfer.expires_at<=now() OR transfer.target_id<>actor
    OR NOT EXISTS(SELECT 1 FROM public.workspace_memberships WHERE workspace_id=scope AND user_id=transfer.owner_id AND active AND role='owner')
    OR NOT EXISTS(SELECT 1 FROM hub_identity.accounts WHERE id=transfer.owner_id AND active)
    OR NOT EXISTS(SELECT 1 FROM hub_identity.factors WHERE user_id=actor)
    THEN RAISE EXCEPTION 'INVALID_TRANSFER'; END IF;
  UPDATE public.workspace_memberships SET role='owner' WHERE workspace_id=scope AND user_id=actor AND active;
  UPDATE public.workspace_memberships SET role='admin' WHERE workspace_id=scope AND user_id=transfer.owner_id;
  UPDATE public.ownership_transfers SET accepted=true WHERE workspace_id=scope;
  INSERT INTO public.audit_events(workspace_id,id,actor_id,action,target_id)
    VALUES(scope,gen_random_uuid(),actor,'ownership.accepted',actor::text);
END $$;
GRANT EXECUTE ON FUNCTION lock_workspace(uuid) TO openhub_policy;
ALTER FUNCTION accept_ownership(uuid) OWNER TO openhub_policy;
REVOKE ALL ON FUNCTION accept_ownership(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION accept_ownership(uuid) TO openhub_app;
