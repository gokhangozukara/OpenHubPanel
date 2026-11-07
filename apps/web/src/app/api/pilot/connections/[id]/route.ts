import { cookies } from "next/headers";
import { clientIp } from "@/server/operator/access";
import { requireSession, sessionCookie } from "@/server/operator/auth";
import { publicApplicationConfig, readOperatorCatalog } from "@/server/operator/connector";
import { enabled } from "@/server/operator/store";
import { probePilotApplication } from "@/server/pilot/catalog";
import { pilotCookieName, verifyPilotSession } from "@/server/pilot/session";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const headers = { "Cache-Control": "private, no-store" };
  let authenticated = false;
  if (enabled()) {
    try {
      requireSession((await cookies()).get(sessionCookie)?.value, clientIp(_request.headers));
      authenticated = true;
    } catch {
      /* No data without native MFA. */
    }
  } else authenticated = await verifyPilotSession((await cookies()).get(pilotCookieName())?.value);
  if (!authenticated) return new Response(null, { status: 404, headers });
  try {
    if (enabled() && process.env.OPERATOR_DATA_MODE === "embedded") {
      const start = performance.now();
      await publicApplicationConfig((await context.params).id);
      return Response.json(
        { status: "reachable", durationMs: Math.round(performance.now() - start) },
        { headers },
      );
    }
    return Response.json(
      await probePilotApplication(
        (await context.params).id,
        enabled() ? await readOperatorCatalog() : undefined,
      ),
      { headers },
    );
  } catch (error) {
    const missing = error instanceof Error && error.message === "APPLICATION_NOT_FOUND";
    return Response.json(
      { status: missing ? "not_found" : "unavailable" },
      { status: missing ? 404 : 503, headers },
    );
  }
}
