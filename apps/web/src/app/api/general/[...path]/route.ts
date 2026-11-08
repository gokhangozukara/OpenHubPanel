import { randomUUID } from "node:crypto";
import { assertTrustedOrigin, safeTokenEqual } from "@openhubpanel/security";
import { cookies } from "next/headers";
import { token } from "@/server/general/crypto";
import { generalEnabled, generalRuntime } from "@/server/general/runtime";
import { clientIp } from "@/server/operator/access";
import { body } from "@/server/operator/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const options = { path: "/", secure: true, httpOnly: true, sameSite: "strict" as const };
const names = {
  session: "__Host-hubgeneral_session",
  challenge: "__Host-hubgeneral_challenge",
  csrf: "__Host-hubgeneral_csrf",
  browser: "__Host-hubgeneral_browser",
};
const headers = { "Cache-Control": "private, no-store, no-transform", "Referrer-Policy": "no-referrer" };
function json(value: unknown, status = 200) {
  return Response.json(value, { status, headers });
}
function rejected(error: unknown) {
  const message = error instanceof Error ? error.message : "UNAVAILABLE";
  const allowed = new Set([
    "UNAUTHENTICATED",
    "FORBIDDEN",
    "INVALID_CREDENTIALS",
    "INVALID_CODE",
    "INVALID_BOOTSTRAP",
    "INVALID_INVITATION",
    "INVALID_TRANSFER",
    "ALREADY_MEMBER",
    "SIGN_IN_REQUIRED",
    "PASSWORD_LENGTH",
    "COMMON_PASSWORD",
    "PASSWORD_COMPROMISED",
    "PASSWORD_CHECK_UNAVAILABLE",
    "LAST_OWNER",
    "TRANSFER_REQUIRED",
    "RATE_LIMITED",
    "CONFLICT",
    "UNKNOWN_OUTCOME",
    "NOT_FOUND",
    "CONNECTION_NOT_FOUND",
    "REMOTE_READ_ONLY",
    "INCOMPATIBLE_CONNECTION",
    "TARGET_APPROVAL_REQUIRED",
    "INVALID_CONNECTION_URL",
    "CONNECTION_TARGET_BLOCKED",
    "CONNECTION_PERMISSION_DENIED",
    "CONNECTION_UNAVAILABLE",
    "CONNECTION_RESPONSE_TOO_LARGE",
    "INVALID_INPUT",
  ]);
  const code =
    message === "UNTRUSTED_ORIGIN"
      ? "FORBIDDEN"
      : allowed.has(message)
        ? message
        : error instanceof Error && error.name === "ZodError"
          ? "INVALID_INPUT"
          : "UNAVAILABLE";
  return json(
    { error: code, requestId: randomUUID() },
    code === "UNAUTHENTICATED"
      ? 401
      : code === "FORBIDDEN"
        ? 403
        : code === "RATE_LIMITED"
          ? 429
          : code === "CONFLICT"
            ? 409
            : ["UNAVAILABLE", "UNKNOWN_OUTCOME"].includes(code)
              ? 503
              : 400,
  );
}
export async function GET(request: Request, context: RouteContext<"/api/general/[...path]">) {
  if (!generalEnabled()) return json({ error: "NOT_FOUND" }, 404);
  try {
    const { path } = await context.params;
    const services = generalRuntime();
    const jar = await cookies();
    if (path.join("/") === "state") {
      let csrf = jar.get(names.csrf)?.value;
      if (csrf?.length !== 43) {
        csrf = token();
        jar.set(names.csrf, csrf, { ...options, maxAge: 28800 });
      }
      if (!jar.get(names.browser)?.value) jar.set(names.browser, token(), { ...options, maxAge: 28800 });
      const raw = jar.get(names.session)?.value;
      try {
        if (!raw) throw new Error("UNAUTHENTICATED");
        const workspaces = await services.workspaces.list(raw);
        return json({ csrf, authenticated: true, workspaces });
      } catch (error) {
        if (!(error instanceof Error) || error.message !== "UNAUTHENTICATED") throw error;
        return json({ csrf, authenticated: false, workspaces: [] });
      }
    }
    const raw = jar.get(names.session)?.value ?? "";
    const workspace = new URL(request.url).searchParams.get("workspace") ?? "";
    if (path.join("/") === "workspace") return json(await services.workspaces.snapshot(raw, workspace));
    if (path.join("/") === "connections") return json(await services.connections.list(raw, workspace));
    if (path.length === 3 && path[0] === "connections" && path[2] === "articles")
      return json(await services.connections.read(raw, workspace, path[1] ?? ""));
    return json({ error: "NOT_FOUND" }, 404);
  } catch (error) {
    return rejected(error);
  }
}
async function post(request: Request, context: RouteContext<"/api/general/[...path]">) {
  if (!generalEnabled()) return json({ error: "NOT_FOUND" }, 404);
  try {
    assertTrustedOrigin(request.headers.get("origin"), process.env.APP_ORIGIN ?? "");
    const jar = await cookies();
    if (!safeTokenEqual(jar.get(names.csrf)?.value ?? "", request.headers.get("x-csrf-token") ?? ""))
      throw new Error("FORBIDDEN");
    if (!request.headers.get("content-type")?.startsWith("application/json"))
      throw new Error("INVALID_INPUT");
    const input = await body(request);
    const str = (name: string) => {
      if (typeof input[name] !== "string") throw new Error("INVALID_INPUT");
      return input[name] as string;
    };
    const { path } = await context.params;
    const action = path.join("/");
    const { auth, workspaces, connections } = generalRuntime();
    const raw = jar.get(names.session)?.value ?? "";
    const browser = jar.get(names.browser)?.value;
    if (browser?.length !== 43) throw new Error("FORBIDDEN");
    const ip = process.env.GENERAL_TRUST_PROXY === "1" ? clientIp(request.headers) : "shared-entry";
    if (["bootstrap", "enroll-invitation", "complete"].includes(action)) await auth.guard(ip, browser);
    if (["bootstrap", "login", "enroll-invitation"].includes(action)) {
      const result =
        action === "bootstrap"
          ? await auth.bootstrap(str("token"), str("email"), str("password"), browser)
          : action === "enroll-invitation"
            ? await auth.enrollInvitation(str("token"), str("password"), browser)
            : await auth.login(
                str("email"),
                str("password"),
                browser,
                ip,
                typeof input.recovery === "string" ? input.recovery : undefined,
              );
      jar.set(names.challenge, result.challenge, { ...options, maxAge: 300 });
      return json({ phase: result.phase, ...(result.secret ? { secret: result.secret } : {}) });
    }
    if (action === "complete") {
      const result = await auth.complete(jar.get(names.challenge)?.value ?? "", browser, str("code"));
      jar.set(names.session, result.session, { ...options, maxAge: 28800 });
      jar.set(names.challenge, "", { ...options, maxAge: 0 });
      jar.set(names.csrf, token(), { ...options, maxAge: 28800 });
      return json({ authenticated: true, recoveryCodes: result.recoveryCodes });
    }
    if (action === "logout") {
      await auth.revoke(raw, input.all === true);
      jar.set(names.session, "", { ...options, maxAge: 0 });
      return json({ ok: true });
    }
    if (action === "workspaces") return json(await workspaces.create(raw, str("name")));
    if (action === "accept-invitation") return json(await workspaces.accept(raw, str("token")));
    const workspace = str("workspace");
    if (
      [
        "member",
        "invitation",
        "cancel-invitation",
        "transfer",
        "accept-transfer",
        "connection",
        "change-connection",
        "article",
      ].includes(action)
    )
      await auth.guard(ip, `sensitive:${raw}`);
    if (action === "application")
      return json(
        await workspaces.application(raw, workspace, {
          name: str("name"),
          ...(typeof input.id === "string" && input.id ? { id: input.id } : {}),
          ...(typeof input.panelUrl === "string" ? { panelUrl: input.panelUrl } : {}),
          archived: input.archived === true,
        }),
      );
    if (action === "member") {
      await workspaces.member(raw, workspace, str("user"), str("role"), input.active === true, str("code"));
      return json({ ok: true });
    }
    if (action === "invitation")
      return json(
        await workspaces.invite(
          raw,
          workspace,
          str("email"),
          str("role"),
          str("code"),
          typeof input.previous === "string" ? input.previous : undefined,
        ),
      );
    if (action === "cancel-invitation") {
      await workspaces.cancelInvite(raw, workspace, str("id"), str("code"));
      return json({ ok: true });
    }
    if (action === "transfer") {
      await workspaces.transfer(raw, workspace, str("target"), str("code"));
      return json({ ok: true });
    }
    if (action === "accept-transfer") {
      await workspaces.acceptTransfer(raw, workspace, str("code"));
      return json({ ok: true });
    }
    if (action === "connection")
      return json(
        await connections.add(raw, workspace, {
          applicationId: str("applicationId"),
          name: str("name"),
          url: str("url"),
          credential: str("credential"),
          approveTarget: input.approveTarget === true,
          code: str("code"),
        }),
      );
    if (action === "test-connection") return json(await connections.test(raw, workspace, str("id")));
    if (action === "change-connection")
      return json(
        await connections.change(raw, workspace, str("id"), str("revision"), str("action"), str("code")),
      );
    if (action === "article") {
      if (!Number.isSafeInteger(input.expectedVersion)) throw new Error("INVALID_INPUT");
      return json(
        await connections.update(raw, workspace, str("id"), str("article"), {
          title: str("title"),
          expectedVersion: Number(input.expectedVersion),
          idempotencyKey: str("idempotencyKey"),
          revision: str("revision"),
          code: str("code"),
        }),
      );
    }
    return json({ error: "NOT_FOUND" }, 404);
  } catch (error) {
    return rejected(error);
  }
}

export async function POST(request: Request, context: RouteContext<"/api/general/[...path]">) {
  const response = await post(request, context);
  if (response.ok && generalEnabled()) {
    const raw = (await cookies()).get(names.session)?.value;
    if (raw) {
      try {
        await generalRuntime().auth.clearGuard(`sensitive:${raw}`);
      } catch {
        return rejected(new Error("UNAVAILABLE"));
      }
    }
  }
  return response;
}
