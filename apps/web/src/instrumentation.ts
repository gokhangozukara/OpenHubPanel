export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.OPENHUB_OPERATOR !== "1") return;
  const { validateOperatorRuntime } = await import("@/server/operator/runtime");
  validateOperatorRuntime();
}
