import { cookies } from "next/headers";
import { clientIp } from "@/server/operator/access";
import { requireSession, sessionCookie } from "@/server/operator/auth";
import { addConnection, listConnections } from "@/server/operator/connections";
import { readOperatorCatalog } from "@/server/operator/connector";
import { body, checkMutation, privateHeaders, rejection } from "@/server/operator/http";
import { enabled } from "@/server/operator/store";
export async function GET(request: Request) {
  if (!enabled()) return new Response(null, { status: 404 });
  try {
    const raw = (await cookies()).get(sessionCookie)?.value;
    const ip = clientIp(request.headers);
    requireSession(raw, ip);
    return Response.json(
      {
        connections: listConnections(raw, ip),
        installation: {
          origin: process.env.APP_ORIGIN,
          basePath: process.env.OPENHUB_BASE_PATH ?? "",
          mode: process.env.OPERATOR_DATA_MODE === "embedded" ? "standalone" : "host",
          applications: (await readOperatorCatalog()).length,
        },
      },
      { headers: privateHeaders },
    );
  } catch (error) {
    return rejection(error);
  }
}
export async function POST(request: Request) {
  if (!enabled()) return new Response(null, { status: 404 });
  try {
    await checkMutation(request);
    return Response.json(
      await addConnection(
        (await cookies()).get(sessionCookie)?.value,
        await body(request),
        clientIp(request.headers),
      ),
      { headers: privateHeaders },
    );
  } catch (error) {
    return rejection(error);
  }
}
