function safeNext(value) {
  if (typeof value !== "string") return "/legacy";
  if (["/studio", "/legacy", "/openhub/live", "/openhub/pilot"].includes(value)) return value;
  return /^\/app\/[a-z0-9][a-z0-9-]{0,63}(?:\?tab=(?:ads|popup|announce|push|update|pro|notes|content))?$/.test(
    value,
  )
    ? value
    : "/legacy";
}
module.exports = { safeNext };
