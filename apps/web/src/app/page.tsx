import { HomeScreen } from "@/features/home/screen";

export default function HomePage() {
  const preview = process.env.NODE_ENV !== "production" && process.env.OPENHUB_PREVIEW === "1";
  return <HomeScreen preview={preview} />;
}
