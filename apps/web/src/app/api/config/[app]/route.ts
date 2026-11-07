import { publicApplicationConfig } from "@/server/operator/connector";
import { enabled } from "@/server/operator/store";
export async function GET(_request: Request, context: { params: Promise<{ app: string }> }) {
  if (!enabled()) return new Response(null, { status: 404 });
  try {
    return Response.json(await publicApplicationConfig((await context.params).app), {
      headers: { "Access-Control-Allow-Origin": "*", "Cache-Control": "public, max-age=60, no-transform" },
    });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error && error.message === "APPLICATION_NOT_FOUND" ? "not_found" : "unavailable",
      },
      {
        status: error instanceof Error && error.message === "APPLICATION_NOT_FOUND" ? 404 : 503,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
}
