export function GET() {
  return Response.json(
    {
      error: {
        code: "NOT_READY",
        message: "The management API is not enabled yet.",
        requestId: randomUUID(),
      },
    },
    { status: 503, headers: { "Cache-Control": "no-store", "Retry-After": "3600" } },
  );
}

import { randomUUID } from "node:crypto";
