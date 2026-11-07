/* Single-installation connector. Loaded by the host Express application. */
const { createHash, timingSafeEqual } = require("node:crypto");
const { readFileSync } = require("node:fs");

const sections = require("./fields.json");
const sha = (value) => createHash("sha256").update(value).digest("hex");
const fieldValues = (row, section) =>
  Object.fromEntries(
    sections[section].map(([name, , type]) => [
      name,
      type === "boolean"
        ? Boolean(row[name])
        : type === "integer"
          ? Number(row[name] ?? 0)
          : String(row[name] ?? ""),
    ]),
  );
const revision = (row, section) =>
  sha(JSON.stringify({ values: fieldValues(row, section), popup_version: row.popup_version }));

module.exports = function createConnector({ express, sqlite3, databasePath, keyFile, account, push }) {
  const router = express.Router();
  router.use((req, res, next) => {
    res.set("Cache-Control", "private, no-store");
    let expected;
    try {
      expected = readFileSync(keyFile, "utf8").trim();
    } catch {
      return res.sendStatus(503);
    }
    const actual = (req.get("authorization") || "").replace(/^Bearer /, "");
    const a = Buffer.from(actual),
      b = Buffer.from(expected);
    if (
      !expected ||
      expected.length < 43 ||
      !["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(req.socket.remoteAddress) ||
      a.length !== b.length ||
      !timingSafeEqual(a, b)
    )
      return res.sendStatus(404);
    if (!account) return res.sendStatus(503);
    next();
  });
  function connection() {
    const db = new sqlite3.Database(databasePath);
    db.configure("busyTimeout", 5000);
    const run = (sql, values = []) =>
      new Promise((resolve, reject) =>
        db.run(sql, values, function (error) {
          error ? reject(error) : resolve(this);
        }),
      );
    const get = (sql, values = []) =>
      new Promise((resolve, reject) =>
        db.get(sql, values, (error, row) => (error ? reject(error) : resolve(row))),
      );
    const all = (sql, values = []) =>
      new Promise((resolve, reject) =>
        db.all(sql, values, (error, rows) => (error ? reject(error) : resolve(rows))),
      );
    return { db, run, get, all };
  }
  async function initialize(c) {
    await c.run(
      `CREATE TABLE IF NOT EXISTS openhub_operations(id TEXT PRIMARY KEY, actor TEXT NOT NULL, payload_hash TEXT NOT NULL, result TEXT NOT NULL)`,
    );
    await c.run(
      `CREATE TABLE IF NOT EXISTS openhub_audit(id INTEGER PRIMARY KEY, time TEXT NOT NULL, actor TEXT NOT NULL, app TEXT NOT NULL, section TEXT NOT NULL, fields TEXT NOT NULL, request_id TEXT UNIQUE NOT NULL)`,
    );
    await c.run(
      `CREATE TRIGGER IF NOT EXISTS openhub_audit_no_update BEFORE UPDATE ON openhub_audit BEGIN SELECT RAISE(ABORT,'APPEND_ONLY'); END`,
    );
    await c.run(
      `CREATE TRIGGER IF NOT EXISTS openhub_audit_no_delete BEFORE DELETE ON openhub_audit BEGIN SELECT RAISE(ABORT,'APPEND_ONLY'); END`,
    );
  }
  const ready = (async () => {
    const c = connection();
    try {
      await initialize(c);
    } finally {
      c.db.close();
    }
  })();
  ready.catch(() => {});
  router.ready = ready;
  require("./applications.cjs")({ router, connection, ready, account, sha });
  require("./push.cjs")({ router, connection, ready, account, push, sha });
  router.get("/apps", async (_req, res) => {
    const c = connection();
    try {
      const rows = await c.all(
        "SELECT a.slug,a.name,a.category,a.package,c.latest_version,c.maintenance_mode FROM apps a JOIN app_config c ON c.slug=a.slug ORDER BY a.sort",
      );
      res.json({
        applications: rows.map((row) => ({
          id: row.slug,
          name: row.name,
          category: row.category || "",
          packageName: row.package || "",
          version: row.latest_version || "",
          maintenance: Boolean(row.maintenance_mode),
          legacyPath: `/app/${row.slug}`,
        })),
      });
    } catch {
      res.sendStatus(503);
    } finally {
      c.db.close();
    }
  });
  router.get("/apps/:id/settings/:section", async (req, res) => {
    const section = req.params.section;
    if (!Object.hasOwn(sections, section) || !/^[a-z0-9][a-z0-9-]{0,63}$/.test(req.params.id))
      return res.sendStatus(404);
    const c = connection();
    try {
      const row = await c.get("SELECT c.* FROM app_config c JOIN apps a ON a.slug=c.slug WHERE c.slug=?", [
        req.params.id,
      ]);
      if (!row) return res.sendStatus(404);
      res.json({
        fields: sections[section].map(([name, label, type]) => ({ name, label, type })),
        values: fieldValues(row, section),
        revision: revision(row, section),
      });
    } catch {
      res.sendStatus(503);
    } finally {
      c.db.close();
    }
  });
  router.get("/operations/:id", async (req, res) => {
    const c = connection();
    try {
      await ready;
      const row = await c.get("SELECT result FROM openhub_operations WHERE id=? AND actor=?", [
        req.params.id,
        account,
      ]);
      row ? res.json(JSON.parse(row.result)) : res.sendStatus(404);
    } catch {
      res.sendStatus(503);
    } finally {
      c.db.close();
    }
  });
  router.get("/audit", async (_req, res) => {
    const c = connection();
    try {
      await ready;
      res.json(
        await c.all(
          "SELECT time,actor,app,section,fields,request_id FROM openhub_audit ORDER BY id DESC LIMIT 100",
        ),
      );
    } catch {
      res.sendStatus(503);
    } finally {
      c.db.close();
    }
  });
  router.put("/apps/:id/settings/:section", async (req, res) => {
    const section = req.params.section,
      id = req.params.id;
    if (!Object.hasOwn(sections, section) || !/^[a-z0-9][a-z0-9-]{0,63}$/.test(id))
      return res.sendStatus(404);
    const input = req.body;
    if (
      !input ||
      typeof input !== "object" ||
      !/^[a-f0-9-]{36}$/.test(input.requestId || "") ||
      !/^[a-f0-9]{64}$/.test(input.revision || "") ||
      !input.values ||
      typeof input.values !== "object" ||
      Array.isArray(input.values)
    )
      return res.sendStatus(400);
    const names = sections[section].map(([name]) => name);
    if (
      Object.keys(input.values).length !== names.length ||
      Object.keys(input.values).some((name) => !names.includes(name))
    )
      return res.sendStatus(400);
    for (const [name, , type] of sections[section]) {
      const value = input.values[name];
      if (
        type === "boolean"
          ? typeof value !== "boolean"
          : type === "integer"
            ? !Number.isSafeInteger(value) || value < 0 || value > 1000000
            : typeof value !== "string" ||
              value.length > 4000 ||
              (type === "frequency" && !["once", "daily", "always"].includes(value))
      )
        return res.sendStatus(400);
    }
    const payloadHash = sha(
      JSON.stringify({
        id,
        section,
        revision: input.revision,
        values: Object.fromEntries(names.map((name) => [name, input.values[name]])),
      }),
    );
    const c = connection();
    let inTransaction = false;
    try {
      await ready;
      await c.run("BEGIN IMMEDIATE");
      inTransaction = true;
      const previous = await c.get("SELECT * FROM openhub_operations WHERE id=?", [input.requestId]);
      if (previous) {
        await c.run("ROLLBACK");
        inTransaction = false;
        return previous.actor === account && previous.payload_hash === payloadHash
          ? res.json(JSON.parse(previous.result))
          : res.sendStatus(409);
      }
      const row = await c.get("SELECT c.* FROM app_config c JOIN apps a ON a.slug=c.slug WHERE c.slug=?", [
        id,
      ]);
      if (!row) {
        await c.run("ROLLBACK");
        inTransaction = false;
        return res.sendStatus(404);
      }
      if (revision(row, section) !== input.revision) {
        await c.run("ROLLBACK");
        inTransaction = false;
        return res.status(409).json({ error: "CONFLICT" });
      }
      const before = fieldValues(row, section);
      const changes = names.filter((name) => before[name] !== input.values[name]);
      const popupChanged =
        section === "popup" &&
        ["popup_title", "popup_body", "popup_image_url", "popup_button_text", "popup_link"].some((name) =>
          changes.includes(name),
        );
      await c.run(
        `UPDATE app_config SET ${names.map((name) => `${name}=?`).join(",")}${popupChanged ? ",popup_version=popup_version+1" : ""},updated_at=datetime('now') WHERE slug=?`,
        [
          ...names.map((name) =>
            typeof input.values[name] === "boolean" ? Number(input.values[name]) : input.values[name],
          ),
          id,
        ],
      );
      const after = await c.get("SELECT * FROM app_config WHERE slug=?", [id]);
      const result = { ok: true, requestId: input.requestId, revision: revision(after, section) };
      await c.run(
        "INSERT INTO openhub_audit(time,actor,app,section,fields,request_id) VALUES(datetime('now'),?,?,?,?,?)",
        [account, id, section, JSON.stringify(changes), input.requestId],
      );
      await c.run("INSERT INTO openhub_operations(id,actor,payload_hash,result) VALUES(?,?,?,?)", [
        input.requestId,
        account,
        payloadHash,
        JSON.stringify(result),
      ]);
      await c.run("COMMIT");
      inTransaction = false;
      return res.json(result);
    } catch {
      if (inTransaction) await c.run("ROLLBACK").catch(() => {});
      res.sendStatus(503);
    } finally {
      c.db.close();
    }
  });
  return router;
};
module.exports.sections = sections;
