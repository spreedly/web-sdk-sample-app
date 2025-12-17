import test, { expect } from "@playwright/test";
import { Page } from "@playwright/test";
import {
    URLS,
    SELECTORS,
    PLACEHOLDERS,
    LABELS,
    TEST_DATA,
    HEADINGS,
    getValidYearString,
    waitForAuthParams,
    getMaskedCardNumber
  } from "./test-constants";

  async function fillExpressCheckoutForm(page: Page) {
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
        const payButton = iframe.getByTestId(SELECTORS.EXPRESS_SUBMIT_BUTTON);
        const savePaymentMethodCheckbox = iframe.locator(SELECTORS.SAVE_PAYMENT_METHOD_OPTION);
        await expect(firstNameField).toBeVisible();
        await expect(lastNameField).toBeVisible();
        await expect(cardNumberField).toBeVisible();
        await expect(cvvField).toBeVisible();
        await expect(monthField).toBeVisible();
        await expect(yearField).toBeVisible();
        await expect(payButton).toBeVisible();
        await firstNameField.fill(TEST_DATA.FIRST_NAME);
        await lastNameField.fill(TEST_DATA.LAST_NAME);
        await cardNumberField.fill(TEST_DATA.CARD_NUMBER);
        await cvvField.fill(TEST_DATA.CVV);
        await monthField.fill(TEST_DATA.EXPIRED_MONTH);
        await yearField.fill(getValidYearString());
        await expect(firstNameField).toHaveValue(TEST_DATA.FIRST_NAME);
        await expect(lastNameField).toHaveValue(TEST_DATA.LAST_NAME);
        await expect(cardNumberField).toHaveValue(getMaskedCardNumber(TEST_DATA.CARD_NUMBER));
        await expect(cvvField).toHaveValue(TEST_DATA.CVV);
        await expect(monthField).toHaveValue(TEST_DATA.EXPIRED_MONTH);
        await expect(yearField).toHaveValue(getValidYearString());
        await expect(savePaymentMethodCheckbox).toBeVisible();
        await savePaymentMethodCheckbox.check();
        await expect(savePaymentMethodCheckbox).toBeChecked();
        await expect(payButton).toBeEnabled();
        return payButton;
  }

test.describe('Recaching Option', () => {
    test('Recaching in express checkout', async({page}) => {
        await page.goto(URLS.BASE);
        await waitForAuthParams(page);
        const expressButton = page.getByTestId(SELECTORS.EXPRESS_BUTTON);
        await expect(expressButton).toBeEnabled();
        await expressButton.click();
        const payButton = await fillExpressCheckoutForm(page);
        let responseStatus: number | null = null;
        let apiResponse: any = null;
        page.on('response', async (response) => {
            const url = response.url();
            if (url.includes('/retain')){
              responseStatus = response.status();
              try {
                apiResponse = await response.json();
                console.log('Retain API Request URL:', url);
                console.log('Retain API Response Status:', responseStatus);
              } catch (error) {
                console.log('⚠️ Response is not JSON or empty');
              }
            }
          });
        await payButton.click();
        const tokenMessage = page.locator(SELECTORS.TOKEN_CONTAINER_MESSAGE);
        await tokenMessage.waitFor({ state: 'visible', timeout: 5000 });
        await page.waitForTimeout(1000);
        const messageText = await tokenMessage.textContent();
        console.log('Message Text:', messageText);
        await expect(messageText).toMatch(/Token/);
        await expect(messageText).toMatch(/Retained/);
        await expect(apiResponse.transaction.payment_method.storage_state).toBe('retained');
        expect([200, 204]).toContain(responseStatus);
    })
    test('Use saved payment method in express checkout', async({page}) => {
        await page.goto(URLS.BASE);
        await waitForAuthParams(page);
        const iframe = page.frameLocator(SELECTORS.EXPRESS_IFRAME);
        const expressButton = page.getByTestId(SELECTORS.EXPRESS_BUTTON);
        await expect(expressButton).toBeEnabled();
        await expressButton.click();
        const payButton = await fillExpressCheckoutForm(page);
        const closeButton = iframe.locator(SELECTORS.CLOSE_PAYMENT_FORM);
        await payButton.click();
        const tokenMessage = page.locator(SELECTORS.TOKEN_CONTAINER_MESSAGE);
        await tokenMessage.waitFor({ state: 'visible', timeout: 30000 });
        await page.waitForTimeout(1000);
        const messageText = await tokenMessage.textContent();
        console.log('Message Text:', messageText);
        await expect(messageText).toMatch(/Token/);
        await expect(messageText).toMatch(/Retained/);
        await closeButton.click();
        const saveCardContent = page.locator(SELECTORS.SAVE_CARD_CONTENT);
        const useCardButton = page.locator(SELECTORS.USE_CARD_BUTTON);
        await expect(saveCardContent).toBeVisible();
        await saveCardContent.click();
        await expect(page.locator(SELECTORS.SAVED_CARD_CHECKMARK)).toBeVisible();
        await expect(useCardButton).toBeEnabled();
        await useCardButton.click();
        const newIframe = page.frameLocator(SELECTORS.RECACHE_IFRAME);
        const formTitle = newIframe.locator(SELECTORS.RECACHE_TILE);
        await expect(formTitle).toHaveText(HEADINGS.EXPRESS_TITLE);
        const cvvField = newIframe.locator(`input[placeholder="${PLACEHOLDERS.RECACHE_CVV}"]`);
        await expect(cvvField).toBeVisible();
        await cvvField.fill(TEST_DATA.CVV);
        await expect(cvvField).toHaveValue(TEST_DATA.CVV);
        let responseStatus: number | null = null;
        let apiResponse: any = null;
        page.on('response', async (response) => {
            const url = response.url();
            if (url.includes('recache.json')){
              responseStatus = response.status();
              console.log('Recache API Response Status:', responseStatus);
              try {
                apiResponse = await response.json();
                console.log('Retain API Request URL:', url);
                console.log('Retain API Response Status:', responseStatus);
              } catch (error) {
                console.log('Response is not JSON or empty');
              }
            }
          });
        const retainpayButton = newIframe.getByTestId(SELECTORS.EXPRESS_SUBMIT_BUTTON);
        await retainpayButton.click();
        await expect(tokenMessage).not.toContainText('Retained', { timeout: 10000 });
        const newTokenMessage = page.locator(SELECTORS.TOKEN_CONTAINER_MESSAGE);
        await newTokenMessage.waitFor({ state: 'visible', timeout: 5000 });
        expect([200, 204]).toContain(responseStatus);
        await expect(page.locator(SELECTORS.TOKEN_CONTAINER_MESSAGE)).toBeVisible();
        const newMessageText = await newTokenMessage.textContent();
        console.log('New Message Text:', newMessageText);
        await expect(newMessageText).toMatch(/Token/);
        await expect(newMessageText).toMatch(/CVV Recached/);
    })

})

