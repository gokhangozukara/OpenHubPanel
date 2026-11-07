import { assertTrustedOrigin } from "@openhubpanel/security";
import { cookies } from "next/headers";
import { clientIp } from "@/server/operator/access";
import { requireSession, sessionCookie } from "@/server/operator/auth";
import { privateHeaders } from "@/server/operator/http";
import { enabled } from "@/server/operator/store";

export async function GET(request: Request) {
  if (!enabled()) return new Response(null, { status: 404 });
  try {
    const session = requireSession((await cookies()).get(sessionCookie)?.value, clientIp(request.headers));
    const method = request.headers.get("x-openhub-original-method") ?? "GET";
    if (!["GET", "HEAD"].includes(method))
      assertTrustedOrigin(request.headers.get("x-openhub-original-origin"), process.env.APP_ORIGIN ?? "");
    return new Response(null, {
      status: 204,
      headers: { ...privateHeaders, "X-OpenHub-Actor": session.email },
    });
  } catch (error) {
    const unauthorized = error instanceof Error && error.message === "UNAUTHENTICATED";
    return new Response(null, { status: unauthorized ? 401 : 403, headers: privateHeaders });
  }
}
