// Explicit test entrypoint, preloaded by the browser fixture outside the production artifact.
// Only this fixture hostname is mapped to a certificate-verified local TLS socket.
import dns from "node:dns/promises";
import { readFileSync } from "node:fs";
import https from "node:https";
import { syncBuiltinESMExports } from "node:module";
import path from "node:path";

const filename = process.env.OPENHUB_TEST_TRANSPORT_FILE;
const root = path.resolve(".local") + path.sep;
if (!filename || !path.resolve(filename).startsWith(root)) throw new Error("Invalid test transport file");
const fixture = JSON.parse(readFileSync(filename, "utf8"));
if (
  fixture.hostname !== "content-fixture.example.test" ||
  !Number.isInteger(fixture.port) ||
  !path.resolve(fixture.certificate).startsWith(root)
)
  throw new Error("Invalid test transport boundary");
const ca = readFileSync(fixture.certificate);
const lookup = dns.lookup;
dns.lookup = (hostname, options) => {
  if (hostname === fixture.hostname) {
    // Exercise remoteJson's public-address validation before the test socket substitution.
    return Promise.resolve(
      options?.all ? [{ address: "8.8.8.8", family: 4 }] : { address: "8.8.8.8", family: 4 },
    );
  }
  return lookup(hostname, options);
};
const request = https.request;
https.request = (url, options, callback) => {
  if (url instanceof URL && url.hostname === fixture.hostname) {
    const target = new URL(url);
    target.hostname = "127.0.0.1";
    target.port = String(fixture.port);
    return request(
      target,
      {
        ...options,
        ca,
        servername: fixture.hostname,
        rejectUnauthorized: true,
        headers: { ...options.headers, host: fixture.hostname },
        lookup: (_hostname, _options, done) => done(null, "127.0.0.1", 4),
      },
      callback,
    );
  }
  return request(url, options, callback);
};
syncBuiltinESMExports();
