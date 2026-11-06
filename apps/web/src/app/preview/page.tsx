import { notFound } from "next/navigation";
import { PreviewPanel } from "@/features/preview/panel";

export const dynamic = "force-dynamic";

export default function PreviewPage() {
  if (process.env.NODE_ENV === "production" || process.env.OPENHUB_PREVIEW !== "1") notFound();
  return <PreviewPanel />;
}
