export function GET() {
  return Response.json(
    { status: "ok", service: "openhubpanel-web" },
    { headers: { "Cache-Control": "no-store" } },
  );
}
