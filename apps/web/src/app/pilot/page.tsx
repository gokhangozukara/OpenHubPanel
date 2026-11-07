import "./pilot.css";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { PilotPanel } from "@/features/pilot/panel";
import { enabled } from "@/server/operator/store";
import { readPilotCatalog } from "@/server/pilot/catalog";
import { pilotCookieName, verifyPilotSession } from "@/server/pilot/session";

export default async function PilotPage() {
  if (enabled()) redirect(`${process.env.OPENHUB_BASE_PATH ?? ""}/live`);
  if (process.env.OPENHUB_PILOT !== "1") notFound();
  if (!(await verifyPilotSession((await cookies()).get(pilotCookieName())?.value)))
    redirect(process.env.PILOT_LOGIN_URL ?? "/login");
  return <PilotPanel applications={readPilotCatalog()} basePath={process.env.OPENHUB_BASE_PATH ?? ""} />;
}
