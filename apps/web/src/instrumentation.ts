export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.OPENHUB_OPERATOR === "1") {
    const { validateOperatorRuntime } = await import("@/server/operator/runtime");
    validateOperatorRuntime();
  }
  if (process.env.GENERAL_ENABLED === "1") {
    const { validateGeneralRuntime } = await import("@/server/general/runtime");
    await validateGeneralRuntime();
  }
}
