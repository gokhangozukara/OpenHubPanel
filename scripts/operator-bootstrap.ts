import { mkdirSync } from "node:fs";
import path from "node:path";
import {
  digest,
  event,
  migrate,
  now,
  state,
  token,
  transaction,
} from "../apps/web/src/server/operator/store";

// Run only from a trusted server console, with the same private environment as
// the application. The token is displayed once, never stored in plaintext.
const filename = process.env.OPERATOR_STATE_FILE;
if (!filename || !process.env.OPERATOR_EMAIL || !process.env.OPERATOR_KEY)
  throw new Error("Operator environment required");
mkdirSync(path.dirname(filename), { recursive: true, mode: 0o700 });
const db = state();
try {
  migrate(db);
  if (process.argv.includes("--migrate")) console.log("Operator schema ready");
  else
    transaction(db, () => {
      const manual = process.argv.includes("--recover");
      const reason = process.argv.find((argument) => argument.startsWith("--reason="))?.slice(9);
      if (manual && (!reason || reason.length > 200))
        throw new Error("Manual recovery requires --reason=verified-identity-and-reason");
      if (db.prepare("SELECT id FROM operator_user").get() && !manual)
        throw new Error("Operator already enrolled; use the recovery runbook");
      if (manual) {
        if (
          !db
            .prepare("UPDATE operator_user SET recovery_required=1 WHERE id=1 AND active=1 RETURNING id")
            .get()
        )
          throw new Error("No owner to recover");
        db.prepare("UPDATE operator_session SET revoked=1").run();
        db.prepare("DELETE FROM operator_challenge").run();
        db.prepare("DELETE FROM operator_recovery").run();
        event(db, "manual-recovery.authorized", reason);
      }
      const value = token();
      db.prepare("INSERT OR REPLACE INTO operator_bootstrap(id,hash,expires) VALUES(1,?,?)").run(
        digest(value),
        now() + 900,
      );
      event(db, "bootstrap.created");
      console.log(
        `${process.env.APP_ORIGIN}${process.env.OPENHUB_BASE_PATH ?? ""}/live#bootstrap=${value}${manual ? "&recovery=1" : ""}`,
      );
    });
} finally {
  db.close();
}
