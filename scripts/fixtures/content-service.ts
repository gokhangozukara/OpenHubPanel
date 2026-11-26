import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { request as httpRequest } from "node:http";
import { createServer, request as httpsRequest } from "node:https";
import { createServer as tcpServer } from "node:net";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

export async function freePort() {
  const server = tcpServer();
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  await new Promise<void>((resolve) => server.close(() => resolve()));
  return address.port;
}
export async function contentService(directory: string) {
  const hostname = "content-fixture.example.test";
  const port = await freePort();
  const tlsPort = await freePort();
  const credential = randomBytes(32).toString("base64url");
  const database = path.join(directory, "independent-content.sqlite");
  const certificate = path.join(directory, "content.crt");
  const key = path.join(directory, "content.key");
  const openssl = process.platform === "win32" ? "C:/Program Files/Git/usr/bin/openssl.exe" : "openssl";
  execFileSync(
    openssl,
    [
      "req",
      "-x509",
      "-newkey",
      "rsa:2048",
      "-nodes",
      "-days",
      "1",
      "-keyout",
      key,
      "-out",
      certificate,
      "-subj",
      `/CN=${hostname}`,
      "-addext",
      `subjectAltName=DNS:${hostname}`,
    ],
    { stdio: "ignore" },
  );
  const child = spawn(process.execPath, ["examples/content-api/server.mjs"], {
    cwd: process.cwd(),
    env: { ...process.env, API_TOKEN: credential, DATA_FILE: database, PORT: String(port) },
    stdio: ["ignore", "ignore", "ignore"],
  });
  let patchRequests = 0;
  let dropNextPatchResponse = false;
  let delay = 0;
  let unavailable = false;
  const tls = createServer(
    { key: await readFile(key), cert: await readFile(certificate) },
    (incoming, outgoing) => {
      if (incoming.method === "PATCH") patchRequests++;
      if (unavailable) {
        outgoing.writeHead(503, { "content-type": "application/json" });
        outgoing.end("{}");
        incoming.resume();
        return;
      }
      const remote = httpRequest(
        {
          hostname: "127.0.0.1",
          port,
          path: incoming.url,
          method: incoming.method,
          headers: incoming.headers,
        },
        (response) => {
          if (incoming.method === "PATCH" && dropNextPatchResponse) {
            dropNextPatchResponse = false;
            // Wait until the independent process committed and sent its complete reply, then lose it.
            response.resume();
            response.on("end", () => outgoing.destroy());
            return;
          }
          const forward = () => {
            outgoing.writeHead(response.statusCode ?? 502, response.headers);
            response.pipe(outgoing);
          };
          if (delay) setTimeout(forward, delay);
          else forward();
        },
      );
      remote.on("error", () => {
        if (outgoing.headersSent || outgoing.destroyed) {
          outgoing.destroy();
          return;
        }
        outgoing.writeHead(503, { "content-type": "application/json" });
        outgoing.end("{}");
      });
      incoming.pipe(remote);
    },
  );
  await new Promise<void>((resolve) => tls.listen(tlsPort, "127.0.0.1", resolve));
  const base = `https://${hostname}/hubpanel/v1`;
  const metadata = path.join(directory, "test-transport.json");
  await writeFile(metadata, JSON.stringify({ hostname, port: tlsPort, certificate }));
  const ca = await readFile(certificate);
  async function transport(
    suppliedBase: string,
    endpoint: string,
    suppliedCredential: string,
    method = "GET",
    payload?: unknown,
  ): Promise<Record<string, unknown>> {
    assert.equal(suppliedBase, base);
    const body = payload === undefined ? undefined : JSON.stringify(payload);
    return new Promise((resolve, reject) => {
      const request = httpsRequest(
        {
          hostname: "127.0.0.1",
          port: tlsPort,
          servername: hostname,
          ca,
          rejectUnauthorized: true,
          path: `/hubpanel/v1${endpoint}`,
          method,
          headers: {
            authorization: `Bearer ${suppliedCredential}`,
            ...(body
              ? { "content-type": "application/json", "content-length": Buffer.byteLength(body) }
              : {}),
          },
        },
        (response) => {
          const chunks: Buffer[] = [];
          response.on("data", (chunk: Buffer) => chunks.push(chunk));
          response.on("error", () => reject(new Error("CONNECTION_UNAVAILABLE")));
          response.on("end", () => {
            if (response.statusCode === 409) return reject(new Error("CONFLICT"));
            if (response.statusCode !== 200) return reject(new Error("CONNECTION_UNAVAILABLE"));
            try {
              resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
            } catch {
              reject(new Error("INCOMPATIBLE_CONNECTION"));
            }
          });
        },
      );
      request.setTimeout(5000, () => request.destroy());
      request.on("error", () => reject(new Error("CONNECTION_UNAVAILABLE")));
      if (body) request.write(body);
      request.end();
    });
  }
  for (let attempt = 0; ; attempt++) {
    try {
      if ((await transport(base, "/health", credential)).status === "ok") break;
    } catch {}
    if (attempt >= 40) throw new Error("Independent content fixture did not start");
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return {
    base,
    credential,
    metadata,
    transport,
    get patchRequests() {
      return patchRequests;
    },
    loseNextReply() {
      dropNextPatchResponse = true;
    },
    delayResponses(milliseconds: number) {
      delay = milliseconds;
    },
    setUnavailable(value: boolean) {
      unavailable = value;
    },
    inspect() {
      const db = new DatabaseSync(database, { readOnly: true });
      try {
        return {
          article: db.prepare("SELECT title,version FROM articles WHERE id='welcome'").get(),
          operations: db.prepare("SELECT id,result FROM operations ORDER BY rowid").all(),
          audit: db.prepare("SELECT article,operation FROM audit ORDER BY id").all(),
        };
      } finally {
        db.close();
      }
    },
    async stopService() {
      if (child.exitCode === null && child.signalCode === null) {
        const exit = new Promise<void>((resolve) => child.once("exit", () => resolve()));
        child.kill();
        await exit;
      }
    },
    async close() {
      if (child.exitCode === null && child.signalCode === null) {
        const exit = new Promise<void>((resolve) => child.once("exit", () => resolve()));
        child.kill();
        await exit;
      }
      tls.closeAllConnections();
      await new Promise<void>((resolve) => tls.close(() => resolve()));
    },
  };
}
