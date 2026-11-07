import { cookies } from "next/headers";
import { requireSession, sessionCookie } from "@/server/operator/auth";
import { connector, saveSettings, validTarget } from "@/server/operator/connector";
import { body, checkMutation, privateHeaders, rejection } from "@/server/operator/http";
import { enabled } from "@/server/operator/store";

type Context = { params: Promise<{ app: string; section: string }> };
export async function GET(_request: Request, context: Context) {
  if (!enabled()) return new Response(null, { status: 404 });
  try {
    requireSession((await cookies()).get(sessionCookie)?.value);
    const { app, section } = await context.params;
    validTarget(app, section);
    return Response.json(await connector(`/apps/${app}/settings/${section}`), { headers: privateHeaders });
  } catch (error) {
    return rejection(error);
  }
}
export async function PUT(request: Request, context: Context) {
  if (!enabled()) return new Response(null, { status: 404 });
  try {
    await checkMutation(request);
    const { app, section } = await context.params;
    return Response.json(
      await saveSettings((await cookies()).get(sessionCookie)?.value, app, section, await body(request)),
      { headers: privateHeaders },
    );
  } catch (error) {
    return rejection(error);
  }
}
