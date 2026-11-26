import { redirect } from "next/navigation";
import { HomeScreen } from "@/features/home/screen";
import { generalEnabled } from "@/server/general/runtime";
import { enabled as operatorEnabled } from "@/server/operator/store";

export default function HomePage() {
  if (generalEnabled() && !operatorEnabled()) redirect("/workspace");
  if (operatorEnabled() && !generalEnabled()) redirect("/live");
  const preview = process.env.NODE_ENV !== "production" && process.env.OPENHUB_PREVIEW === "1";
  return <HomeScreen preview={preview} general={generalEnabled()} operator={operatorEnabled()} />;
}
