import { cookies } from "next/headers";
import { clientIp } from "@/server/operator/access";
import {
  type AuthResult,
  beginLogin,
  beginRecovery,
  beginSetup,
  challengeCookie,
  changePassword,
  configured,
  cookieOptions,
  finishChallenge,
  gateCookie,
  requireSession,
  revoke,
  securityProfile,
  selectCharacter,
  sessionCookie,
  updateSecurity,
} from "@/server/operator/auth";
import { body, checkMutation, csrfToken, privateHeaders, rejection } from "@/server/operator/http";
import { enabled, limit } from "@/server/operator/store";

export async function GET(request: Request, context: { params: Promise<{ action: string }> }) {
  if (!enabled()) return new Response(null, { status: 404 });
  try {
    const action = (await context.params).action,
      ip = clientIp(request.headers),
      raw = (await cookies()).get(sessionCookie)?.value;
    if (action === "security") return Response.json(securityProfile(raw, ip), { headers: privateHeaders });
    if (action !== "status") return new Response(null, { status: 404 });
    const csrf = await csrfToken();
    let profile: { email: string; username: string; mfaEnabled: boolean } | null = null;
    try {
      const session = requireSession(raw, ip);
      profile = { email: session.email, username: session.username, mfaEnabled: session.mfaEnabled };
    } catch {
      /* No private profile before sign-in. */
    }
    return Response.json(
      { csrf, configured: configured(), profile, email: process.env.OPERATOR_EMAIL },
      { headers: privateHeaders },
    );
  } catch (error) {
    return rejection(error);
  }
}
export async function POST(request: Request, context: { params: Promise<{ action: string }> }) {
  if (!enabled()) return new Response(null, { status: 404 });
  try {
    await checkMutation(request);
    const action = (await context.params).action,
      input = await body(request),
      jar = await cookies();
    const ip = clientIp(request.headers),
      raw = jar.get(sessionCookie)?.value;
    limit(`ip:${ip}`, 30, 60);
    if (action === "logout" || action === "revoke") {
      revoke(raw, action === "revoke", ip);
      for (const name of [sessionCookie, challengeCookie, gateCookie])
        jar.set(name, "", { ...cookieOptions, maxAge: 0 });
      return Response.json({ ok: true }, { headers: privateHeaders });
    }
    if (action === "password") {
      await changePassword(raw, input.currentPassword, input.password, input.code, ip);
      jar.set(sessionCookie, "", { ...cookieOptions, maxAge: 0 });
      return Response.json({ ok: true }, { headers: privateHeaders });
    }
    if (action === "character") {
      const result = selectCharacter(input.character, ip, jar.get(gateCookie)?.value);
      jar.set(gateCookie, result.gate ?? "", { ...cookieOptions, maxAge: result.gate ? 300 : 0 });
      return Response.json(result.gate ? { phase: "password" } : { error: "CHARACTER_INCORRECT" }, {
        status: result.gate ? 200 : 400,
        headers: privateHeaders,
      });
    }
    if (action === "verify") {
      const result = await finishChallenge(jar.get(challengeCookie)?.value, input.code, ip);
      jar.set(sessionCookie, result.session, { ...cookieOptions, maxAge: 28800 });
      jar.set(challengeCookie, "", { ...cookieOptions, maxAge: 0 });
      return Response.json(
        { phase: "complete", recoveryCodes: result.recoveryCodes },
        { headers: privateHeaders },
      );
    }
    let result: AuthResult | null = null;
    if (action === "setup" || action === "manual")
      result = await beginSetup(input.bootstrap, input.password, action === "manual", input, ip);
    else if (action === "login")
      result = await beginLogin(
        input.username ?? input.email,
        input.password,
        jar.get(gateCookie)?.value,
        ip,
      );
    else if (action === "recover")
      result = await beginRecovery(jar.get(challengeCookie)?.value, input.code, ip);
    else if (action === "security") result = await updateSecurity(raw, input, ip);
    if (!result) return new Response(null, { status: 404 });
    if (result.challenge) jar.set(challengeCookie, result.challenge, { ...cookieOptions, maxAge: 300 });
    if (result.session) jar.set(sessionCookie, result.session, { ...cookieOptions, maxAge: 28800 });
    else if (action === "security" && result.phase === "complete")
      jar.set(sessionCookie, "", { ...cookieOptions, maxAge: 0 });
    if (action === "login") jar.set(gateCookie, "", { ...cookieOptions, maxAge: 0 });
    const { challenge: _challenge, session: _session, gate: _gate, ...publicResult } = result;
    return Response.json(publicResult, { headers: privateHeaders });
  } catch (error) {
    return rejection(error);
  }
}
