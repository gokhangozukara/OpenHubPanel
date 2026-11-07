import { cookies } from "next/headers";
import { clientIp } from "@/server/operator/access";
import { sessionCookie } from "@/server/operator/auth";
import { changeConnection, readConnection } from "@/server/operator/connections";
import { body, checkMutation, privateHeaders, rejection } from "@/server/operator/http";
import { enabled } from "@/server/operator/store";

type Context = { params: Promise<{ id: string }> };
export async function GET(request: Request, context: Context) {
  if (!enabled()) return new Response(null, { status: 404 });
  try {
    return Response.json(
      await readConnection(
        (await cookies()).get(sessionCookie)?.value,
        (await context.params).id,
        clientIp(request.headers),
      ),
      { headers: privateHeaders },
    );
  } catch (error) {
    return rejection(error);
  }
}
export async function PATCH(request: Request, context: Context) {
  if (!enabled()) return new Response(null, { status: 404 });
  try {
    await checkMutation(request);
    return Response.json(
      await changeConnection(
        (await cookies()).get(sessionCookie)?.value,
        (await context.params).id,
        await body(request),
        clientIp(request.headers),
      ),
      { headers: privateHeaders },
    );
  } catch (error) {
    return rejection(error);
  }
}
