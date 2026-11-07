import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { DatabaseSync } from "node:sqlite";

export const digest = (value: string) => createHash("sha256").update(value).digest("hex");
export const token = () => randomBytes(32).toString("base64url");
export const now = () => Math.floor(Date.now() / 1000);
export function equal(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
export function enabled() {
  return process.env.OPENHUB_OPERATOR === "1";
}
export function state() {
  if (!enabled() || !process.env.OPERATOR_STATE_FILE) throw new Error("OPERATOR_DISABLED");
  const db = new DatabaseSync(process.env.OPERATOR_STATE_FILE);
  db.exec("PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;");
  return db;
}
export function migrate(db: DatabaseSync) {
  db.exec(`
    PRAGMA journal_mode=WAL;
    CREATE TABLE IF NOT EXISTS operator_user (
      id INTEGER PRIMARY KEY CHECK(id=1), email TEXT NOT NULL, password TEXT NOT NULL,
      factor TEXT NOT NULL, last_step INTEGER NOT NULL DEFAULT -1, active INTEGER NOT NULL DEFAULT 1,
      recovery_required INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS operator_bootstrap (id INTEGER PRIMARY KEY CHECK(id=1), hash TEXT NOT NULL, expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS operator_challenge (
      hash TEXT PRIMARY KEY, purpose TEXT NOT NULL, expires INTEGER NOT NULL, attempts INTEGER NOT NULL DEFAULT 0,
      password TEXT, factor TEXT, bootstrap TEXT
    );
    CREATE TABLE IF NOT EXISTS operator_session (
      hash TEXT PRIMARY KEY, created INTEGER NOT NULL, seen INTEGER NOT NULL, revoked INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS operator_recovery (hash TEXT PRIMARY KEY);
    CREATE TABLE IF NOT EXISTS operator_limit (key TEXT PRIMARY KEY, count INTEGER NOT NULL, expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS operator_event (
      id INTEGER PRIMARY KEY, time INTEGER NOT NULL, event TEXT NOT NULL, target TEXT NOT NULL, result TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS operator_intent (
      id TEXT PRIMARY KEY, session TEXT NOT NULL, payload TEXT NOT NULL, payload_hash TEXT NOT NULL,
      app TEXT NOT NULL, section TEXT NOT NULL, status TEXT NOT NULL, result TEXT, time INTEGER NOT NULL
    );
    CREATE TRIGGER IF NOT EXISTS operator_event_no_update BEFORE UPDATE ON operator_event BEGIN SELECT RAISE(ABORT, 'APPEND_ONLY'); END;
    CREATE TRIGGER IF NOT EXISTS operator_event_no_delete BEFORE DELETE ON operator_event BEGIN SELECT RAISE(ABORT, 'APPEND_ONLY'); END;
  `);
  if (
    !db
      .prepare("PRAGMA table_info(operator_user)")
      .all()
      .some((row) => row.name === "recovery_required")
  )
    db.exec("ALTER TABLE operator_user ADD COLUMN recovery_required INTEGER NOT NULL DEFAULT 0");
}
export function transaction<T>(db: DatabaseSync, action: () => T): T {
  db.exec("BEGIN IMMEDIATE");
  try {
    const value = action();
    db.exec("COMMIT");
    return value;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
export function event(db: DatabaseSync, name: string, target = "operator", result = "success") {
  db.prepare("INSERT INTO operator_event(time,event,target,result) VALUES(?,?,?,?)").run(
    now(),
    name,
    target,
    result,
  );
}
export function seal(value: string, purpose: string) {
  const key = process.env.OPERATOR_KEY;
  if (!key || !/^[a-f0-9]{64}$/.test(key)) throw new Error("INVALID_OPERATOR_KEY");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", Buffer.from(key, "hex"), iv);
  cipher.setAAD(Buffer.from(`openhubpanel:operator:1:${purpose}:v1`));
  const body = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), body].map((part) => part.toString("base64url")).join(".");
}
export function unseal(value: string, purpose: string) {
  const key = process.env.OPERATOR_KEY;
  if (!key || !/^[a-f0-9]{64}$/.test(key)) throw new Error("INVALID_OPERATOR_KEY");
  const [iv, tag, body] = value.split(".").map((part) => Buffer.from(part, "base64url"));
  if (!iv || !tag || !body) throw new Error("INVALID_ENCRYPTED_VALUE");
  const decipher = createDecipheriv("aes-256-gcm", Buffer.from(key, "hex"), iv);
  decipher.setAAD(Buffer.from(`openhubpanel:operator:1:${purpose}:v1`));
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(body), decipher.final()]).toString("utf8");
}
export function limit(key: string, maximum: number, seconds: number) {
  const db = state();
  try {
    const allowed = transaction(db, () => {
      db.prepare("DELETE FROM operator_limit WHERE expires <= ?").run(now());
      const row = db
        .prepare(`INSERT INTO operator_limit(key,count,expires) VALUES(?,1,?)
        ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count`)
        .get(digest(key), now() + seconds);
      return Number(row?.count) <= maximum;
    });
    if (!allowed) throw new Error("RATE_LIMITED");
  } finally {
    db.close();
  }
}
export function failure(name: string) {
  const db = state();
  try {
    event(db, name, "operator", "rejected");
  } finally {
    db.close();
  }
}
