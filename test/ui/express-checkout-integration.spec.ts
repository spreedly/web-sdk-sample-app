import { test, expect } from './fixtures';

test.describe("Express Checkout Integration", () => {
  test("should complete express checkout flow successfully", async ({
    page,
  }) => { 

    const expressButton = page.getByTestId("btn-express");
    await expect(expressButton).toBeEnabled();

    const hostedFieldsButton = page.getByTestId("btn-hosted-fields");
    await expect(hostedFieldsButton).toBeEnabled();

    await expressButton.click();

    const iframe = page.frameLocator("iframe.checkout-plugin");
    await expect(page.locator("iframe.checkout-plugin")).toBeVisible();

    const iframeElement = page.locator("iframe.checkout-plugin");
    await expect(iframeElement).toHaveClass("checkout-plugin");

    const payWithCardTitle = iframe.locator('h1:has-text("Pay with Card")');
    await expect(payWithCardTitle).toBeVisible();

    await expect(
      iframe.getByPlaceholder('Joe')
    ).toBeVisible();
    await expect(
      iframe.getByPlaceholder('Jones')
    ).toBeVisible();
    await expect(
      iframe.getByPlaceholder('1234 5678 9012 3456')
    ).toBeVisible();
    await expect(
      iframe.locator('input[placeholder="123"]')
    ).toBeVisible();
    await expect(
      iframe.locator('input[placeholder="MM"]')
    ).toBeVisible();
    await expect(
      iframe.locator('input[placeholder="YYYY"]')
    ).toBeVisible();

    await expect(iframe.locator('button:has-text("Pay")')).toBeVisible();
  });
});

