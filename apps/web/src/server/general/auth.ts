import { createHash, randomUUID } from "node:crypto";
import { hash, verify as verifyPassword } from "@node-rs/argon2";
import type { Database, Transaction } from "@openhubpanel/db";
import { generateSecret, verify } from "otplib";
import { digest, secretBox, token } from "./crypto";

export const trustedDeviceMaxAge = 30 * 24 * 60 * 60;
type LoginResult = { phase: string; challenge: string; secret?: string; session?: string };

export type Identity = { userId: string; sessionHash: string };
const emailAddress = (value: string) => {
  const normalized = value.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) || normalized.length > 254)
    throw new Error("INVALID_INPUT");
  return normalized;
};

export async function checkCompromisedPassword(password: string) {
  const sha = createHash("sha1").update(password).digest("hex").toUpperCase();
  let response: Response;
  try {
    response = await fetch(`https://api.pwnedpasswords.com/range/${sha.slice(0, 5)}`, {
      headers: { "Add-Padding": "true" },
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) throw new Error();
    const value = await response.text();
    if (value.length > 262144 || !/^[A-F0-9:0-9\r\n]+$/i.test(value)) throw new Error();
    if (
      value.split(/\r?\n/).some((line) => {
        const [suffix, count] = line.split(":");
        return suffix === sha.slice(5) && Number(count) > 0;
      })
    )
      throw new Error("PASSWORD_COMPROMISED");
  } catch (error) {
    if (error instanceof Error && error.message === "PASSWORD_COMPROMISED") throw error;
    throw new Error("PASSWORD_CHECK_UNAVAILABLE");
  }
}
export function generalAuth(db: Database, encryptionKey: string, passwordCheck = checkCompromisedPassword) {
  const box = secretBox(encryptionKey);
  async function event(tx: Transaction, action: string, userId: string | null, outcome = "success") {
    await tx`INSERT INTO hub_identity.security_events(id,user_id,action,outcome) VALUES (${randomUUID()},${userId},${action},${outcome})`;
  }
  async function limited(keys: string[]) {
    // Database-backed counters coordinate all web processes and fail closed on database failure.
    const blocked = await db.begin(async (tx) => {
      let denied = false;
      for (const key of [...keys].sort()) {
        const rows = await tx`INSERT INTO hub_identity.rate_limits(key,count,until_at)
          VALUES (${digest(key)},1,now()+interval '15 minutes') ON CONFLICT(key) DO UPDATE
          SET count=CASE WHEN hub_identity.rate_limits.until_at <= now() THEN 1 ELSE hub_identity.rate_limits.count+1 END,
          until_at=CASE WHEN hub_identity.rate_limits.until_at <= now() THEN now()+interval '15 minutes' ELSE hub_identity.rate_limits.until_at END RETURNING count`;
        if (Number(rows[0]?.count) > (key.startsWith("ip:") ? 60 : 10)) denied = true;
      }
      return denied;
    });
    if (blocked) throw new Error("RATE_LIMITED");
  }
  async function passwordHash(password: string) {
    if (typeof password !== "string" || password.length < 6 || password.length > 256)
      throw new Error("PASSWORD_LENGTH");
    if (/^(password|123456|qwerty|abcdef|111111|letmein)$/i.test(password))
      throw new Error("COMMON_PASSWORD");
    await passwordCheck(password);
    return hash(password, { memoryCost: 19456, timeCost: 2, parallelism: 1 });
  }
  async function challenge(tx: Transaction, userId: string, browser: string, purpose: string) {
    const raw = token();
    const secret = purpose === "login" ? null : generateSecret();
    await tx`INSERT INTO hub_identity.challenges(hash,user_id,purpose,secret,browser_hash)
      VALUES (${digest(raw)},${userId},${purpose},${secret ? box.seal(secret, `factor:${userId}`) : null},${digest(browser)})`;
    return { challenge: raw, phase: secret ? "enroll" : "verify", ...(secret ? { secret } : {}) };
  }
  async function session(tx: Transaction, userId: string) {
    const raw = token();
    await tx`INSERT INTO hub_identity.sessions(hash,user_id) VALUES (${digest(raw)},${userId})`;
    return raw;
  }
  async function clearLimits(tx: Transaction, email: string, browser: string) {
    await tx`DELETE FROM hub_identity.rate_limits WHERE key IN (${digest(`account:${email}`)},${digest(`device:${browser}`)},${digest(`entry:${browser}`)})`;
  }
  async function trust(tx: Transaction, userId: string, browser: string, factor: string, password: string) {
    const raw = token();
    await tx`INSERT INTO hub_identity.trusted_devices(hash,user_id,browser_hash,factor_hash,password_hash)
      VALUES(${digest(raw)},${userId},${digest(browser)},${digest(factor)},${digest(password)})
      ON CONFLICT(user_id,browser_hash) DO UPDATE SET hash=excluded.hash,factor_hash=excluded.factor_hash,
      password_hash=excluded.password_hash,created_at=now(),expires_at=now()+interval '30 days',revoked=false`;
    await event(tx, "device.trusted", userId);
    return raw;
  }
  async function within<T>(raw: string, action: (tx: Transaction, identity: Identity) => Promise<T>) {
    if (!raw || raw.length > 256) throw new Error("UNAUTHENTICATED");
    return db.begin(async (tx) => {
      const rows =
        await tx`SELECT s.user_id FROM hub_identity.sessions s JOIN hub_identity.accounts a ON a.id=s.user_id
        JOIN hub_identity.factors f ON f.user_id=a.id WHERE s.hash=${digest(raw)} AND NOT s.revoked AND a.active
        AND s.created_at > now()-interval '8 hours' AND s.seen_at > now()-interval '15 minutes' FOR UPDATE OF s`;
      if (!rows[0]) throw new Error("UNAUTHENTICATED");
      const identity = { userId: String(rows[0].user_id), sessionHash: digest(raw) };
      await tx`UPDATE hub_identity.sessions SET seen_at=now() WHERE hash=${identity.sessionHash}`;
      await tx`SELECT set_config('app.actor_id',${identity.userId},true)`;
      return action(tx, identity);
    }) as Promise<T>;
  }
  return {
    within,
    async guard(ip: string, browser: string) {
      await limited([`ip:${ip}`, `entry:${browser}`]);
    },
    async clearGuard(browser: string) {
      await db`DELETE FROM hub_identity.rate_limits WHERE key=${digest(`entry:${browser}`)}`;
    },
    passwordHash,
    emailAddress,
    async enrollInvitation(proof: string, password: string, browser: string) {
      const encoded = await passwordHash(password);
      return db.begin(async (tx) => {
        const invitations = await tx`SELECT * FROM invitation_lookup(${digest(proof)})`;
        const invitation = invitations[0];
        if (!invitation) throw new Error("INVALID_INVITATION");
        const address = String(invitation.email);
        if ((await tx`SELECT id FROM hub_identity.accounts WHERE email=${address}`).length)
          throw new Error("SIGN_IN_REQUIRED");
        const id = randomUUID();
        await tx`SELECT set_config('app.actor_id',${id},true)`;
        await tx`INSERT INTO users(id,display_name) VALUES(${id},${address})`;
        await tx`INSERT INTO hub_identity.accounts(id,email,password_hash) VALUES(${id},${address},${encoded})`;
        await event(tx, "invitation.enrollment", id);
        return challenge(tx, id, browser, "enroll");
      });
    },
    async createBootstrap() {
      const raw = token();
      await db.begin(async (tx) => {
        await tx`SELECT pg_advisory_xact_lock(719421)`;
        if ((await tx`SELECT id FROM hub_identity.accounts LIMIT 1`).length)
          throw new Error("BOOTSTRAP_CLOSED");
        await tx`INSERT INTO hub_identity.bootstrap(singleton,token_hash,expires_at)
          VALUES(true,${digest(raw)},now()+interval '15 minutes') ON CONFLICT(singleton) DO UPDATE
          SET token_hash=excluded.token_hash,expires_at=excluded.expires_at WHERE NOT hub_identity.bootstrap.consumed`;
      });
      return raw;
    },
    async bootstrap(raw: string, email: string, password: string, browser: string) {
      const address = emailAddress(email);
      const encoded = await passwordHash(password);
      return db.begin(async (tx) => {
        await tx`SELECT pg_advisory_xact_lock(719421)`;
        const proof =
          await tx`UPDATE hub_identity.bootstrap SET consumed=true WHERE singleton AND token_hash=${digest(raw)} AND expires_at>now() AND NOT consumed RETURNING singleton`;
        if (!proof.length || (await tx`SELECT id FROM hub_identity.accounts LIMIT 1`).length)
          throw new Error("INVALID_BOOTSTRAP");
        const id = randomUUID();
        await tx`SELECT set_config('app.actor_id',${id},true)`;
        await tx`INSERT INTO users(id,display_name) VALUES(${id},${address})`;
        await tx`INSERT INTO hub_identity.accounts(id,email,password_hash) VALUES(${id},${address},${encoded})`;
        await event(tx, "bootstrap.accepted", id);
        return challenge(tx, id, browser, "enroll");
      });
    },
    async login(
      email: string,
      password: string,
      browser: string,
      ip: string,
      recovery?: string,
      trustedDevice?: string,
    ): Promise<LoginResult> {
      const address = emailAddress(email);
      await limited([`account:${address}`, `ip:${ip}`, `device:${browser}`]);
      const rows = await db`SELECT id,password_hash,active FROM hub_identity.accounts WHERE email=${address}`;
      const account = rows[0];
      const valid =
        account?.active &&
        typeof password === "string" &&
        password.length <= 256 &&
        (await verifyPassword(String(account.password_hash), password));
      if (!valid) {
        await event(
          db as unknown as Transaction,
          "login.failed",
          account ? String(account.id) : null,
          "denied",
        );
        throw new Error("INVALID_CREDENTIALS");
      }
      return db
        .begin(async (tx) => {
          const id = String(account.id);
          const current =
            await tx`SELECT password_hash FROM hub_identity.accounts WHERE id=${id} AND active FOR UPDATE`;
          if (!current.length || current[0]?.password_hash !== account.password_hash) return null;
          if (recovery) {
            const used =
              await tx`DELETE FROM hub_identity.recovery_codes WHERE user_id=${id} AND hash=${digest(recovery)} RETURNING user_id`;
            if (!used.length) {
              await event(tx, "recovery.failed", id, "denied");
              return null;
            }
            await tx`UPDATE hub_identity.sessions SET revoked=true WHERE user_id=${id}`;
            await tx`UPDATE hub_identity.challenges SET consumed=true WHERE user_id=${id}`;
            await tx`UPDATE hub_identity.trusted_devices SET revoked=true WHERE user_id=${id}`;
            await event(tx, "recovery.accepted", id);
            return challenge(tx, id, browser, "recovery");
          }
          const factors = await tx`SELECT secret FROM hub_identity.factors WHERE user_id=${id} FOR UPDATE`;
          const enrolled = factors.length;
          await event(tx, "password.accepted", id);
          if (enrolled && trustedDevice?.length === 43) {
            const devices =
              await tx`SELECT hash FROM hub_identity.trusted_devices WHERE hash=${digest(trustedDevice)} AND user_id=${id}
              AND browser_hash=${digest(browser)} AND factor_hash=${digest(String(factors[0]?.secret))}
              AND password_hash=${digest(String(current[0]?.password_hash))} AND NOT revoked AND expires_at>now() FOR UPDATE`;
            if (devices.length) {
              await event(tx, "device.accepted", id);
              await clearLimits(tx, address, browser);
              return { phase: "authenticated", challenge: "", session: await session(tx, id) };
            }
          }
          return challenge(tx, id, browser, enrolled ? "login" : "enroll");
        })
        .then((result) => {
          if (!result) throw new Error("INVALID_CREDENTIALS");
          return result;
        });
    },
    async complete(raw: string, browser: string, code: string, rememberDevice = false) {
      const result = await db.begin(async (tx) => {
        const rows =
          await tx`SELECT c.*,a.active,a.email,a.password_hash FROM hub_identity.challenges c JOIN hub_identity.accounts a ON a.id=c.user_id
          WHERE c.hash=${digest(raw)} AND c.browser_hash=${digest(browser)} AND NOT c.consumed AND c.expires_at>now() AND c.attempts<5 FOR UPDATE OF c,a`;
        const c = rows[0];
        if (!c?.active) return null;
        await tx`UPDATE hub_identity.challenges SET attempts=attempts+1 WHERE hash=${digest(raw)}`;
        const factors = await tx`SELECT * FROM hub_identity.factors WHERE user_id=${c.user_id} FOR UPDATE`;
        const factor = factors[0];
        const encrypted = c.purpose === "login" ? factor?.secret : c.secret;
        if (!encrypted || !/^\d{6}$/.test(code)) {
          await event(tx, "factor.failed", String(c.user_id), "denied");
          return null;
        }
        const verified = await verify({
          secret: box.open(String(encrypted), `factor:${c.user_id}`),
          token: code,
          epochTolerance: 30,
        });
        if (
          !verified.valid ||
          !("timeStep" in verified) ||
          (c.purpose === "login" && Number(factor?.last_step) >= Number(verified.timeStep))
        ) {
          await event(tx, "factor.failed", String(c.user_id), "denied");
          return null;
        }
        let recoveryCodes: string[] | undefined;
        if (c.purpose !== "login") {
          await tx`UPDATE hub_identity.trusted_devices SET revoked=true WHERE user_id=${c.user_id}`;
          await tx`UPDATE hub_identity.sessions SET revoked=true WHERE user_id=${c.user_id}`;
          await tx`UPDATE hub_identity.challenges SET consumed=true WHERE user_id=${c.user_id}`;
          await tx`INSERT INTO hub_identity.factors(user_id,secret,last_step) VALUES(${c.user_id},${encrypted},${Number(verified.timeStep)})
            ON CONFLICT(user_id) DO UPDATE SET secret=excluded.secret,last_step=excluded.last_step`;
          await tx`DELETE FROM hub_identity.recovery_codes WHERE user_id=${c.user_id}`;
          recoveryCodes = Array.from({ length: 8 }, token);
          for (const recovery of recoveryCodes)
            await tx`INSERT INTO hub_identity.recovery_codes(user_id,hash) VALUES(${c.user_id},${digest(recovery)})`;
        } else {
          await tx`UPDATE hub_identity.factors SET last_step=${Number(verified.timeStep)} WHERE user_id=${c.user_id}`;
          await tx`UPDATE hub_identity.challenges SET consumed=true WHERE hash=${digest(raw)}`;
        }
        await event(tx, "factor.accepted", String(c.user_id));
        await clearLimits(tx, String(c.email), browser);
        const trustedDevice = rememberDevice
          ? await trust(tx, String(c.user_id), browser, String(encrypted), String(c.password_hash))
          : undefined;
        return { session: await session(tx, String(c.user_id)), recoveryCodes, trustedDevice };
      });
      if (!result) throw new Error("INVALID_CODE");
      return result;
    },
    async revoke(raw: string, all = false) {
      return within(raw, async (tx, identity) => {
        if (all) await tx`SELECT id FROM hub_identity.accounts WHERE id=${identity.userId} FOR UPDATE`;
        await tx`UPDATE hub_identity.sessions SET revoked=true WHERE user_id=${identity.userId} AND (${all} OR hash=${identity.sessionHash})`;
        if (all)
          await tx`UPDATE hub_identity.trusted_devices SET revoked=true WHERE user_id=${identity.userId}`;
        await event(tx, "session.revoked", identity.userId);
      });
    },
    async forgetDevice(raw: string, browser: string) {
      return within(raw, async (tx, identity) => {
        await tx`SELECT id FROM hub_identity.accounts WHERE id=${identity.userId} FOR UPDATE`;
        await tx`UPDATE hub_identity.trusted_devices SET revoked=true WHERE user_id=${identity.userId} AND browser_hash=${digest(browser)}`;
        await event(tx, "device.revoked", identity.userId);
      });
    },
    async stepUp(tx: Transaction, identity: Identity, code: string) {
      const factors =
        await tx`SELECT * FROM hub_identity.factors WHERE user_id=${identity.userId} FOR UPDATE`;
      const factor = factors[0];
      if (!factor || !/^\d{6}$/.test(code)) throw new Error("INVALID_CODE");
      const verified = await verify({
        secret: box.open(String(factor.secret), `factor:${identity.userId}`),
        token: code,
        epochTolerance: 30,
      });
      if (
        !verified.valid ||
        !("timeStep" in verified) ||
        Number(verified.timeStep) <= Number(factor.last_step)
      )
        throw new Error("INVALID_CODE");
      await tx`UPDATE hub_identity.factors SET last_step=${Number(verified.timeStep)} WHERE user_id=${identity.userId}`;
    },
  };
}
