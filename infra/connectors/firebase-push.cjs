/* Installed on the host, never in the web process's credential scope. */
module.exports = function firebasePush({ jwt, pushRouting }) {
  const fs = require("node:fs");
  const credentialPath = (id, cfg) => pushRouting.credentialsPath({ app: { slug: id }, cfg });
  return {
    status(id, cfg) {
      return { ready: fs.existsSync(credentialPath(id, cfg)), topic: pushRouting.topicFor(id) };
    },
    normalize: pushRouting.normalizeTarget,
    async send(id, cfg, values, target) {
      const filename = credentialPath(id, cfg);
      const sa = JSON.parse(fs.readFileSync(filename, "utf8"));
      pushRouting.validateCredentials(sa, filename);
      const now = Math.floor(Date.now() / 1000);
      const assertion = jwt.sign(
        {
          iss: sa.client_email,
          scope: "https://www.googleapis.com/auth/firebase.messaging",
          aud: "https://oauth2.googleapis.com/token",
          iat: now,
          exp: now + 3000,
        },
        sa.private_key,
        { algorithm: "RS256" },
      );
      const auth = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }),
        signal: AbortSignal.timeout(10000),
      });
      const token = await auth.json();
      if (!auth.ok || !token.access_token)
        return { status: "failed", detail: "Firebase authorization failed" };
      const response = await fetch(`https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`, {
        method: "POST",
        headers: { authorization: `Bearer ${token.access_token}`, "content-type": "application/json" },
        body: JSON.stringify(pushRouting.messageFor(id, values.title, values.body, target)),
        signal: AbortSignal.timeout(10000),
      });
      const result = await response.json();
      return response.ok
        ? { status: "sent", detail: typeof result.name === "string" ? result.name : "Firebase accepted" }
        : { status: "failed", detail: `Firebase HTTP ${response.status}` };
    },
  };
};
