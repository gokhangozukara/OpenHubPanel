import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

export const token = () => randomBytes(32).toString("base64url");
export const digest = (value: string) => createHash("sha256").update(value).digest("hex");

export function secretBox(key: string) {
  if (!/^[a-f0-9]{64}$/i.test(key) || /^(0{64}|f{64})$/i.test(key)) throw new Error("INVALID_ENCRYPTION_KEY");
  const bytes = Buffer.from(key, "hex");
  return {
    seal(value: string, context: string) {
      const iv = randomBytes(12);
      const cipher = createCipheriv("aes-256-gcm", bytes, iv);
      cipher.setAAD(Buffer.from(`openhubpanel:general:v1:${context}`));
      const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
      return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString("base64url");
    },
    open(value: string, context: string) {
      const data = Buffer.from(value, "base64url");
      const cipher = createDecipheriv("aes-256-gcm", bytes, data.subarray(0, 12));
      cipher.setAAD(Buffer.from(`openhubpanel:general:v1:${context}`));
      cipher.setAuthTag(data.subarray(12, 28));
      return Buffer.concat([cipher.update(data.subarray(28)), cipher.final()]).toString("utf8");
    },
  };
}
