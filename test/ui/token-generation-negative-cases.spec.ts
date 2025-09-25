import { test, expect } from './fixtures';
import { Page } from '@playwright/test';
import {
  URLS,
  SELECTORS,
  PLACEHOLDERS,
  TEST_DATA,
  HEADINGS,
  getValidYearString,
  waitForAuthParams,
  ERROR_MESSAGES,
  ERROR_PATTERNS,
  LABELS,
  getInvalidYearString,
} from './test-constants';  

function captureApiResponse(page: Page, responseData: {
    firstClickResponse: any;
    firstClickStatus: number | null;
    secondClickResponse: any;
    secondClickStatus: number | null;
    clickCount: number;
}) {
    page.on('response', async (response: any) => {
        const url = response.url();
        // Check if this is a token generation API call
        if (url.includes('/v1/payment_methods/restricted.json') || url.includes('/v1/payment_methods')) {
          responseData.clickCount++;
          try {
            const responseJson = await response.json();
            console.log(`API Request URL (Click ${responseData.clickCount}):`, url);
            console.log(`API Response Status (Click ${responseData.clickCount}):`, response.status());
            if (responseData.clickCount === 1) {
              responseData.firstClickStatus = response.status();
              responseData.firstClickResponse = responseJson;
            } else if (responseData.clickCount === 2) {
              responseData.secondClickStatus = response.status();
              responseData.secondClickResponse = responseJson;
            }
          } catch (error) {
            console.log(`Response is not JSON or empty for click ${responseData.clickCount}`);
            if (responseData.clickCount === 1) {
              responseData.firstClickStatus = response.status();
            } else if (responseData.clickCount === 2) {
              responseData.secondClickStatus = response.status();
            }
          }
        }
      });
}

async function fillFormHostedFields(page: Page, year:string) {
    const firstNameField = page.getByLabel(LABELS.FIRST_NAME);
    const lastNameField = page.getByLabel(LABELS.LAST_NAME);
    const expiryMonthField = page.getByTestId(SELECTORS.EXPIRY_MONTH);
    const expiryYearField = page.getByTestId(SELECTORS.EXPIRY_YEAR);
    const cardNumberIframe = page.locator(SELECTORS.HOSTED_CARD_IFRAME);
    const cvvIframe = page.locator(SELECTORS.HOSTED_CVV_IFRAME);
    await expect(cardNumberIframe).toBeVisible();
    await expect(cvvIframe).toBeVisible();
    const cardNumberFrame = page.frameLocator(SELECTORS.HOSTED_CARD_IFRAME);
    const cvvFrame = page.frameLocator(SELECTORS.HOSTED_CVV_IFRAME);
    await firstNameField.fill(TEST_DATA.FIRST_NAME);
    await lastNameField.fill(TEST_DATA.LAST_NAME);
    await cardNumberFrame.getByTestId(SELECTORS.HOSTED_NUMBER_FIELD).fill(TEST_DATA.CARD_NUMBER_FORMATTED);
    await cardNumberFrame.getByTestId(SELECTORS.HOSTED_NUMBER_FIELD).click();
    await page.waitForTimeout(TEST_DATA.TIMEOUT_SHORT);
    await cvvFrame.getByTestId(SELECTORS.HOSTED_CVV_FIELD).fill(TEST_DATA.CVV);
    await expiryMonthField.fill(TEST_DATA.EXPIRY_MONTH);
    await expiryYearField.fill(year);  
}

async function fillFormExpressCheckout(page: Page, year:string) {
    const iframe = page.frameLocator(SELECTORS.EXPRESS_IFRAME);
    await expect(page.locator(SELECTORS.EXPRESS_IFRAME)).toBeVisible();
    const payWithCardTitle = iframe.locator(`h1:has-text("${HEADINGS.EXPRESS_TITLE}")`);
    await expect(payWithCardTitle).toBeVisible();
    const firstNameField = iframe.getByPlaceholder(PLACEHOLDERS.EXPRESS_FIRST_NAME);
    const lastNameField = iframe.getByPlaceholder(PLACEHOLDERS.EXPRESS_LAST_NAME);
    const cardNumberField = iframe.getByPlaceholder(PLACEHOLDERS.EXPRESS_CARD_NUMBER);
    const cvvField = iframe.locator(`input[placeholder="${PLACEHOLDERS.EXPRESS_CVV}"]`);
    const monthField = iframe.locator(`input[placeholder="${PLACEHOLDERS.EXPRESS_MONTH}"]`);
    const yearField = iframe.locator(`input[placeholder="${PLACEHOLDERS.EXPRESS_YEAR}"]`);
    await firstNameField.fill(TEST_DATA.FIRST_NAME);
    await lastNameField.fill(TEST_DATA.LAST_NAME);
    await cardNumberField.fill(TEST_DATA.CARD_NUMBER);
    await cvvField.fill(TEST_DATA.CVV);
    await monthField.fill(TEST_DATA.EXPIRY_MONTH);
    await yearField.fill(year);
}

test.describe('Token Generation Negative Cases', () => {
  test('Express checkout - Double click pay button should return 401 error on second click', async ({ page }) => {
    await page.goto(URLS.BASE);
    await waitForAuthParams(page);
    
    const expressButton = page.getByTestId(SELECTORS.EXPRESS_BUTTON);
    await expect(expressButton).toBeEnabled();
    await expressButton.click();
    await fillFormExpressCheckout(page, getValidYearString());
    const iframe = page.frameLocator(SELECTORS.EXPRESS_IFRAME);
    const payButton = iframe.getByTestId(SELECTORS.EXPRESS_SUBMIT_BUTTON);
    await expect(payButton).toBeEnabled();

    const responseData = {
      firstClickResponse: null as any,
      firstClickStatus: null as number | null,
      secondClickResponse: null as any,
      secondClickStatus: null as number | null,
      clickCount: 0
    };

    captureApiResponse(page, responseData);
    await payButton.click();
    const tokenMessage = page.locator(SELECTORS.TOKEN_CONTAINER_MESSAGE);
    await tokenMessage.waitFor({ state: 'visible' });
    await expect(tokenMessage).toBeVisible();
    const messageText = await tokenMessage.textContent();
    expect(messageText).toMatch(/Token/);
    expect(messageText).not.toMatch(ERROR_PATTERNS.ERROR_TEXT);
    console.log('First click message:', messageText);
    await expect(payButton).toBeEnabled();
    await payButton.click();
    console.log('Second pay button click');
    await page.waitForTimeout(TEST_DATA.TIMEOUT_SHORT);
    expect(responseData.secondClickStatus).toBeDefined();
    expect(responseData.secondClickStatus).toBe(TEST_DATA.STATUS_CODE_UNAUTHORIZED);
    expect(responseData.secondClickResponse).toBeDefined();
    expect(responseData.secondClickResponse).not.toBeNull();
    if (responseData.secondClickResponse) {
      expect(responseData.secondClickResponse).toHaveProperty('error');
      expect(responseData.secondClickResponse.error).toBe(ERROR_MESSAGES.ERROR_MESSAGE_UNAUTHORIZED);
    }
  });
  test('Express checkout - Embedded mode - Double click pay button should return 401 error on second click', async ({ page }) => {
    await page.goto(URLS.BASE);
    await waitForAuthParams(page);
    
    const expressButton = page.getByTestId(SELECTORS.EXPRESS_BUTTON);
    const openEmbeddedModeCheckbox = page.getByTestId(SELECTORS.OPEN_IN_EMBEDDED_MODE);
    await expect(openEmbeddedModeCheckbox).toBeVisible();
    await openEmbeddedModeCheckbox.check();
    await expect(openEmbeddedModeCheckbox).toBeChecked();
    await expect(expressButton).toBeVisible();
    await expect(expressButton).toBeEnabled();
    await expressButton.click();
    await fillFormExpressCheckout(page, getValidYearString());
    const iframe = page.frameLocator(SELECTORS.EXPRESS_IFRAME);
    const payButton = iframe.getByTestId(SELECTORS.EXPRESS_SUBMIT_BUTTON);
    await expect(payButton).toBeEnabled();

    const responseData = {
      firstClickResponse: null as any,
      firstClickStatus: null as number | null,
      secondClickResponse: null as any,
      secondClickStatus: null as number | null,
      clickCount: 0
    };

    captureApiResponse(page, responseData);
    await payButton.click();
    const tokenMessage = page.locator(SELECTORS.TOKEN_CONTAINER_MESSAGE);
    await tokenMessage.waitFor({ state: 'visible' });
    await expect(tokenMessage).toBeVisible();
    const messageText = await tokenMessage.textContent();
    expect(messageText).toMatch(/Token/);
    expect(messageText).not.toMatch(ERROR_PATTERNS.ERROR_TEXT);
    console.log('First click message:', messageText);
    await expect(payButton).toBeEnabled();
    await payButton.click();
    console.log('Second pay button click');
    await page.waitForTimeout(TEST_DATA.TIMEOUT_SHORT);
    expect(responseData.secondClickStatus).toBeDefined();
    expect(responseData.secondClickStatus).toBe(TEST_DATA.STATUS_CODE_UNAUTHORIZED);
    expect(responseData.secondClickResponse).toBeDefined();
    expect(responseData.secondClickResponse).not.toBeNull();
    if (responseData.secondClickResponse) {
      expect(responseData.secondClickResponse).toHaveProperty('error');
      expect(responseData.secondClickResponse.error).toBe(ERROR_MESSAGES.ERROR_MESSAGE_UNAUTHORIZED);
    }
  });

  test('Hosted Fields - Double click pay button should return 401 error on second click', async ({ page }) => {
    await page.goto(URLS.BASE);
    await waitForAuthParams(page);
    const hostedFieldsButton = page.getByTestId(SELECTORS.HOSTED_FIELDS_BUTTON);
    await expect(hostedFieldsButton).toBeEnabled();
    await hostedFieldsButton.click();
    await expect(page.locator(`h2:has-text("${HEADINGS.HOSTED_FIELDS_TITLE}")`)).toBeVisible();
    await fillFormHostedFields(page, getValidYearString());
    const submitButton = page.getByRole("button", { name: SELECTORS.HOSTED_SUBMIT_BUTTON });
    await expect(submitButton).toBeVisible();
    const responseData = {
      firstClickResponse: null as any,
      firstClickStatus: null as number | null,
      secondClickResponse: null as any,
      secondClickStatus: null as number | null,
      clickCount: 0
    };
    captureApiResponse(page, responseData);
    await submitButton.click();
    const tokenMessage = page.locator(SELECTORS.TOKEN_CONTAINER_MESSAGE);
    await tokenMessage.waitFor({ state: 'visible' });
    await expect(tokenMessage).toBeVisible();
    const messageText = await tokenMessage.textContent();
    expect(messageText).toMatch(/Token/);
    expect(messageText).not.toMatch(ERROR_PATTERNS.ERROR_TEXT);
    console.log('First click message:', messageText);
    await expect(submitButton).toBeEnabled();
    await submitButton.click();
    console.log('Second pay button click');
    await page.waitForTimeout(TEST_DATA.TIMEOUT_SHORT);
    expect(responseData.secondClickStatus).toBeDefined();
    expect(responseData.secondClickStatus).toBe(TEST_DATA.STATUS_CODE_UNAUTHORIZED);
    expect(responseData.secondClickResponse).toBeDefined();
    expect(responseData.secondClickResponse).not.toBeNull();
    if (responseData.secondClickResponse) {
      expect(responseData.secondClickResponse).toHaveProperty('error');
      expect(responseData.secondClickResponse.error).toBe(ERROR_MESSAGES.ERROR_MESSAGE_UNAUTHORIZED);
    }
  });
  
  test('Express checkout: Invalid year (20+ years) should return 500 error with 422 status', async ({ page }) => {
    await page.goto(URLS.BASE);
    await waitForAuthParams(page);
    const expressButton = page.getByTestId(SELECTORS.EXPRESS_BUTTON);
    await expect(expressButton).toBeEnabled();
    await expressButton.click();
    const iframe = page.frameLocator(SELECTORS.EXPRESS_IFRAME);
    await expect(page.locator(SELECTORS.EXPRESS_IFRAME)).toBeVisible();
    const payWithCardTitle = iframe.locator(`h1:has-text("${HEADINGS.EXPRESS_TITLE}")`);
    await expect(payWithCardTitle).toBeVisible();
    await fillFormExpressCheckout(page, getInvalidYearString());
    const payButton = iframe.getByTestId(SELECTORS.EXPRESS_SUBMIT_BUTTON);
    await expect(payButton).toBeEnabled();
    const responseData = {
      firstClickResponse: null as any,
      firstClickStatus: null as number | null,
      secondClickResponse: null as any,
      secondClickStatus: null as number | null,
      clickCount: 0
    };
    captureApiResponse(page, responseData);
    await payButton.click();
    await page.waitForTimeout(TEST_DATA.TIMEOUT_SHORT);
    expect(responseData.firstClickStatus).toBeDefined();
    expect(responseData.firstClickStatus).toBe(TEST_DATA.STATUS_CODE_INVALID_YEAR);
    expect(responseData.firstClickResponse).toBeDefined();
    expect(responseData.firstClickResponse).not.toBeNull();
    
    if (responseData.firstClickResponse) {
      expect(responseData.firstClickResponse).toHaveProperty('error');
      expect(responseData.firstClickResponse.error).toBe(ERROR_MESSAGES.ERROR_MESSAGE_INVALID_YEAR);
    }
  });

  test('Express checkout: Embedded mode - Invalid year (20+ years) should return 500 error with 422 status', async ({ page }) => {
    await page.goto(URLS.BASE);
    await waitForAuthParams(page);
    const expressButton = page.getByTestId(SELECTORS.EXPRESS_BUTTON);
    const openEmbeddedModeCheckbox = page.getByTestId(SELECTORS.OPEN_IN_EMBEDDED_MODE);
    await expect(openEmbeddedModeCheckbox).toBeVisible();
    await openEmbeddedModeCheckbox.check();
    await expect(openEmbeddedModeCheckbox).toBeChecked();
    await expect(expressButton).toBeEnabled();
    await expressButton.click();
    const iframe = page.frameLocator(SELECTORS.EXPRESS_IFRAME);
    await expect(page.locator(SELECTORS.EXPRESS_IFRAME)).toBeVisible();
    const payWithCardTitle = iframe.locator(`h1:has-text("${HEADINGS.EXPRESS_TITLE}")`);
    await expect(payWithCardTitle).toBeVisible();
    await fillFormExpressCheckout(page, getInvalidYearString());
    const payButton = iframe.getByTestId(SELECTORS.EXPRESS_SUBMIT_BUTTON);
    await expect(payButton).toBeEnabled();
    const responseData = {
      firstClickResponse: null as any,
      firstClickStatus: null as number | null,
      secondClickResponse: null as any,
      secondClickStatus: null as number | null,
      clickCount: 0
    };
    captureApiResponse(page, responseData);
    await payButton.click();
    await page.waitForTimeout(TEST_DATA.TIMEOUT_SHORT);
    expect(responseData.firstClickStatus).toBeDefined();
    expect(responseData.firstClickStatus).toBe(TEST_DATA.STATUS_CODE_INVALID_YEAR);
    expect(responseData.firstClickResponse).toBeDefined();
    expect(responseData.firstClickResponse).not.toBeNull();
    if (responseData.firstClickResponse) {
      expect(responseData.firstClickResponse).toHaveProperty('error');
      expect(responseData.firstClickResponse.error).toBe(ERROR_MESSAGES.ERROR_MESSAGE_INVALID_YEAR);
    }
  });

  test('Hosted Fields: Invalid year (20+ years) should return 500 error with 422 status', async ({ page }) => {
    await page.goto(URLS.BASE);
    await waitForAuthParams(page);
    const hostedFieldsButton = page.getByTestId(SELECTORS.HOSTED_FIELDS_BUTTON);
    await expect(hostedFieldsButton).toBeEnabled();
    await hostedFieldsButton.click();
    await expect(page.locator(`h2:has-text("${HEADINGS.HOSTED_FIELDS_TITLE}")`)).toBeVisible();
    await fillFormHostedFields(page, getInvalidYearString());
    const submitButton = page.getByRole("button", { name: SELECTORS.HOSTED_SUBMIT_BUTTON });
    await expect(submitButton).toBeVisible();
    const responseData = {
      firstClickResponse: null as any,
      firstClickStatus: null as number | null,
      secondClickResponse: null as any,
      secondClickStatus: null as number | null,
      clickCount: 0
    };
    captureApiResponse(page, responseData);
    await page.waitForTimeout(TEST_DATA.TIMEOUT_SHORT);
    await submitButton.click();
    await page.waitForTimeout(TEST_DATA.TIMEOUT_SHORT);
    expect(responseData.firstClickStatus).toBeDefined();
    expect(responseData.firstClickStatus).toBe(TEST_DATA.STATUS_CODE_INVALID_YEAR);
    expect(responseData.firstClickResponse).toBeDefined();
    expect(responseData.firstClickResponse).not.toBeNull();
    if (responseData.firstClickResponse) {
      expect(responseData.firstClickResponse).toHaveProperty('error');
      expect(responseData.firstClickResponse.error).toBe(ERROR_MESSAGES.ERROR_MESSAGE_INVALID_YEAR);
    }
  });
});