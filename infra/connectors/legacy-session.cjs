const { readFileSync } = require("node:fs");
const { timingSafeEqual } = require("node:crypto");

module.exports = function trustedOperatorSession(request, keyFile, account) {
  if (
    !["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(request.socket.remoteAddress) ||
    request.get("x-openhub-actor") !== account
  )
    return false;
  try {
    const expected = Buffer.from(readFileSync(keyFile, "utf8").trim());
    const actual = Buffer.from(request.get("x-openhub-proxy-token") ?? "");
    return expected.length >= 43 && expected.length === actual.length && timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
};
