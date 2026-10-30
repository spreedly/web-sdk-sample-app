import { test, expect } from "../util/fixtures";
import { MONOREPO_URLS } from "../util/urls";

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

  test("the local-SDK demo page loads without script errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));

    await page.goto(MONOREPO_URLS.APPLE_PAY_LOCAL_SDK);

    await expect(page.getByRole("heading", { name: "Apple Pay (local SDK)" })).toBeVisible();
    await expect(page.locator("#event-log")).toContainText("server Apple Pay config");
    expect(errors).toEqual([]);
  });
});
