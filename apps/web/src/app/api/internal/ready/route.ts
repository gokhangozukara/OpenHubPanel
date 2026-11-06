import { safeTokenEqual } from "@openhubpanel/security";
import { checkReadiness } from "@/server/readiness";

export async function GET(request: Request) {
  const token = process.env.READINESS_TOKEN;
  if (
    !token ||
    token.length < 32 ||
    !safeTokenEqual(request.headers.get("authorization") ?? "", `Bearer ${token}`)
  ) {
    return new Response(null, { status: 404, headers: { "Cache-Control": "no-store" } });
  }
  try {
    const ready = await checkReadiness();
    return Response.json(
      { status: ready ? "ready" : "unavailable" },
      { status: ready ? 200 : 503, headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json(
      { status: "unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
