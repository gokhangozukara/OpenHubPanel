import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import type { Database } from "@openhubpanel/db";
import { generate, generateSecret } from "otplib";
import { generalAuth } from "./auth";
import { digest, secretBox, token } from "./crypto";

export async function checkTrustedDevices(
  admin: Database,
  app: Database,
  check: (name: string, run: () => Promise<void>) => Promise<void>,
) {
  const key = randomBytes(32).toString("hex");
  const auth = generalAuth(app, key, async () => {});
  const box = secretBox(key);
  async function fixture() {
    const id = randomUUID(),
      email = `${id}@example.test`,
      password = token(),
      browser = token(),
      secret = generateSecret();
    const encoded = await auth.passwordHash(password);
    await admin`INSERT INTO users(id,display_name) VALUES(${id},'Device fixture')`;
    await admin`INSERT INTO hub_identity.accounts(id,email,password_hash) VALUES(${id},${email},${encoded})`;
    await admin`INSERT INTO hub_identity.factors(user_id,secret) VALUES(${id},${box.seal(secret, `factor:${id}`)})`;
    async function issue(remember = true, device = browser) {
      const challenge = await auth.login(email, password, device, `device-${id}`);
      // Independent fixture setup; existing replay tests still enforce real consumed TOTP steps.
      await admin`UPDATE hub_identity.factors SET last_step=-1 WHERE user_id=${id}`;
      return auth.complete(challenge.challenge, device, await generate({ secret }), remember);
    }
    return {
      id,
      email,
      password,
      browser,
      secret,
      issue,
      login: (trusted?: string, device = browser) =>
        auth.login(email, password, device, `device-${id}`, undefined, trusted),
    };
  }
  await check("device trust is opt-in and can only follow successful TOTP", async () => {
    const f = await fixture();
    const challenge = await auth.login(f.email, f.password, f.browser, "device-opt-in");
    const valid = await generate({ secret: f.secret });
    await assert.rejects(
      auth.complete(challenge.challenge, f.browser, valid === "000000" ? "111111" : "000000", true),
      /INVALID_CODE/,
    );
    assert.equal(
      (await admin`SELECT hash FROM hub_identity.trusted_devices WHERE user_id=${f.id}`).length,
      0,
    );
    const plain = await auth.complete(challenge.challenge, f.browser, valid);
    assert.equal(plain.trustedDevice, undefined);
    assert.equal((await f.login()).phase, "verify");
  });
  await check(
    "trusted password sign-in uses a hashed browser-bound token without extending 30-day expiry",
    async () => {
      const f = await fixture(),
        issued = await f.issue();
      assert.ok(issued.trustedDevice);
      const trusted = issued.trustedDevice;
      assert.equal(trusted.length, 43);
      assert.ok(issued.session !== trusted);
      await assert.rejects(
        auth.within(trusted, async () => true),
        /UNAUTHENTICATED/,
      );
      const before = (
        await admin`SELECT hash,expires_at,created_at FROM hub_identity.trusted_devices WHERE user_id=${f.id}`
      )[0];
      assert.ok(before);
      assert.ok(before.hash !== trusted);
      assert.equal(
        new Date(before.expires_at).getTime() - new Date(before.created_at).getTime(),
        30 * 86400000,
      );
      await auth.revoke(issued.session);
      const login = await f.login(trusted);
      assert.equal(login.phase, "authenticated");
      assert.ok(login.session);
      assert.equal(await auth.within(login.session, async (_tx, identity) => identity.userId), f.id);
      await assert.rejects(
        auth.within(login.session, (tx, identity) => auth.stepUp(tx, identity, "")),
        /INVALID_CODE/,
      );
      assert.equal(
        new Date(
          (await admin`SELECT expires_at FROM hub_identity.trusted_devices WHERE user_id=${f.id}`)[0]
            ?.expires_at,
        ).getTime(),
        new Date(before.expires_at).getTime(),
      );
    },
  );
  await check(
    "wrong password, forged token, other browser and other account cannot use device trust",
    async () => {
      const f = await fixture(),
        issued = await f.issue();
      assert.ok(issued.trustedDevice);
      await assert.rejects(
        auth.login(f.email, token(), f.browser, "device-invalid", undefined, issued.trustedDevice),
        /INVALID_CREDENTIALS/,
      );
      assert.equal((await f.login(token())).phase, "verify");
      assert.equal((await f.login(issued.trustedDevice, token())).phase, "verify");
      const other = await fixture();
      assert.equal(
        (
          await auth.login(
            other.email,
            other.password,
            f.browser,
            "device-other",
            undefined,
            issued.trustedDevice,
          )
        ).phase,
        "verify",
      );
      await admin`UPDATE hub_identity.accounts SET active=false WHERE id=${f.id}`;
      await assert.rejects(f.login(issued.trustedDevice), /INVALID_CREDENTIALS/);
    },
  );
  await check("server-side trusted-device expiry is fixed and authoritative", async () => {
    const f = await fixture(),
      issued = await f.issue();
    assert.ok(issued.trustedDevice);
    await admin`UPDATE hub_identity.trusted_devices SET created_at=now()-interval '29 days',expires_at=now()+interval '1 day' WHERE user_id=${f.id}`;
    assert.equal((await f.login(issued.trustedDevice)).phase, "authenticated");
    await admin`UPDATE hub_identity.trusted_devices SET created_at=now()-interval '31 days',expires_at=now()-interval '1 day' WHERE user_id=${f.id}`;
    assert.equal((await f.login(issued.trustedDevice)).phase, "verify");
  });
  await check(
    "forget-device and logout-all revoke trust including a concurrent remembered login",
    async () => {
      const f = await fixture();
      let issued = await f.issue();
      assert.ok(issued.trustedDevice);
      await auth.forgetDevice(issued.session, f.browser);
      assert.equal((await f.login(issued.trustedDevice)).phase, "verify");
      issued = await f.issue();
      assert.ok(issued.trustedDevice);
      const another = await f.issue(true, token());
      assert.ok(another.trustedDevice);
      const [login] = await Promise.all([f.login(issued.trustedDevice), auth.revoke(another.session, true)]);
      assert.equal(
        (await admin`SELECT hash FROM hub_identity.trusted_devices WHERE user_id=${f.id} AND NOT revoked`)
          .length,
        0,
      );
      if (login.session)
        await assert.rejects(
          auth.within(login.session, async () => true),
          /UNAUTHENTICATED/,
        );
      assert.equal((await f.login(issued.trustedDevice)).phase, "verify");
    },
  );
  await check("password changes, recovery and factor replacement invalidate old device trust", async () => {
    const f = await fixture(),
      issued = await f.issue();
    assert.ok(issued.trustedDevice);
    await admin`UPDATE hub_identity.accounts SET password_hash=${await auth.passwordHash(f.password)} WHERE id=${f.id}`;
    assert.equal((await f.login(issued.trustedDevice)).phase, "verify");
    const fresh = await f.issue();
    assert.ok(fresh.trustedDevice);
    const recovery = token();
    await admin`INSERT INTO hub_identity.recovery_codes(user_id,hash) VALUES(${f.id},${digest(recovery)})`;
    const challenge = await auth.login(
      f.email,
      f.password,
      f.browser,
      "device-recovery",
      recovery,
      fresh.trustedDevice,
    );
    assert.equal(challenge.phase, "enroll");
    assert.ok(challenge.secret);
    assert.equal(
      (await admin`SELECT hash FROM hub_identity.trusted_devices WHERE user_id=${f.id} AND NOT revoked`)
        .length,
      0,
    );
    await assert.rejects(
      auth.within(challenge.challenge, async () => true),
      /UNAUTHENTICATED/,
    );
    await auth.complete(challenge.challenge, f.browser, await generate({ secret: challenge.secret }));
    assert.equal((await f.login(fresh.trustedDevice)).phase, "verify");
  });
  await check(
    "trusted-device issuance and remembered sign-in roll back when security audit fails",
    async () => {
      const f = await fixture();
      const challenge = await auth.login(f.email, f.password, f.browser, "device-audit");
      const count = (await admin`SELECT count(*) FROM hub_identity.sessions WHERE user_id=${f.id}`)[0]?.count;
      await admin`REVOKE INSERT ON hub_identity.security_events FROM openhub_app`;
      try {
        await assert.rejects(
          auth.complete(challenge.challenge, f.browser, await generate({ secret: f.secret }), true),
        );
        assert.equal(
          (await admin`SELECT hash FROM hub_identity.trusted_devices WHERE user_id=${f.id}`).length,
          0,
        );
        assert.equal(
          (await admin`SELECT count(*) FROM hub_identity.sessions WHERE user_id=${f.id}`)[0]?.count,
          count,
        );
      } finally {
        await admin`GRANT INSERT ON hub_identity.security_events TO openhub_app`;
      }
      const issued = await f.issue();
      assert.ok(issued.trustedDevice);
      const before = (await admin`SELECT count(*) FROM hub_identity.sessions WHERE user_id=${f.id}`)[0]
        ?.count;
      await admin`REVOKE INSERT ON hub_identity.security_events FROM openhub_app`;
      try {
        await assert.rejects(f.login(issued.trustedDevice));
        assert.equal(
          (await admin`SELECT count(*) FROM hub_identity.sessions WHERE user_id=${f.id}`)[0]?.count,
          before,
        );
      } finally {
        await admin`GRANT INSERT ON hub_identity.security_events TO openhub_app`;
      }
    },
  );
}
