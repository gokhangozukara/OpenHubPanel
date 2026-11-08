import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import type { Database } from "@openhubpanel/db";
import { generate, generateSecret } from "otplib";
import { generalAuth } from "./auth";
import { checkGeneralConnections } from "./connections.integration";
import { digest, secretBox, token } from "./crypto";
import { generalWorkspaces } from "./workspaces";

export async function checkGeneralWorkspaces(
  admin: Database,
  app: Database,
  check: (name: string, action: () => Promise<void>) => Promise<void>,
) {
  const key = randomBytes(32).toString("hex");
  const box = secretBox(key);
  const auth = generalAuth(app, key, async () => {});
  const service = generalWorkspaces(app, key);
  const users: {
    id: string;
    role: string;
    session: string;
    secret: string;
    email: string;
    password: string;
  }[] = [];
  for (const role of ["owner", "admin", "editor", "viewer"]) {
    const id = randomUUID();
    const session = token();
    const secret = generateSecret();
    const password = token();
    const email = `${role}@workspace.example.test`;
    await admin`INSERT INTO users(id,display_name) VALUES(${id},${role})`;
    await admin`INSERT INTO hub_identity.accounts(id,email,password_hash) VALUES(${id},${email},${await auth.passwordHash(password)})`;
    await admin`INSERT INTO hub_identity.factors(user_id,secret) VALUES(${id},${box.seal(secret, `factor:${id}`)})`;
    await admin`INSERT INTO hub_identity.sessions(hash,user_id) VALUES(${digest(session)},${id})`;
    users.push({ id, role, session, secret, email, password });
  }
  const owner = users[0];
  const administrator = users[1];
  const editor = users[2];
  const viewer = users[3];
  assert.ok(owner && administrator && editor && viewer);
  const a = await service.create(owner.session, "Workspace A");
  const b = await service.create(viewer.session, "Workspace B");
  for (const user of users.slice(1))
    await admin`INSERT INTO workspace_memberships(workspace_id,user_id,role) VALUES(${a.id},${user.id},${user.role})`;
  async function code(user: (typeof users)[number]) {
    await admin`UPDATE hub_identity.factors SET last_step=-1 WHERE user_id=${user.id}`;
    return generate({ secret: user.secret });
  }
  let applicationA = "";
  let applicationB = "";
  await check("real workspace creation and safe switching use current memberships", async () => {
    applicationA = (await service.application(owner.session, a.id, { name: "Application A" })).id;
    applicationB = (await service.application(viewer.session, b.id, { name: "Application B" })).id;
    assert.equal((await service.list(owner.session)).length, 1);
    assert.equal((await service.list(viewer.session)).length, 2);
    assert.equal((await service.snapshot(viewer.session, a.id)).applications[0]?.id, applicationA);
    assert.equal((await service.snapshot(viewer.session, b.id)).applications[0]?.id, applicationB);
    await assert.rejects(service.snapshot(owner.session, b.id), /FORBIDDEN/);
    await assert.rejects(
      service.application(owner.session, a.id, { id: applicationB, name: "Forged" }),
      /NOT_FOUND/,
    );
    assert.equal(
      (await admin`SELECT name FROM applications WHERE id=${applicationB}`)[0]?.name,
      "Application B",
    );
  });
  await check(
    "four roles enforce application, membership and audit permissions on server and RLS",
    async () => {
      for (const user of users) {
        const snapshot = await service.snapshot(user.session, a.id);
        assert.ok(snapshot.applications.some((application) => application.id === applicationA));
        assert.ok(!snapshot.applications.some((application) => application.id === applicationB));
        assert.equal(snapshot.members.length > 0, ["owner", "admin"].includes(user.role));
        assert.equal(snapshot.events.length > 0, ["owner", "admin"].includes(user.role));
        if (["owner", "admin"].includes(user.role)) {
          const created = await service.application(user.session, a.id, { name: `${user.role} allowed` });
          await service.application(user.session, a.id, { id: created.id, name: "Archived", archived: true });
        } else {
          await assert.rejects(service.application(user.session, a.id, { name: "Denied" }), /FORBIDDEN/);
          await assert.rejects(
            service.scoped(user.session, a.id, "workspace.read", async (tx) => {
              await tx`INSERT INTO applications(workspace_id,id,name,connector_id) VALUES(${a.id},${randomUUID()},'Denied','http')`;
            }),
          );
        }
        await service.scoped(user.session, a.id, "workspace.read", async (tx) => {
          assert.equal((await tx`SELECT * FROM applications WHERE id=${applicationB}`).length, 0);
          assert.equal(
            (await tx`SELECT * FROM workspace_memberships WHERE workspace_id=${b.id} AND user_id=${owner.id}`)
              .length,
            0,
          );
        });
      }
      await assert.rejects(
        service.member(administrator.session, a.id, owner.id, "viewer", true, await code(administrator)),
        /FORBIDDEN/,
      );
      await assert.rejects(
        service.invite(
          administrator.session,
          a.id,
          "escalation@example.test",
          "admin",
          await code(administrator),
        ),
        /FORBIDDEN/,
      );
      await assert.rejects(
        service.transfer(administrator.session, a.id, viewer.id, await code(administrator)),
        /FORBIDDEN/,
      );
    },
  );
  await check(
    "invitations are hashed, single-use and complete new-user password plus TOTP enrollment",
    async () => {
      const invitation = await service.invite(
        owner.session,
        a.id,
        "invited@example.test",
        "editor",
        await code(owner),
      );
      const rows = await admin`SELECT token_hash FROM workspace_invitations WHERE id=${invitation.id}`;
      assert.equal(rows[0]?.token_hash, digest(invitation.token));
      const browser = token();
      const enrollment = await auth.enrollInvitation(invitation.token, token(), browser);
      assert.ok(enrollment.secret);
      await assert.rejects(service.accept(enrollment.challenge, invitation.token), /UNAUTHENTICATED/);
      const result = await auth.complete(
        enrollment.challenge,
        browser,
        await generate({ secret: enrollment.secret }),
      );
      const accepted = await Promise.allSettled([
        service.accept(result.session, invitation.token),
        service.accept(result.session, invitation.token),
      ]);
      assert.equal(accepted.filter((result) => result.status === "fulfilled").length, 1);
      assert.equal((await service.list(result.session))[0]?.id, a.id);
      const snapshot = await service.snapshot(owner.session, a.id);
      assert.ok(!JSON.stringify(snapshot.invitations).includes(invitation.token));
      assert.ok(!JSON.stringify(snapshot.events).includes(invitation.token));
    },
  );
  await check("cancelled, expired, resent and cross-workspace invitations are rejected", async () => {
    const invitation = await service.invite(owner.session, a.id, viewer.email, "editor", await code(owner));
    const resent = await service.invite(
      owner.session,
      a.id,
      viewer.email,
      "editor",
      await code(owner),
      invitation.id,
    );
    assert.equal((await app`SELECT * FROM invitation_lookup(${digest(invitation.token)})`).length, 0);
    await assert.rejects(
      service.cancelInvite(viewer.session, b.id, resent.id, await code(viewer)),
      /FORBIDDEN/,
    );
    await service.cancelInvite(owner.session, a.id, resent.id, await code(owner));
    await assert.rejects(service.accept(viewer.session, resent.token), /INVALID_INVITATION/);
    const expiring = await service.invite(owner.session, a.id, viewer.email, "viewer", await code(owner));
    await admin`UPDATE workspace_invitations SET expires_at=now()-interval '1 second' WHERE id=${expiring.id}`;
    await assert.rejects(service.accept(viewer.session, expiring.token), /INVALID_INVITATION/);
  });
  await check("member changes revoke next-request access and protect the last owner", async () => {
    await service.member(owner.session, a.id, editor.id, "viewer", true, await code(owner));
    assert.equal((await service.snapshot(editor.session, a.id)).role, "viewer");
    await service.member(owner.session, a.id, editor.id, "viewer", false, await code(owner));
    await assert.rejects(service.snapshot(editor.session, a.id), /FORBIDDEN/);
    await assert.rejects(
      service.member(owner.session, a.id, owner.id, "viewer", true, await code(owner)),
      /LAST_OWNER/,
    );
    assert.equal((await service.snapshot(owner.session, a.id)).role, "owner");
    await assert.rejects(
      service.member(owner.session, b.id, viewer.id, "viewer", false, await code(owner)),
      /FORBIDDEN/,
    );
  });
  await check("ownership requires owner offer and recipient acceptance with current TOTP", async () => {
    await service.transfer(owner.session, a.id, viewer.id, await code(owner));
    assert.equal((await service.snapshot(owner.session, a.id)).role, "owner");
    await assert.rejects(
      service.acceptTransfer(administrator.session, a.id, await code(administrator)),
      /INVALID_TRANSFER/,
    );
    await service.acceptTransfer(viewer.session, a.id, await code(viewer));
    assert.equal((await service.snapshot(viewer.session, a.id)).role, "owner");
    assert.equal((await service.snapshot(owner.session, a.id)).role, "admin");
    await assert.rejects(
      service.acceptTransfer(viewer.session, a.id, await code(viewer)),
      /INVALID_TRANSFER/,
    );
  });
  await check(
    "management and audit share one transaction; application login cannot rewrite audit",
    async () => {
      await admin.unsafe(
        "CREATE FUNCTION reject_test_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'AUDIT_UNAVAILABLE'; END $$; CREATE TRIGGER reject_test_audit BEFORE INSERT ON audit_events FOR EACH ROW EXECUTE FUNCTION reject_test_audit()",
      );
      try {
        await assert.rejects(
          service.application(viewer.session, a.id, { name: "Rollback application" }),
          /AUDIT_UNAVAILABLE/,
        );
        await assert.rejects(service.create(viewer.session, "Rollback workspace"), /AUDIT_UNAVAILABLE/);
        assert.equal((await admin`SELECT id FROM applications WHERE name='Rollback application'`).length, 0);
        assert.equal((await admin`SELECT id FROM workspaces WHERE name='Rollback workspace'`).length, 0);
      } finally {
        await admin.unsafe(
          "DROP TRIGGER reject_test_audit ON audit_events; DROP FUNCTION reject_test_audit()",
        );
      }
      await assert.rejects(app`UPDATE audit_events SET action='forged'`);
      await assert.rejects(app`DELETE FROM audit_events`);
      const role = (await app`SELECT rolsuper,rolbypassrls FROM pg_roles WHERE rolname=current_user`)[0];
      assert.equal(role?.rolsuper, false);
      assert.equal(role?.rolbypassrls, false);
      assert.equal((await app`SELECT * FROM applications`).length, 0);
    },
  );
  await checkGeneralConnections(
    admin,
    app,
    check,
    key,
    a.id,
    b.id,
    applicationA,
    applicationB,
    viewer,
    owner,
  );
}
