import { test, expect } from "../util/fixtures";
import { MONOREPO_URLS } from "../util/urls";

// The landing page groups its flow cards into collapsible sections.

const GROUPS = [
  { name: "Card tokenization", flows: ["tokenize", "tokenize-catalogue", "recache"] },
  {
    name: "Purchases and fraud checks",
    flows: ["purchase", "purchase-with-3ds", "purchase-with-3ds-gateway-specific", "stripe-radar"],
  },
  { name: "Wallets", flows: ["apple-pay", "google-pay", "paze", "click-to-pay"] },
  { name: "PayPal", flows: ["ppcp"] },
  { name: "Bank and offsite payments", flows: ["ach-payments", "offsite-payments"] },
];

const group = (page: any, name: string) =>
  page.locator("details.flow-group", { has: page.locator(".flow-group-title", { hasText: name }) });

test.describe("Landing page flow groups", () => {
  test("every group starts closed and shows how many flows it holds", async ({ page }) => {
    await page.goto(MONOREPO_URLS.BASE);

    await expect(page.locator(".flow-group-title")).toHaveText(GROUPS.map(g => g.name));
    for (const { name, flows } of GROUPS) {
      await expect(group(page, name)).not.toHaveAttribute("open");
      await expect(group(page, name).locator(".flow-group-count")).toHaveText(`(${flows.length})`);
      for (const flow of flows) {
        await expect(group(page, name).locator(`[data-flow="${flow}"]`)).toBeHidden();
      }
    }
  });

  test("opening a group shows its flows, and the page remembers it after a reload", async ({ page }) => {
    await page.goto(MONOREPO_URLS.BASE);

    await group(page, "Wallets").locator("summary").click();
    for (const flow of ["apple-pay", "google-pay", "paze", "click-to-pay"]) {
      await expect(page.locator(`[data-flow="${flow}"]`)).toBeVisible();
    }
    await expect(page.locator('[data-flow="tokenize"]')).toBeHidden();

    await page.reload();
    await expect(group(page, "Wallets")).toHaveAttribute("open");
    await expect(group(page, "Card tokenization")).not.toHaveAttribute("open");

    await group(page, "Wallets").locator("summary").click();
    await page.reload();
    await expect(group(page, "Wallets")).not.toHaveAttribute("open");
  });

  test("a group opens and closes with the keyboard", async ({ page }) => {
    await page.goto(MONOREPO_URLS.BASE);

    await group(page, "PayPal").locator("summary").focus();
    await page.keyboard.press("Enter");
    await expect(page.locator('[data-flow="ppcp"]')).toBeVisible();
    await page.keyboard.press("Space");
    await expect(page.locator('[data-flow="ppcp"]')).toBeHidden();
  });

  test("the PayPal group counts the PayPal Direct card only when it is shown", async ({ page }) => {
    await page.goto(`${MONOREPO_URLS.BASE}?showPPCPDirect`);

    await expect(group(page, "PayPal").locator(".flow-group-count")).toHaveText("(2)");
    await group(page, "PayPal").locator("summary").click();
    await expect(page.locator('[data-flow="ppcp/spike"]')).toBeVisible();
  });
});
