/* Application registration shares the host's transaction/audit/idempotency boundary. */
module.exports = function installApplications({ router, connection, ready, account, sha }) {
  const fields = [
    { name: "name", label: "Application name", type: "text" },
    { name: "package", label: "Package or bundle ID", type: "text" },
    { name: "category", label: "Category", type: "text" },
  ];
  const values = (row) => Object.fromEntries(fields.map(({ name }) => [name, String(row[name] || "")]));
  const revision = (row) => sha(JSON.stringify(values(row)));
  const validId = (id) => /^[a-z0-9][a-z0-9-]{0,63}$/.test(id);
  router.get("/apps/:id/settings/application", async (req, res) => {
    if (!validId(req.params.id)) return res.sendStatus(404);
    const c = connection();
    try {
      const row = await c.get("SELECT slug,name,package,category FROM apps WHERE slug=?", [req.params.id]);
      if (!row) return res.sendStatus(404);
      res.json({ fields, values: values(row), revision: revision(row) });
    } catch {
      res.sendStatus(503);
    } finally {
      c.db.close();
    }
  });
  router.put("/apps/:id/settings/application", async (req, res) => {
    const id = req.params.id,
      input = req.body;
    if (!validId(id)) return res.sendStatus(404);
    if (
      !input ||
      !/^[a-f0-9-]{36}$/.test(input.requestId || "") ||
      !/^[a-f0-9]{64}$/.test(input.revision || "") ||
      !input.values ||
      typeof input.values !== "object" ||
      Array.isArray(input.values)
    )
      return res.sendStatus(400);
    const value = input.values;
    if (
      Object.keys(value).length !== 3 ||
      fields.some(({ name }) => typeof value[name] !== "string") ||
      !value.name.trim() ||
      value.name.length > 100 ||
      value.category.length > 100 ||
      value.package.length > 200 ||
      (value.package && !/^[A-Za-z][A-Za-z0-9_-]*(?:\.[A-Za-z][A-Za-z0-9_-]*)+$/.test(value.package))
    )
      return res.sendStatus(400);
    const clean = Object.fromEntries(fields.map(({ name }) => [name, value[name].trim()]));
    const payloadHash = sha(
      JSON.stringify({ id, section: "application", revision: input.revision, values: clean }),
    );
    const c = connection();
    let active = false;
    try {
      await ready;
      await c.run("BEGIN IMMEDIATE");
      active = true;
      const previous = await c.get("SELECT * FROM openhub_operations WHERE id=?", [input.requestId]);
      if (previous) {
        await c.run("ROLLBACK");
        active = false;
        return previous.actor === account && previous.payload_hash === payloadHash
          ? res.json(JSON.parse(previous.result))
          : res.sendStatus(409);
      }
      const row = await c.get("SELECT slug,name,package,category FROM apps WHERE slug=?", [id]);
      const create = input.revision === "0".repeat(64);
      if (create ? Boolean(row) : !row || revision(row) !== input.revision) {
        await c.run("ROLLBACK");
        active = false;
        return res.status(409).json({ error: create ? "APPLICATION_EXISTS" : "CONFLICT" });
      }
      if (create) {
        await c.run(
          "INSERT INTO apps(slug,name,package,category,sort) VALUES(?,?,?,?,(SELECT COALESCE(MAX(sort),0)+1 FROM apps))",
          [id, clean.name, clean.package, clean.category],
        );
        await c.run("INSERT INTO app_config(slug,update_url) VALUES(?,'')", [id]);
      } else
        await c.run("UPDATE apps SET name=?,package=?,category=? WHERE slug=?", [
          clean.name,
          clean.package,
          clean.category,
          id,
        ]);
      const result = {
        ok: true,
        app: id,
        created: create,
        requestId: input.requestId,
        revision: revision(clean),
      };
      const changes = create
        ? ["created", ...fields.map(({ name }) => name)]
        : fields.filter(({ name }) => String(row[name] || "") !== clean[name]).map(({ name }) => name);
      await c.run(
        "INSERT INTO openhub_audit(time,actor,app,section,fields,request_id) VALUES(datetime('now'),?,?,?,?,?)",
        [account, id, "application", JSON.stringify(changes), input.requestId],
      );
      await c.run("INSERT INTO openhub_operations(id,actor,payload_hash,result) VALUES(?,?,?,?)", [
        input.requestId,
        account,
        payloadHash,
        JSON.stringify(result),
      ]);
      await c.run("COMMIT");
      active = false;
      res.json(result);
    } catch {
      if (active) await c.run("ROLLBACK").catch(() => {});
      res.sendStatus(503);
    } finally {
      c.db.close();
    }
  });
};
