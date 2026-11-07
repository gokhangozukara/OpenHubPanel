import { cookies } from "next/headers";
import { clientIp } from "@/server/operator/access";
import { sessionCookie } from "@/server/operator/auth";
import { updateArticle } from "@/server/operator/connections";
import { body, checkMutation, privateHeaders, rejection } from "@/server/operator/http";
import { enabled } from "@/server/operator/store";
export async function PATCH(request: Request, context: { params: Promise<{ id: string; article: string }> }) {
  if (!enabled()) return new Response(null, { status: 404 });
  try {
    await checkMutation(request);
    const target = await context.params;
    return Response.json(
      await updateArticle(
        (await cookies()).get(sessionCookie)?.value,
        target.id,
        target.article,
        await body(request),
        clientIp(request.headers),
      ),
      { headers: privateHeaders },
    );
  } catch (error) {
    return rejection(error);
  }
}
