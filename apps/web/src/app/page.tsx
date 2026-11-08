import { redirect } from "next/navigation";
import { HomeScreen } from "@/features/home/screen";
import { generalEnabled } from "@/server/general/runtime";

export default function HomePage() {
  if (generalEnabled()) redirect("/workspace");
  const preview = process.env.NODE_ENV !== "production" && process.env.OPENHUB_PREVIEW === "1";
  return <HomeScreen preview={preview} />;
}
