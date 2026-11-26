import { cookies, headers } from "next/headers";
import { notFound } from "next/navigation";
import { LivePanel } from "@/features/operator/panel";
import { generalEnabled } from "@/server/general/runtime";
import { clientIp } from "@/server/operator/access";
import { requireSession, sessionCookie } from "@/server/operator/auth";
import { readOperatorCatalog } from "@/server/operator/connector";
import { enabled } from "@/server/operator/store";
import "../pilot/pilot.css";
import "./live.css";

export const dynamic = "force-dynamic";
export default async function LivePage() {
  if (!enabled()) notFound();
  let email: string | null = null;
  let mfaEnabled = true;
  try {
    const session = requireSession((await cookies()).get(sessionCookie)?.value, clientIp(await headers()));
    email = session.email;
    mfaEnabled = session.mfaEnabled;
  } catch {
    /* No catalog before strong authentication. */
  }
  return (
    <LivePanel
      email={email}
      mfaEnabled={mfaEnabled}
      applications={email ? await readOperatorCatalog() : []}
      basePath={process.env.OPENHUB_BASE_PATH ?? ""}
      workspaceHub={generalEnabled()}
    />
  );
}
