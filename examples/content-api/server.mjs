import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import { createServer } from "node:http";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const token = process.env.API_TOKEN ?? "";
if (token.length < 32) throw new Error("API_TOKEN must have at least 32 random characters");
const filename = process.env.DATA_FILE ?? path.resolve("content-example.sqlite");
const db = new DatabaseSync(filename);
db.exec(
  "PRAGMA journal_mode=WAL;CREATE TABLE IF NOT EXISTS articles(id TEXT PRIMARY KEY,title TEXT NOT NULL,status TEXT NOT NULL,version INTEGER NOT NULL);CREATE TABLE IF NOT EXISTS operations(id TEXT PRIMARY KEY,hash TEXT NOT NULL,result TEXT NOT NULL);CREATE TABLE IF NOT EXISTS audit(id INTEGER PRIMARY KEY,time TEXT NOT NULL,article TEXT NOT NULL,operation TEXT NOT NULL);INSERT OR IGNORE INTO articles VALUES('welcome','Welcome to your connected application','published',1)",
);
const manifest = {
  id: "node-content-example",
  name: "Node content example",
  contractVersion: "1.0",
  resources: [{ id: "articles", name: "Articles", capabilities: ["list", "read", "update"] }],
};
const reply = (res, code, data) => {
  if (data.error)
    data = {
      error: {
        code: data.error.code,
        message: code === 401 ? "Access denied." : "The request could not be completed.",
        requestId: randomUUID(),
      },
    };
  res.writeHead(code, { "content-type": "application/json", "cache-control": "private, no-store" });
  res.end(JSON.stringify(data));
};
const server = createServer(async (req, res) => {
  const supplied = Buffer.from((req.headers.authorization ?? "").replace(/^Bearer /, "")),
    expected = Buffer.from(token);
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected))
    return reply(res, 401, { error: { code: "UNAUTHORIZED" } });
  const url = new URL(req.url, "http://localhost");
  const route = url.pathname.replace(/^\/hubpanel\/v1/, "");
  if (req.method === "GET" && route === "/health")
    return reply(res, 200, { status: "ok", contractVersion: "1.0" });
  if (req.method === "GET" && route === "/manifest") return reply(res, 200, manifest);
  if (req.method === "GET" && route === "/articles")
    return reply(res, 200, { items: db.prepare("SELECT * FROM articles ORDER BY id LIMIT 100").all() });
  const operation = /^\/operations\/([a-f0-9-]{36})$/.exec(route);
  if (req.method === "GET" && operation) {
    const row = db.prepare("SELECT result FROM operations WHERE id=?").get(operation[1]);
    return row ? reply(res, 200, JSON.parse(row.result)) : reply(res, 404, { error: { code: "NOT_FOUND" } });
  }
  const target = /^\/articles\/([a-zA-Z0-9_-]{1,80})$/.exec(route);
  if (!target) return reply(res, 404, { error: { code: "NOT_FOUND" } });
  const id = target[1];
  if (req.method === "GET") {
    const row = db.prepare("SELECT * FROM articles WHERE id=?").get(id);
    return row ? reply(res, 200, row) : reply(res, 404, { error: { code: "NOT_FOUND" } });
  }
  if (req.method !== "PATCH") return reply(res, 405, { error: { code: "METHOD_NOT_ALLOWED" } });
  let body = "";
  try {
    for await (const chunk of req) {
      body += chunk.toString("utf8");
      if (Buffer.byteLength(body) > 8192) return reply(res, 413, { error: { code: "TOO_LARGE" } });
    }
    const input = JSON.parse(body);
    if (
      Object.keys(input).sort().join(",") !== "expectedVersion,idempotencyKey,title" ||
      typeof input.title !== "string" ||
      !input.title.trim() ||
      input.title.length > 180 ||
      !Number.isInteger(input.expectedVersion) ||
      input.expectedVersion < 1 ||
      !/^[a-f0-9-]{36}$/.test(input.idempotencyKey)
    )
      return reply(res, 400, { error: { code: "INVALID_REQUEST" } });
    const hash = createHash("sha256")
      .update(
        JSON.stringify({
          id,
          title: input.title.trim(),
          expectedVersion: input.expectedVersion,
          idempotencyKey: input.idempotencyKey,
        }),
      )
      .digest("hex");
    db.exec("BEGIN IMMEDIATE");
    try {
      const prior = db.prepare("SELECT * FROM operations WHERE id=?").get(input.idempotencyKey);
      if (prior) {
        db.exec("ROLLBACK");
        return prior.hash === hash
          ? reply(res, 200, JSON.parse(prior.result))
          : reply(res, 409, { error: { code: "CONFLICT" } });
      }
      const updated = db
        .prepare("UPDATE articles SET title=?,version=version+1 WHERE id=? AND version=? RETURNING version")
        .get(input.title.trim(), id, input.expectedVersion);
      if (!updated) {
        db.exec("ROLLBACK");
        return reply(res, 409, { error: { code: "CONFLICT" } });
      }
      const result = { ok: true, idempotencyKey: input.idempotencyKey, version: updated.version };
      db.prepare("INSERT INTO operations VALUES(?,?,?)").run(
        input.idempotencyKey,
        hash,
        JSON.stringify(result),
      );
      db.prepare("INSERT INTO audit(time,article,operation) VALUES(datetime('now'),?,?)").run(
        id,
        input.idempotencyKey,
      );
      db.exec("COMMIT");
      reply(res, 200, result);
    } catch {
      db.exec("ROLLBACK");
      reply(res, 503, { error: { code: "UNAVAILABLE" } });
    }
  } catch {
    reply(res, 400, { error: { code: "INVALID_REQUEST" } });
  }
});
server.listen(Number(process.env.PORT ?? 3901), "127.0.0.1", () => console.log("Content example ready"));
process.on("SIGTERM", () =>
  server.close(() => {
    db.close();
    process.exit(0);
  }),
);
