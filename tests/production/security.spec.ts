import { expect, test } from "@playwright/test";

test("production scripts carry a fresh server nonce and hydration still works", async ({ page, request }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const response = await page.goto("/");
  const policy = response?.headers()["content-security-policy"] ?? "";
  const nonce = /'nonce-([^']+)'/.exec(policy)?.[1];
  expect(nonce).toMatch(/^[A-Za-z0-9+/]{43}=$/);
  expect(policy).not.toContain("'unsafe-inline'");
  expect(policy).not.toContain("'unsafe-eval'");
  expect(policy).toContain("'strict-dynamic'");
  expect(response?.headers()["cache-control"]).toContain("no-store");
  const scripts = await page
    .locator("script")
    .evaluateAll((elements) => elements.map((element) => (element as HTMLScriptElement).nonce));
  expect(scripts.length).toBeGreaterThan(0);
  expect(scripts.every((value) => value === nonce)).toBe(true);
  await page.locator(".language-selector select").selectOption("de");
  await expect(page.locator("html")).toHaveAttribute("lang", "de");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "de");
  expect(errors).toEqual([]);
  const second = await request.get("/");
  expect(second.headers()["content-security-policy"]).not.toContain(`'nonce-${nonce}'`);
});

test("browser blocks an injected inline script without the server nonce", async ({ page }) => {
  await page.addInitScript(() => {
    document.addEventListener("securitypolicyviolation", (event) => {
      if (event.blockedURI === "inline")
        document.documentElement.dataset.blockedScript = event.effectiveDirective;
    });
  });
  // Insert into the response so the normal HTML parser, not DevTools evaluation,
  // attempts execution under the server's actual policy.
  await page.route("http://127.0.0.1:3101/", async (route) => {
    const response = await route.fetch();
    const body = (await response.text()).replace(
      "</head>",
      '<script>document.documentElement.dataset.injected = "executed"</script></head>',
    );
    await route.fulfill({ response, body });
  });
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-blocked-script", "script-src-elem");
  await expect(page.locator("html")).not.toHaveAttribute("data-injected", "executed");
});

test("spoofed policy and prefetch headers cannot select or bypass the nonce", async ({ request }) => {
  const response = await request.get("/", {
    headers: {
      "x-nonce": "attacker-selected",
      "Content-Security-Policy": "script-src 'unsafe-inline' 'nonce-attacker-selected'",
      "next-router-prefetch": "1",
      purpose: "prefetch",
    },
  });
  expect(response.status()).toBe(200);
  expect(response.headers()["content-security-policy"]).toContain("'nonce-");
  expect(response.headers()["content-security-policy"]).not.toContain("attacker-selected");
  expect(await response.text()).not.toContain('nonce="attacker-selected"');
});

test("production preview stays closed and errors retain CSP", async ({ request }) => {
  for (const path of ["/preview", "/missing-page"]) {
    const response = await request.get(path);
    expect(response.status()).toBe(404);
    expect(response.headers()["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(response.headers()["content-security-policy"]).not.toContain("'unsafe-inline'");
  }
  expect((await request.get("/api/v1")).status()).toBe(503);
  expect((await request.get("/api/internal/ready")).status()).toBe(404);
});
