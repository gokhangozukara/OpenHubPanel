import { notFound } from "next/navigation";
import { GeneralPanel } from "@/features/general/panel";
import { generalEnabled } from "@/server/general/runtime";
import { enabled as operatorEnabled } from "@/server/operator/store";
import "./general.css";

export const dynamic = "force-dynamic";
export default function WorkspacePage() {
  if (!generalEnabled()) notFound();
  return <GeneralPanel basePath={process.env.OPENHUB_BASE_PATH ?? ""} operatorHub={operatorEnabled()} />;
}
