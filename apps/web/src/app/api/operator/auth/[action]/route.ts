import { cookies } from "next/headers";
import {
  beginLogin,
  beginRecovery,
  beginSetup,
  challengeCookie,
  changePassword,
  configured,
  cookieOptions,
  finishChallenge,
  requireSession,
  revoke,
  sessionCookie,
} from "@/server/operator/auth";
import { body, checkMutation, csrfToken, privateHeaders, rejection } from "@/server/operator/http";
import { enabled, limit } from "@/server/operator/store";

export async function GET(_request: Request, context: { params: Promise<{ action: string }> }) {
  if (!enabled() || (await context.params).action !== "status") return new Response(null, { status: 404 });
  try {
    const csrf = await csrfToken();
    let profile: { email: string } | null = null;
    try {
      profile = { email: requireSession((await cookies()).get(sessionCookie)?.value).email };
    } catch {
      /* An expired session gets the sign-in screen. */
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
    const action = (await context.params).action;
    const input = await body(request);
    const jar = await cookies();
    const raw = jar.get(sessionCookie)?.value;
    // This header is overwritten by the sole trusted, loopback reverse proxy.
    limit(`ip:${request.headers.get("x-openhub-client-ip") ?? "local"}`, 30, 60);
    if (action === "logout" || action === "revoke") {
      revoke(raw, action === "revoke");
      jar.set(sessionCookie, "", { ...cookieOptions, maxAge: 0 });
      jar.set(challengeCookie, "", { ...cookieOptions, maxAge: 0 });
      return Response.json({ ok: true }, { headers: privateHeaders });
    }
    if (action === "password") {
      await changePassword(raw, input.currentPassword, input.password, input.code);
      jar.set(sessionCookie, "", { ...cookieOptions, maxAge: 0 });
      return Response.json({ ok: true }, { headers: privateHeaders });
    }
    if (action === "verify") {
      const result = await finishChallenge(jar.get(challengeCookie)?.value, input.code);
      jar.set(sessionCookie, result.session, { ...cookieOptions, maxAge: 8 * 3600 });
      jar.set(challengeCookie, "", { ...cookieOptions, maxAge: 0 });
      return Response.json({ ok: true, recoveryCodes: result.recoveryCodes }, { headers: privateHeaders });
    }
    const result =
      action === "setup"
        ? await beginSetup(input.bootstrap, input.password)
        : action === "manual"
          ? await beginSetup(input.bootstrap, input.password, true)
          : action === "login"
            ? await beginLogin(input.email, input.password)
            : action === "recover"
              ? await beginRecovery(jar.get(challengeCookie)?.value, input.code)
              : null;
    if (!result) return new Response(null, { status: 404, headers: privateHeaders });
    jar.set(challengeCookie, result.challenge, { ...cookieOptions, maxAge: 300 });
    const { challenge: _privateChallenge, ...publicResult } = result;
    return Response.json(publicResult, { headers: privateHeaders });
  } catch (error) {
    return rejection(error);
  }
}
