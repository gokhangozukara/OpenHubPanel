import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import type { Database } from "@openhubpanel/db";
import { generate } from "otplib";
import { generalAuth } from "./auth";
import { digest, secretBox, token } from "./crypto";

export async function checkGeneralIdentity(
  admin: Database,
  app: Database,
  check: (name: string, action: () => Promise<void>) => Promise<void>,
) {
  const key = randomBytes(32).toString("hex");
  const auth = generalAuth(app, key, async () => {});
  const browser = token();
  const bootstrap = await auth.createBootstrap();
  const email = "first@example.test";
  const password = token();
  let enrollment: Awaited<ReturnType<typeof auth.bootstrap>> | undefined;
  await check("general bootstrap is single-use under concurrent requests", async () => {
    const results = await Promise.allSettled([
      auth.bootstrap(bootstrap, email, password, browser),
      auth.bootstrap(bootstrap, "second@example.test", password, browser),
    ]);
    assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
    const success = results.find((result) => result.status === "fulfilled");
    assert.ok(success?.status === "fulfilled");
    enrollment = success.value;
    assert.equal((await admin`SELECT id FROM hub_identity.accounts`).length, 1);
    await assert.rejects(auth.createBootstrap(), /BOOTSTRAP_CLOSED/);
  });
  assert.ok(enrollment?.secret);
  const account = (await admin`SELECT id,email FROM hub_identity.accounts`)[0];
  assert.ok(account);
  const address = String(account.email);
  const initialCode = await generate({ secret: enrollment.secret });
  let signedIn: Awaited<ReturnType<typeof auth.complete>> | undefined;
  await check("general enrollment requires browser binding and TOTP before management", async () => {
    await assert.rejects(
      auth.within(enrollment?.challenge ?? "", async () => true),
      /UNAUTHENTICATED/,
    );
    await assert.rejects(auth.complete(enrollment?.challenge ?? "", token(), initialCode), /INVALID_CODE/);
    signedIn = await auth.complete(enrollment?.challenge ?? "", browser, initialCode);
    assert.equal(signedIn.recoveryCodes?.length, 8);
    const id = await auth.within(signedIn.session, async (_tx, identity) => identity.userId);
    assert.equal(id, account.id);
    const factors = await admin`SELECT secret FROM hub_identity.factors`;
    assert.notEqual(factors[0]?.secret, enrollment?.secret);
    assert.throws(() => secretBox(key).open(String(factors[0]?.secret), "factor:another-user"));
  });
  assert.ok(signedIn);
  await check("password does not grant a session and replay fails across challenges", async () => {
    await assert.rejects(auth.login(address, token(), browser, "fixture"), /INVALID_CREDENTIALS/);
    const a = await auth.login(address, password, browser, "fixture");
    const b = await auth.login(address, password, browser, "fixture");
    assert.equal(a.phase, "verify");
    await assert.rejects(
      auth.within(a.challenge, async () => true),
      /UNAUTHENTICATED/,
    );
    await assert.rejects(auth.complete(a.challenge, browser, initialCode), /INVALID_CODE/);
    // Reset only fixture replay state to test simultaneous challenges in the current clock step.
    await admin`UPDATE hub_identity.factors SET last_step=-1 WHERE user_id=${account.id}`;
    const results = await Promise.allSettled([
      auth.complete(a.challenge, browser, initialCode),
      auth.complete(b.challenge, browser, initialCode),
    ]);
    assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
  });
  await check("session revocation and idle/absolute expiry take effect on next request", async () => {
    assert.ok(signedIn);
    await auth.revoke(signedIn.session);
    await assert.rejects(
      auth.within(signedIn.session, async () => true),
      /UNAUTHENTICATED/,
    );
    for (const column of ["seen_at", "created_at"] as const) {
      const raw = token();
      await admin`INSERT INTO hub_identity.sessions(hash,user_id) VALUES(${digest(raw)},${account.id})`;
      if (column === "seen_at")
        await admin`UPDATE hub_identity.sessions SET seen_at=now()-interval '16 minutes' WHERE hash=${digest(raw)}`;
      else
        await admin`UPDATE hub_identity.sessions SET created_at=now()-interval '9 hours' WHERE hash=${digest(raw)}`;
      await assert.rejects(
        auth.within(raw, async () => true),
        /UNAUTHENTICATED/,
      );
    }
  });
  await check("recovery is one-use and restricted to verified replacement enrollment", async () => {
    const recoveryCode = signedIn?.recoveryCodes?.[0];
    assert.ok(recoveryCode);
    const recovered = await auth.login(address, password, browser, "recovery-fixture", recoveryCode);
    assert.equal(recovered.phase, "enroll");
    assert.ok(recovered.secret);
    await assert.rejects(
      auth.within(recovered.challenge, async () => true),
      /UNAUTHENTICATED/,
    );
    await assert.rejects(
      auth.login(address, password, browser, "recovery-fixture", recoveryCode),
      /INVALID_CREDENTIALS/,
    );
    const result = await auth.complete(
      recovered.challenge,
      browser,
      await generate({ secret: recovered.secret }),
    );
    assert.equal(result.recoveryCodes?.length, 8);
    await auth.within(result.session, async () => true);
    assert.equal(
      (await admin`SELECT * FROM hub_identity.recovery_codes WHERE hash=${digest(recoveryCode)}`).length,
      0,
    );
  });
  await check("authentication success rolls back if security audit fails", async () => {
    const row = await auth.login(address, password, browser, "audit-fixture");
    await admin`UPDATE hub_identity.factors SET last_step=-1 WHERE user_id=${account.id}`;
    const factors = await admin`SELECT secret FROM hub_identity.factors WHERE user_id=${account.id}`;
    const secret = secretBox(key).open(String(factors[0]?.secret), `factor:${account.id}`);
    const code = await generate({ secret });
    const count = (await admin`SELECT count(*) FROM hub_identity.sessions`)[0]?.count;
    await admin`REVOKE INSERT ON hub_identity.security_events FROM openhub_app`;
    try {
      await assert.rejects(auth.complete(row.challenge, browser, code));
      assert.equal((await admin`SELECT count(*) FROM hub_identity.sessions`)[0]?.count, count);
      assert.equal(
        (await admin`SELECT consumed FROM hub_identity.challenges WHERE hash=${digest(row.challenge)}`)[0]
          ?.consumed,
        false,
      );
    } finally {
      await admin`GRANT INSERT ON hub_identity.security_events TO openhub_app`;
    }
  });
  await check("combined authentication limits survive fresh challenges and processes", async () => {
    const other = generalAuth(app, key, async () => {});
    for (let index = 0; index < 10; index++)
      await assert.rejects(auth.login("unknown@example.test", password, token(), "limit-fixture"));
    await assert.rejects(
      other.login("unknown@example.test", password, token(), "different-ip"),
      /RATE_LIMITED/,
    );
  });
}
