import { jwtVerify } from "jose";

export async function verifyPilotSession(token: string | undefined): Promise<boolean> {
  if (process.env.OPENHUB_PILOT !== "1" || !token || token.length > 4096) return false;
  const secret = process.env.PILOT_SESSION_SECRET;
  const account = process.env.PILOT_ACCOUNT;
  if (!secret || secret.length < 32 || !account) return false;
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret), {
      algorithms: ["HS256"],
      requiredClaims: ["iat", "exp"],
      maxTokenAge: "8h",
      clockTolerance: 5,
    });
    return payload.u === account;
  } catch {
    return false;
  }
}

export function pilotCookieName() {
  return process.env.PILOT_SESSION_COOKIE ?? "hs_auth";
}
