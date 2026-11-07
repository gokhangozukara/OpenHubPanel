import { cookies } from "next/headers";
import { requireSession, sessionCookie } from "@/server/operator/auth";
import { connector } from "@/server/operator/connector";
import { privateHeaders, rejection } from "@/server/operator/http";
import { enabled, state } from "@/server/operator/store";

export async function GET() {
  if (!enabled()) return new Response(null, { status: 404 });
  try {
    requireSession((await cookies()).get(sessionCookie)?.value);
    const db = state();
    let security: Record<string, unknown>[];
    try {
      security = db
        .prepare("SELECT id,time,event,target,result FROM operator_event ORDER BY id DESC LIMIT 100")
        .all();
    } finally {
      db.close();
    }
    return Response.json({ security, settings: await connector("/audit") }, { headers: privateHeaders });
  } catch (error) {
    return rejection(error);
  }
}
