import { test, expect } from "../util/fixtures";
import { MONOREPO_URLS } from "../util/urls";
import { showFlowCard } from "../pages/landingPage";

// Server checks for Apple Pay and a smoke test of the local-SDK demo page. They run against any
// deployment, with or without the APPLE_PAY_* settings. Apple's sheet can't be automated, so
// payments are tested by hand on a device.

test.describe.configure({ mode: "serial" });

const getServerConfig = async (request: any) => {
  const response = await request.get("/api/v1/apple-pay/config");
  expect(response.status()).toBe(200);
  return response.json() as Promise<{ merchantIdentifier: string | null; configured: boolean }>;
};


test.describe("Apple Pay demo", () => {
  test("serves the domain association file only when it is configured, with no redirect", async ({ request }) => {
    const response = await request.get(
      "/.well-known/apple-developer-merchantid-domain-association",
      { maxRedirects: 0 }
    );
    expect([200, 404]).toContain(response.status());
    if (response.status() === 200) {
      expect(response.headers()["content-type"]).toContain("text/plain");
      expect((await response.text()).length).toBeGreaterThan(0);
    }
  });

  test("other dotfiles are still not served", async ({ request }) => {
    const response = await request.get("/.env");
    expect(response.status()).toBe(404);
  });

  test("the validate route answers no-store, and 503 when Apple Pay isn't configured", async ({ request }) => {
    const { configured } = await getServerConfig(request);
    test.skip(configured, "Configured servers would call Apple; checked by hand on a device");

    const response = await request.post("/api/v1/apple-pay/validate", {
      data: { validationURL: "https://example.com/not-apple" },
    });
    expect(response.status()).toBe(503);
    expect(response.headers()["cache-control"]).toBe("no-store");
    expect(await response.json()).toEqual({ error: "not_configured" });
  });

  test("the validate route is rate-limited to 10 requests a minute", async ({ request }) => {
    const { configured } = await getServerConfig(request);
    test.skip(configured, "Configured servers would call Apple ten times");

    const statuses: number[] = [];
    for (let i = 0; i < 11; i += 1) {
      const response = await request.post("/api/v1/apple-pay/validate", { data: {} });
      statuses.push(response.status());
    }
    expect(statuses).toContain(429);
  });

  test("the end-to-end demo page loads without script errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));

    await page.goto(MONOREPO_URLS.APPLE_PAY_LOCAL_SDK);

    await expect(page.getByRole("heading", { name: "Apple Pay end to end" })).toBeVisible();
    await expect(page.locator("#event-log")).toContainText("server Apple Pay config");
    expect(errors).toEqual([]);
  });

  test("the landing page's Apple Pay card opens the Apple Pay start page with the chosen bundle", async ({ page }) => {
    await page.goto(MONOREPO_URLS.BASE);
    await page.locator("label.sdk-option", { has: page.locator('input[value="express-checkout"]') }).click();
    await (await showFlowCard(page, '[data-flow="apple-pay"]')).click();

    await expect(page).toHaveURL(/\/apple-pay\/index\.html\?sdk=express-checkout$/);
    await expect(page.getByRole("heading", { name: "Apple Pay", exact: true })).toBeVisible();
  });

  test("the start page needs a product, then opens the Apple Pay page with the cart total", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto(`${MONOREPO_URLS.APPLE_PAY}?sdk=hosted-fields`);
    const proceed = page.locator("#proceed");

    await expect(proceed).toBeDisabled();
    await expect(page.locator("#proceed-hint")).toHaveText("Add at least one product.");

    // Synthetic products: 2 × $149.99 + 1 × $79.99 = $379.97.
    const addOne = (index: number) => page.locator(".product-card").nth(index).locator('[data-delta="1"]').click();
    await addOne(0);
    await addOne(0);
    await addOne(2);
    await expect(page.locator("#cart-total")).toHaveText("$379.97");
    await expect(proceed).toBeEnabled();

    await proceed.click();
    await expect(page).toHaveURL(/\/apple-pay-local-sdk\/index\.html\?sdk=hosted-fields&amount=379\.97$/);
    await expect(page.locator("#amount")).toHaveValue("379.97");
    await expect(page.locator("#back-link")).toHaveAttribute("href", "../apple-pay/index.html?sdk=hosted-fields");
    expect(errors).toEqual([]);
  });

  test("the start page works with the keyboard alone", async ({ page }) => {
    await page.goto(`${MONOREPO_URLS.APPLE_PAY}?sdk=hosted-fields`);
    const focusedIs = (selector: string) =>
      page.evaluate(sel => document.activeElement?.matches(sel) ?? false, selector);
    const tabTo = async (selector: string) => {
      for (let i = 0; i < 20 && !(await focusedIs(selector)); i++) {
        await page.keyboard.press("Tab");
      }
      expect(await focusedIs(selector)).toBe(true);
    };

    await tabTo('[data-delta="1"]');
    await page.keyboard.press("Enter");
    await tabTo("#proceed");
    await expect(page.locator("#proceed")).toBeEnabled();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/apple-pay-local-sdk\/index\.html\?sdk=hosted-fields&amount=\d+\.\d{2}$/);
  });

  test("the Apple Pay page ignores an amount that isn't in Apple's format", async ({ page }) => {
    await page.goto(`${MONOREPO_URLS.APPLE_PAY_LOCAL_SDK}?amount=12.5`);
    await expect(page.locator("#amount")).toHaveValue("10.00");
  });
});
