import { cookies } from "next/headers";
import { requireSession, sessionCookie } from "@/server/operator/auth";
import { readOperatorCatalog } from "@/server/operator/connector";
import { enabled } from "@/server/operator/store";
import { probePilotApplication } from "@/server/pilot/catalog";
import { pilotCookieName, verifyPilotSession } from "@/server/pilot/session";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const headers = { "Cache-Control": "private, no-store" };
  let authenticated = false;
  if (enabled()) {
    try {
      requireSession((await cookies()).get(sessionCookie)?.value);
      authenticated = true;
    } catch {
      /* No data without native MFA. */
    }
  } else authenticated = await verifyPilotSession((await cookies()).get(pilotCookieName())?.value);
  if (!authenticated) return new Response(null, { status: 404, headers });
  try {
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
