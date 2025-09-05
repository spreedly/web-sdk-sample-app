import { test, expect } from './fixtures';
import {
  URLS,
  SELECTORS,
  PLACEHOLDERS,
  LABELS,
  TEST_DATA,
  HEADINGS,
} from './test-constants';

test.describe('Invalid Card Number Validation', () => {
  test('shows validation for invalid card in express checkout', async ({ page }) => {
    const expressButton = page.getByTestId(SELECTORS.EXPRESS_BUTTON);
    await expect(expressButton).toBeEnabled();
    await expressButton.click();

    const iframe = page.frameLocator(SELECTORS.EXPRESS_IFRAME);
    await expect(page.locator(SELECTORS.EXPRESS_IFRAME)).toBeVisible();

    const payWithCardTitle = iframe.locator(`h1:has-text("${HEADINGS.EXPRESS_TITLE}")`);
    await expect(payWithCardTitle).toBeVisible();

    const cardNumberField = iframe.getByPlaceholder(PLACEHOLDERS.EXPRESS_CARD_NUMBER);
    const cvvField = iframe.locator(`input[placeholder="${PLACEHOLDERS.EXPRESS_CVV}"]`);
    const monthField = iframe.locator(`input[placeholder="${PLACEHOLDERS.EXPRESS_MONTH}"]`);
    const yearField = iframe.locator(`input[placeholder="${PLACEHOLDERS.EXPRESS_YEAR}"]`);

    // Fill invalid card number and otherwise valid data
    await cardNumberField.fill(TEST_DATA.INVALID_CARD_NUMBER);
    await cvvField.fill(TEST_DATA.CVV);
    await monthField.fill(TEST_DATA.EXPIRY_MONTH);
    await yearField.fill((new Date().getFullYear() + 1).toString());

    // Expect card number field to be marked invalid
    await expect(cardNumberField).toHaveAttribute('aria-invalid', 'true');
  });

  test('shows validation for too-short and too-long card in express checkout', async ({ page }) => {
    const expressButton = page.getByTestId(SELECTORS.EXPRESS_BUTTON);
    await expect(expressButton).toBeEnabled();
    await expressButton.click();

    const iframe = page.frameLocator(SELECTORS.EXPRESS_IFRAME);
    await expect(page.locator(SELECTORS.EXPRESS_IFRAME)).toBeVisible();

    const cardNumberField = iframe.getByPlaceholder(PLACEHOLDERS.EXPRESS_CARD_NUMBER);

    // Too short
    await cardNumberField.fill(TEST_DATA.CARD_NUMBER_TOO_SHORT);
    await expect(cardNumberField).toHaveAttribute('aria-invalid', 'true');

    // Too long
    await cardNumberField.fill(TEST_DATA.CARD_NUMBER_TOO_LONG);
    await expect(cardNumberField).toHaveAttribute('aria-invalid', 'true');
  });

  test('shows validation for invalid card in hosted fields', async ({ page }) => {
    const hostedFieldsButton = page.getByTestId(SELECTORS.HOSTED_FIELDS_BUTTON);
    await expect(hostedFieldsButton).toBeEnabled();
    await hostedFieldsButton.click();

    await expect(page).toHaveURL(URLS.HOSTED_FIELDS);
    await expect(page.locator(`h2:has-text("${HEADINGS.HOSTED_FIELDS_TITLE}")`)).toBeVisible();

    const cardNumberIframe = page.locator(SELECTORS.HOSTED_CARD_IFRAME);
    const cvvIframe = page.locator(SELECTORS.HOSTED_CVV_IFRAME);
    await expect(cardNumberIframe).toBeVisible();
    await expect(cvvIframe).toBeVisible();

    const cardNumberFrame = page.frameLocator(SELECTORS.HOSTED_CARD_IFRAME);
    const cvvFrame = page.frameLocator(SELECTORS.HOSTED_CVV_IFRAME);

    await expect(cardNumberFrame.getByRole('textbox', { name: LABELS.CARD_NUMBER })).toBeVisible();
    await expect(cvvFrame.getByRole('textbox', { name: LABELS.CVV_NUMBER })).toBeVisible();

    // Fill invalid card number and otherwise valid CVV/expiry on outer fields
    await cardNumberFrame.locator(SELECTORS.HOSTED_CARD_INPUT).fill(TEST_DATA.INVALID_CARD_NUMBER);
    await cvvFrame.locator(SELECTORS.HOSTED_CVV_INPUT).fill(TEST_DATA.CVV);

    // The hosted inputs do not own expiry fields; fill the page-level expiry fields
    const expiryMonthField = page.locator(SELECTORS.EXPIRY_MONTH);
    const expiryYearField = page.locator(SELECTORS.EXPIRY_YEAR);
    await expiryMonthField.fill(TEST_DATA.EXPIRY_MONTH);
    await expiryYearField.fill((new Date().getFullYear() + 1).toString());

    // Expect card number input in the frame to be marked invalid
    const hostedNumberInput = cardNumberFrame.locator(SELECTORS.HOSTED_CARD_INPUT);
    await expect(hostedNumberInput).toHaveAttribute('aria-invalid', 'true');
  });

  test('shows validation for too-short and too-long card in hosted fields', async ({ page }) => {
    const hostedFieldsButton = page.getByTestId(SELECTORS.HOSTED_FIELDS_BUTTON);
    await expect(hostedFieldsButton).toBeEnabled();
    await hostedFieldsButton.click();

    await expect(page).toHaveURL(URLS.HOSTED_FIELDS);

    const cardNumberFrame = page.frameLocator(SELECTORS.HOSTED_CARD_IFRAME);
    const hostedNumberInput = cardNumberFrame.locator(SELECTORS.HOSTED_CARD_INPUT);

    // Too short
    await hostedNumberInput.fill(TEST_DATA.CARD_NUMBER_TOO_SHORT);
    await expect(hostedNumberInput).toHaveAttribute('aria-invalid', 'true');
    

    // Too long
    await hostedNumberInput.fill(TEST_DATA.CARD_NUMBER_TOO_LONG);
    await expect(hostedNumberInput).toHaveAttribute('aria-invalid', 'true');
  });
});

