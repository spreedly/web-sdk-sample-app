import { test, expect } from "@playwright/test";
import { URLS, API_ENDPOINTS, SELECTORS, HEADINGS } from "./test-constants";

test("opens express checkout in embedded mode when checkbox is checked", async ({ page }) => {
  // Navigate to the main page
  await page.goto(URLS.BASE);

  // Wait for auth params to be loaded
  await page.waitForResponse(
    (response) =>
      response.url().includes(API_ENDPOINTS.AUTH_PARAMS) &&
      response.status() === 200
  );

  // Check the 'Open in Embedded mode' option
  const openEmbeddedModeCheckbox = page.locator(SELECTORS.OPEN_IN_EMBEDDED_MODE);
  await expect(openEmbeddedModeCheckbox).toBeVisible();
  await openEmbeddedModeCheckbox.check();
  await expect(openEmbeddedModeCheckbox).toBeChecked();

  // Click on express checkout button
  const expressButton = page.getByTestId(SELECTORS.EXPRESS_BUTTON);
  await expect(expressButton).toBeEnabled();
  await expressButton.click();

  // Verify the payment iframe is visible
  const iframeLocator = page.locator(SELECTORS.EXPRESS_IFRAME);
  await expect(iframeLocator).toBeVisible();

  // Verify the iframe is embedded inside the container
  const embeddedIframe = page.locator('#checkout-plugin-container iframe.checkout-plugin');
  await expect(embeddedIframe).toBeVisible();

  // Sanity check: verify content inside the iframe is loaded
  const iframe = page.frameLocator(SELECTORS.EXPRESS_IFRAME);
  await expect(iframe.locator(`h1:has-text("${HEADINGS.EXPRESS_TITLE}")`)).toBeVisible();
});