import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { chmodSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import { backup, DatabaseSync } from "node:sqlite";
import { gunzipSync, gzipSync } from "node:zlib";

const key = process.env.OPERATOR_BACKUP_KEY;
if (!key || !/^[a-f0-9]{64}$/.test(key)) throw new Error("A separate OPERATOR_BACKUP_KEY is required");
const folder = process.env.OPERATOR_BACKUP_DIR;
if (!folder || !path.isAbsolute(folder)) throw new Error("An absolute OPERATOR_BACKUP_DIR is required");
mkdirSync(folder, { recursive: true, mode: 0o700 });
const restore = process.argv[2] === "restore-test";
if (restore) {
  const input = process.argv[3];
  const destination = process.argv[4];
  if (
    !input ||
    !destination ||
    !path.isAbsolute(destination) ||
    path.resolve(destination) === path.resolve(process.env.OPERATOR_STATE_FILE ?? ".")
  )
    throw new Error("Restore tests require an independent output path");
  const envelope = JSON.parse(readFileSync(input, "utf8"));
  if (envelope.version !== 1) throw new Error("Unsupported backup version");
  const decipher = createDecipheriv(
    "aes-256-gcm",
    Buffer.from(key, "hex"),
    Buffer.from(envelope.iv, "base64"),
  );
  decipher.setAAD(Buffer.from("openhubpanel:operator-backup:v1"));
  decipher.setAuthTag(Buffer.from(envelope.tag, "base64"));
  const contents = gunzipSync(
    Buffer.concat([decipher.update(Buffer.from(envelope.data, "base64")), decipher.final()]),
  );
  writeFileSync(destination, contents, { mode: 0o600, flag: "wx" });
  const db = new DatabaseSync(destination);
  try {
    if (db.prepare("PRAGMA integrity_check").get().integrity_check !== "ok")
      throw new Error("Restore integrity failed");
    db.exec(
      "BEGIN IMMEDIATE; UPDATE operator_session SET revoked=1; DELETE FROM operator_challenge; DELETE FROM operator_recovery; DELETE FROM operator_bootstrap; UPDATE operator_user SET recovery_required=1;",
    );
    db.prepare("INSERT INTO operator_event(time,event,target,result) VALUES(?,?,?,?)").run(
      Math.floor(Date.now() / 1000),
      "restore.requires-enrollment",
      "operator",
      "success",
    );
    db.exec("COMMIT");
    console.log(
      "Restore verified; sessions and recovery state revoked; trusted operator re-enrollment required.",
    );
  } finally {
    db.close();
  }
} else {
  const source = process.env.OPERATOR_STATE_FILE;
  if (!source || !path.isAbsolute(source)) throw new Error("An absolute OPERATOR_STATE_FILE is required");
  const temporary = path.join(folder, `.snapshot-${randomBytes(12).toString("hex")}.sqlite`);
  const name = `identity-${new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d+Z$/, "Z")}.ohpb`;
  try {
    const db = new DatabaseSync(source, { readOnly: true });
    try {
      await backup(db, temporary);
    } finally {
      db.close();
    }
    chmodSync(temporary, 0o600);
    const iv = randomBytes(12),
      cipher = createCipheriv("aes-256-gcm", Buffer.from(key, "hex"), iv);
    cipher.setAAD(Buffer.from("openhubpanel:operator-backup:v1"));
    const data = Buffer.concat([cipher.update(gzipSync(readFileSync(temporary))), cipher.final()]);
    const destination = path.join(folder, name);
    writeFileSync(
      `${destination}.tmp`,
      JSON.stringify({
        version: 1,
        iv: iv.toString("base64"),
        tag: cipher.getAuthTag().toString("base64"),
        data: data.toString("base64"),
      }),
      { mode: 0o600 },
    );
    renameSync(`${destination}.tmp`, destination);
    console.log(destination);
  } finally {
    try {
      unlinkSync(temporary);
    } catch {
      /* A failed snapshot may not have created a file. */
    }
  }
}
