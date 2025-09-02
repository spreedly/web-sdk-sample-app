import { test, expect } from "@playwright/test";

test.describe("Hosted Fields Integration", () => {
  test("should complete hosted fields flow successfully", async ({
    page,
  }) => {
    await page.goto("/");

    await page.waitForResponse(
      (response) =>
        response.url().includes("/api/auth/get-auth-params") &&
        response.status() === 200
    );

    const hostedFieldsButton = page.getByTestId("btn-hosted-fields");
    await expect(hostedFieldsButton).toBeEnabled();

    await hostedFieldsButton.click();
    await expect(page).toHaveURL("/hostedFields.html");

    const authParams = await page.evaluate(() => {
      const params = sessionStorage.getItem("authParams");
      return params ? JSON.parse(params) : null;
    });
    expect(authParams).toBeTruthy();
    expect(authParams["env-key"]).toBeTruthy();
    expect(authParams.nonce).toBeTruthy();

    await expect(page.locator('h2:has-text("Hosted Fields Payment Demo")')).toBeVisible();
    await expect(page.locator('h3:has-text("Personal Information")')).toBeVisible();
    await expect(page.locator('h3:has-text("Payment Details")')).toBeVisible();

    await expect(page.getByLabel("First Name")).toBeVisible();
    await expect(page.getByLabel("Last Name")).toBeVisible();
    await expect(page.getByLabel("Shipping Address")).toBeVisible();

    await expect(page.getByText("Credit Card Number")).toBeVisible();
    await expect(page.getByText("CVV")).toBeVisible();
    await expect(page.getByText("Expiration Date")).toBeVisible();

    await expect(page.locator("#expiry-month")).toBeVisible();
    await expect(page.locator("#expiry-year")).toBeVisible();
    await expect(page.getByRole("button", { name: "Submit Payment" })).toBeVisible();

    const cardNumberIframe = page.locator('iframe[src*="numberField.html"]');
    const cvvIframe = page.locator('iframe[src*="cvvField.html"]');

    await expect(cardNumberIframe).toBeVisible();
    await expect(cvvIframe).toBeVisible();

    await expect(cardNumberIframe).toHaveAttribute("src", /.*numberField\.html/);
    await expect(cvvIframe).toHaveAttribute("src", /.*cvvField\.html/);

    const cardNumberIframeId = await cardNumberIframe.getAttribute("id");
    const cvvIframeId = await cvvIframe.getAttribute("id");
    expect(cardNumberIframeId).toMatch(/spreedly-hosted-number-/);
    expect(cvvIframeId).toMatch(/spreedly-hosted-cvv-/);

    const cardNumberFrame = page.frameLocator('iframe[src*="numberField.html"]');
    const cvvFrame = page.frameLocator('iframe[src*="cvvField.html"]');

    await expect(cardNumberFrame.getByRole("textbox", { name: "card number" })).toBeVisible();
    await expect(cvvFrame.getByRole("textbox", { name: "cvv number" })).toBeVisible();

    await cardNumberFrame.locator('#spreedly-hosted-number-input').fill("4111111111111111");
    await cvvFrame.locator("#spreedly-hosted-cvv-input").fill("123");
    await page.locator("#expiry-year").fill((new Date().getFullYear() + 1).toString());
    await page.locator("#expiry-month").fill('05');

    await expect(cardNumberFrame.getByRole("textbox", { name: "card number" })).toHaveValue(/4111/);
    await expect(cvvFrame.getByRole("textbox", { name: "cvv number" })).toHaveValue("123");
  });
}); 