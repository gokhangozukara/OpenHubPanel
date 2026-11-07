/* The host owns Firebase credentials. Reserve each send durably before network I/O. */
module.exports = function installPush({ router, connection, ready, account, push, sha }) {
  const fields = [
    { name: "title", label: "Title", type: "text" },
    { name: "body", label: "Message", type: "multiline" },
    { name: "target_type", label: "Notification target", type: "push-target" },
    { name: "target_app_slug", label: "Target application", type: "text" },
    { name: "target_route", label: "Screen route", type: "text" },
    { name: "target_url", label: "Target HTTPS URL", type: "text" },
  ];
  const valid = (id) => /^[a-z0-9][a-z0-9-]{0,63}$/.test(id);
  async function context(c, id) {
    const row = await c.get("SELECT c.* FROM app_config c JOIN apps a ON a.slug=c.slug WHERE c.slug=?", [id]);
    if (!row) return null;
    const status = push ? await push.status(id, row) : { ready: false, topic: "" };
    return {
      row,
      status,
      revision: sha(
        JSON.stringify({
          id,
          credential: row.fcm_service_account || "",
          ready: status.ready,
          topic: status.topic,
        }),
      ),
    };
  }
  router.get("/apps/:id/settings/push", async (req, res) => {
    if (!valid(req.params.id)) return res.sendStatus(404);
    const c = connection();
    try {
      await ready;
      const info = await context(c, req.params.id);
      if (!info) return res.sendStatus(404);
      const history = await c.all(
        "SELECT id,title,body,status,sent_at,target_type,target_app_slug,target_route,target_url FROM notifications WHERE slug=? ORDER BY id DESC LIMIT 20",
        [req.params.id],
      );
      res.json({
        fields,
        values: {
          title: "",
          body: "",
          target_type: "home",
          target_app_slug: "",
          target_route: "",
          target_url: "",
        },
        revision: info.revision,
        ready: Boolean(info.status.ready),
        topic: info.status.topic,
        history,
      });
    } catch {
      res.sendStatus(503);
    } finally {
      c.db.close();
    }
  });
  router.put("/apps/:id/settings/push", async (req, res) => {
    const id = req.params.id,
      input = req.body;
    if (!valid(id)) return res.sendStatus(404);
    if (
      !input ||
      !/^[a-f0-9-]{36}$/.test(input.requestId || "") ||
      !/^[a-f0-9]{64}$/.test(input.revision || "") ||
      !input.values ||
      typeof input.values !== "object" ||
      Array.isArray(input.values)
    )
      return res.sendStatus(400);
    const values = input.values;
    if (
      Object.keys(values).length !== fields.length ||
      fields.some(({ name }) => typeof values[name] !== "string") ||
      !values.title.trim() ||
      values.title.length > 100 ||
      !values.body.trim() ||
      values.body.length > 500 ||
      fields.some(({ name }) => values[name].length > 2048)
    )
      return res.sendStatus(400);
    const canonical = Object.fromEntries(fields.map(({ name }) => [name, values[name].trim()]));
    const payloadHash = sha(
      JSON.stringify({ id, section: "push", revision: input.revision, values: canonical }),
    );
    const c = connection();
    let transaction = false;
    let notificationId;
    let reserved = false;
    try {
      await ready;
      await c.run("BEGIN IMMEDIATE");
      transaction = true;
      const previous = await c.get("SELECT * FROM openhub_operations WHERE id=?", [input.requestId]);
      if (previous) {
        await c.run("ROLLBACK");
        transaction = false;
        return previous.actor === account && previous.payload_hash === payloadHash
          ? res.json(JSON.parse(previous.result))
          : res.sendStatus(409);
      }
      const info = await context(c, id);
      if (!info) {
        await c.run("ROLLBACK");
        transaction = false;
        return res.sendStatus(404);
      }
      if (info.revision !== input.revision) {
        await c.run("ROLLBACK");
        transaction = false;
        return res.sendStatus(409);
      }
      if (!push || !info.status.ready) {
        await c.run("ROLLBACK");
        transaction = false;
        return res.status(400).json({ error: "PUSH_NOT_CONFIGURED" });
      }
      let target;
      try {
        target = push.normalize(canonical, await c.all("SELECT slug,name,package FROM apps"), id);
      } catch {
        await c.run("ROLLBACK");
        transaction = false;
        return res.status(400).json({ error: "INVALID_PUSH_TARGET" });
      }
      const pending = { ok: false, status: "unknown", requestId: input.requestId, revision: info.revision };
      const record = await c.run(
        "INSERT INTO notifications(slug,title,body,status,detail,target_type,target_app_slug,target_route,target_url) VALUES(?,?,?,?,?,?,?,?,?)",
        [
          id,
          canonical.title,
          canonical.body,
          "unknown",
          "Reserved by OpenHubPanel",
          target.type,
          target.app_slug,
          target.route,
          target.url,
        ],
      );
      notificationId = record.lastID;
      await c.run("INSERT INTO openhub_operations(id,actor,payload_hash,result) VALUES(?,?,?,?)", [
        input.requestId,
        account,
        payloadHash,
        JSON.stringify(pending),
      ]);
      await c.run(
        "INSERT INTO openhub_audit(time,actor,app,section,fields,request_id) VALUES(datetime('now'),?,?,?,?,?)",
        [account, id, "push", JSON.stringify(fields.map(({ name }) => name)), input.requestId],
      );
      await c.run("COMMIT");
      transaction = false;
      reserved = true;
      // Never retry this callback: a timeout or interrupted process can have sent already.
      let result;
      try {
        result = await push.send(id, info.row, canonical, target);
      } catch {
        result = { status: "unknown", detail: "Delivery result unavailable; not automatically retried" };
      }
      const status = ["sent", "failed", "unknown"].includes(result.status) ? result.status : "unknown";
      const response = { ...pending, ok: status === "sent", status };
      await c.run("BEGIN IMMEDIATE");
      transaction = true;
      await c.run("UPDATE notifications SET status=?,detail=? WHERE id=?", [
        status,
        String(result.detail || "").slice(0, 300),
        notificationId,
      ]);
      await c.run("UPDATE openhub_operations SET result=? WHERE id=?", [
        JSON.stringify(response),
        input.requestId,
      ]);
      await c.run("COMMIT");
      transaction = false;
      res.json(response);
    } catch {
      if (transaction) await c.run("ROLLBACK").catch(() => {});
      // A reserved operation remains unknown even when recording the outcome fails.
      res.status(503).json({ error: reserved ? "UNKNOWN_OUTCOME" : "UNAVAILABLE" });
    } finally {
      c.db.close();
    }
  });
};
