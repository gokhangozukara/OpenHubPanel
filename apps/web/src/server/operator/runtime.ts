import { isAbsolute } from "node:path";
import { seal, state, unseal } from "./store";

export function validateOperatorRuntime() {
  const origin = new URL(process.env.APP_ORIGIN ?? "invalid:");
  if (!process.env.OPERATOR_EMAIL || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(process.env.OPERATOR_EMAIL))
    throw new Error("Invalid OPERATOR_EMAIL");
  if (!process.env.OPERATOR_STATE_FILE || !isAbsolute(process.env.OPERATOR_STATE_FILE))
    throw new Error("Invalid OPERATOR_STATE_FILE");
  if (
    origin.protocol !== "https:" ||
    origin.username ||
    origin.password ||
    origin.pathname !== "/" ||
    origin.search ||
    origin.hash
  ) {
    if (
      process.env.NODE_ENV === "production" ||
      origin.protocol !== "http:" ||
      !["localhost", "127.0.0.1"].includes(origin.hostname)
    )
      throw new Error("Invalid operator APP_ORIGIN");
  }
  if (process.env.OPERATOR_DATA_MODE !== "embedded") {
    if (!process.env.OPERATOR_CONNECTOR_TOKEN || process.env.OPERATOR_CONNECTOR_TOKEN.length < 43)
      throw new Error("Invalid OPERATOR_CONNECTOR_TOKEN");
    const upstream = new URL(process.env.PILOT_UPSTREAM_ORIGIN ?? "invalid:");
    if (
      upstream.protocol !== "http:" ||
      upstream.hostname !== "127.0.0.1" ||
      upstream.pathname !== "/" ||
      upstream.username ||
      upstream.password ||
      upstream.search ||
      upstream.hash
    )
      throw new Error("Invalid operator upstream");
  }
  if (unseal(seal("runtime-check", "runtime"), "runtime") !== "runtime-check")
    throw new Error("Invalid operator encryption");
  const db = state();
  try {
    db.prepare("SELECT id FROM operator_user WHERE id=1").get();
    db.prepare("SELECT hash FROM operator_session LIMIT 1").get();
  } finally {
    db.close();
  }
}
