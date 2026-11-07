import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { LivePanel } from "@/features/operator/panel";
import { requireSession, sessionCookie } from "@/server/operator/auth";
import { readOperatorCatalog } from "@/server/operator/connector";
import { enabled } from "@/server/operator/store";
import "../pilot/pilot.css";
import "./live.css";

export const dynamic = "force-dynamic";
export default async function LivePage() {
  if (!enabled()) notFound();
  let email: string | null = null;
  try {
    email = requireSession((await cookies()).get(sessionCookie)?.value).email;
  } catch {
    /* No catalog before strong authentication. */
  }
  return (
    <LivePanel
      email={email}
      applications={email ? await readOperatorCatalog() : []}
      basePath={process.env.OPENHUB_BASE_PATH ?? ""}
    />
  );
}
