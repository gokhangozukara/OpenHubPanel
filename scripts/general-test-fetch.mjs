// Test-process preload only; not imported by the application or packaged runtime.
// Keep browser tests deterministic without sending password prefixes to an external service.
const original = globalThis.fetch;
globalThis.fetch = (input, init) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  if (/^https:\/\/api\.pwnedpasswords\.com\/range\/[A-F0-9]{5}$/.test(url))
    return Promise.resolve(new Response(`${"A".repeat(35)}:0\r\n`, { status: 200 }));
  return original(input, init);
};
