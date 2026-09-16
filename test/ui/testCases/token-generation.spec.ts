import { test, expect } from '../util/fixtures';
import { landingPage } from '../pages/landingPage';
import { tokenizePage } from '../pages/tokenizePage';
import { helperFunctions } from '../util/utils';
import { MONOREPO_URLS } from '../util/urls';
import {
  TEST_DATA,
  HEADINGS,
  getValidYearString,
  getExpiredYearString,
  waitForAuthParams,
} from '../util/test-constants';

test.describe('Token Generation', () => {

  test('should generate token and validate API response structure in express checkout with allow expired date option and allow blank name option', async ({ page }) => {
    await page.goto(MONOREPO_URLS.BASE);
    await landingPage.clickOnExpressCheckoutButton(page);
    await landingPage.clickOnTokenizeButton(page);
    await waitForAuthParams(page);
    await tokenizePage.clickOnAllowExpiredDateCheckbox(page);
    await tokenizePage.clickOnAllowBlankNameCheckbox(page);
    await tokenizePage.clickOnOpenPaymentFormButtonExpressCheckout(page);
    
    await helperFunctions.fillExpressCheckoutForm(page, TEST_DATA.CARD_NUMBER, {
      cvv: TEST_DATA.CVV,
      expiryMonth: TEST_DATA.EXPIRY_MONTH,
      expiryYear: getExpiredYearString(),
    });
    
    await helperFunctions.verifyFormFieldsExpressCheckout(page, TEST_DATA.CARD_NUMBER, {
      cvv: TEST_DATA.CVV,
      firstName: "",
      lastName: "",
      expiryMonth: TEST_DATA.EXPIRY_MONTH,
      expiryYear: getExpiredYearString(),
    });
    
    let apiResponse: any = null;
    let responseStatus: number | null = null;
    let apiRequestPayload: any = null;
    
    page.on('request', async (request) => {
      const url = request.url();
      if (url.includes('/v1/payment_methods/restricted.json') || url.includes('/v1/payment_methods')) {
        try {
          apiRequestPayload = request.postDataJSON();
        } catch (error) {
          console.log('Request payload is not JSON or empty');
        }
      }
    });
    page.on('response', async (response) => {
      const url = response.url();
      if (url.includes('/v1/payment_methods/restricted.json') || url.includes('/v1/payment_methods')) {
        responseStatus = response.status();
        try {
          apiResponse = await response.json();
          console.log('API Request URL:', url);
          console.log('API Response Status:', responseStatus);
        } catch (error) {
          console.log('Response is not JSON or empty');
        }
      }
    });
    
    await helperFunctions.clickOnExpressCheckoutSubmitButton(page);
    const resultTitle = await tokenizePage.getResultCardTitle(page);
    await expect(resultTitle).toBe(HEADINGS.RESULT_TITLE_SUCCESS);
    if(apiRequestPayload) {
      await helperFunctions.verifyRequestPayloadData(apiRequestPayload, TEST_DATA.EMPTY_STRING, TEST_DATA.EMPTY_STRING, TEST_DATA.CARD_NUMBER, TEST_DATA.CVV, TEST_DATA.EXPIRY_MONTH, getExpiredYearString());
    } else {
      console.log('API Request Payload was not captured');
    }
    expect(responseStatus).toBeDefined();
    expect([200, 204]).toContain(responseStatus);
    expect(apiResponse).toBeDefined();
    expect(apiResponse).not.toBeNull();
    if (apiResponse) {
      await helperFunctions.verifyApiResponse(page, apiResponse,true,'succeeded','Succeeded','AddPaymentMethod',TEST_DATA.CARD_NUMBER.slice(-4), TEST_DATA.CARD_NUMBER.slice(0, 6), 'visa', TEST_DATA.EMPTY_STRING, TEST_DATA.EMPTY_STRING, parseInt(TEST_DATA.EXPIRY_MONTH), parseInt(getExpiredYearString()), 'credit_card', TEST_DATA.CARD_NUMBER.slice(0, 8), true, true, TEST_DATA.CARD_NUMBER);
    }
  });

  test('should generate token and validate API response structure in hosted fields with allow expired date option and allow blank name option', async ({ page }) => {
    await page.goto(MONOREPO_URLS.BASE);
    await landingPage.clickOnTokenizeButton(page);
    await waitForAuthParams(page);
    await tokenizePage.clickOnAllowExpiredDateCheckbox(page);
    await tokenizePage.clickOnAllowBlankNameCheckbox(page);
    await tokenizePage.clickOnOpenPaymentFormButtonHostedFields(page);
    
    await helperFunctions.fillHostedFieldsForm(page, TEST_DATA.CARD_NUMBER, {
      cvv: TEST_DATA.CVV,
      expiryMonth: TEST_DATA.EXPIRY_MONTH,
      expiryYear: getExpiredYearString(),
    });
    
    await helperFunctions.verifyFormFieldsHostedFields(page, TEST_DATA.CARD_NUMBER_FORMATTED, {
      cvv: TEST_DATA.CVV,
      firstName: "",
      lastName: "",
      expiryMonth: TEST_DATA.EXPIRY_MONTH,
      expiryYear: getExpiredYearString(),
    });
    
    let apiResponse: any = null;
    let responseStatus: number | null = null;
    let apiRequestPayload: any = null;
    
    page.on('request', async (request) => {
      const url = request.url();
      if (url.includes('/v1/payment_methods/restricted.json') || url.includes('/v1/payment_methods')) {
        try {
          apiRequestPayload = request.postDataJSON();
        } catch (error) {
          console.log('Request payload is not JSON or empty');
        }
      }
    });
    page.on('response', async (response) => {
      const url = response.url();
      if (url.includes('/v1/payment_methods/restricted.json') || url.includes('/v1/payment_methods')) {
        responseStatus = response.status();
        try {
          apiResponse = await response.json();
          console.log('API Request URL:', url);
          console.log('API Response Status:', responseStatus);
        } catch (error) {
          console.log('Response is not JSON or empty');
        }
      }
    });
    
    await helperFunctions.clickOnHostedFieldsSubmitButton(page);
    const resultTitle = await tokenizePage.getResultCardTitle(page);
    await expect(resultTitle).toBe(HEADINGS.RESULT_TITLE_SUCCESS);
    if(apiRequestPayload) {
      await helperFunctions.verifyRequestPayloadData(apiRequestPayload, TEST_DATA.EMPTY_STRING, TEST_DATA.EMPTY_STRING, TEST_DATA.CARD_NUMBER, TEST_DATA.CVV, TEST_DATA.EXPIRY_MONTH, getExpiredYearString());
    } else {
      console.log('API Request Payload was not captured');
    }
    expect(responseStatus).toBeDefined();
    expect([200, 204]).toContain(responseStatus);
    expect(apiResponse).toBeDefined();
    expect(apiResponse).not.toBeNull();
    if (apiResponse) {
      await helperFunctions.verifyApiResponse(page, apiResponse,true,'succeeded','Succeeded','AddPaymentMethod',TEST_DATA.CARD_NUMBER.slice(-4), TEST_DATA.CARD_NUMBER.slice(0, 6), 'visa', TEST_DATA.EMPTY_STRING, TEST_DATA.EMPTY_STRING, parseInt(TEST_DATA.EXPIRY_MONTH), parseInt(getExpiredYearString()), 'credit_card', TEST_DATA.CARD_NUMBER.slice(0, 8), true, true, TEST_DATA.CARD_NUMBER);
    }
    });

  test('should generate token and validate API response structure in express checkout', async ({ page }) => {
    await page.goto(MONOREPO_URLS.BASE);
    await landingPage.clickOnExpressCheckoutButton(page);
    await landingPage.clickOnTokenizeButton(page);
    await waitForAuthParams(page);
    await tokenizePage.clickOnOpenPaymentFormButtonExpressCheckout(page);
    await helperFunctions.fillExpressCheckoutForm(page, TEST_DATA.CARD_NUMBER, {
      firstName: TEST_DATA.FIRST_NAME,
      lastName: TEST_DATA.LAST_NAME,
      cvv: TEST_DATA.CVV,
      expiryMonth: TEST_DATA.EXPIRY_MONTH,
      expiryYear: getValidYearString(),
    });
    
    await helperFunctions.verifyFormFieldsExpressCheckout(page, TEST_DATA.CARD_NUMBER, {
      cvv: TEST_DATA.CVV,
      firstName: TEST_DATA.FIRST_NAME,
      lastName: TEST_DATA.LAST_NAME,
      expiryMonth: TEST_DATA.EXPIRY_MONTH,
      expiryYear: getValidYearString(),
    });
    
    let apiResponse: any = null;
    let responseStatus: number | null = null;
    let apiRequestPayload: any = null;
    
    page.on('request', async (request) => {
      const url = request.url();
      if (url.includes('/v1/payment_methods/restricted.json') || url.includes('/v1/payment_methods')) {
        try {
          apiRequestPayload = request.postDataJSON();
        } catch (error) {
          console.log('Request payload is not JSON or empty');
        }
      }
    });
    page.on('response', async (response) => {
      const url = response.url();
      if (url.includes('/v1/payment_methods/restricted.json') || url.includes('/v1/payment_methods')) {
        responseStatus = response.status();
        try {
          apiResponse = await response.json();
          console.log('API Request URL:', url);
          console.log('API Response Status:', responseStatus);
        } catch (error) {
          console.log('Response is not JSON or empty');
        }
      }
    });
    
    await helperFunctions.clickOnExpressCheckoutSubmitButton(page);
    const resultTitle = await tokenizePage.getResultCardTitle(page);
    await expect(resultTitle).toBe(HEADINGS.RESULT_TITLE_SUCCESS);
    if(apiRequestPayload) {
      await helperFunctions.verifyRequestPayloadData(apiRequestPayload, TEST_DATA.FIRST_NAME, TEST_DATA.LAST_NAME, TEST_DATA.CARD_NUMBER, TEST_DATA.CVV, TEST_DATA.EXPIRY_MONTH, getValidYearString());
    } else {
      console.log('API Request Payload was not captured');
    }
    expect(responseStatus).toBeDefined();
    expect([200, 204]).toContain(responseStatus);
    expect(apiResponse).toBeDefined();
    expect(apiResponse).not.toBeNull();
    if (apiResponse) {
      await helperFunctions.verifyApiResponse(page, apiResponse,true,'succeeded','Succeeded','AddPaymentMethod',TEST_DATA.CARD_NUMBER.slice(-4), TEST_DATA.CARD_NUMBER.slice(0, 6), 'visa', TEST_DATA.FIRST_NAME, TEST_DATA.LAST_NAME, parseInt(TEST_DATA.EXPIRY_MONTH), parseInt(getValidYearString()), 'credit_card', TEST_DATA.CARD_NUMBER.slice(0, 8), true, true, TEST_DATA.CARD_NUMBER);
    }
  });

  test('should generate token and validate API response structure in hosted fields', async ({ page }) => {
    await page.goto(MONOREPO_URLS.BASE);
    await landingPage.clickOnTokenizeButton(page);
    await waitForAuthParams(page);
    await tokenizePage.clickOnOpenPaymentFormButtonHostedFields(page);

    await helperFunctions.fillHostedFieldsForm(page, TEST_DATA.CARD_NUMBER, {
      firstName: TEST_DATA.FIRST_NAME,
      lastName: TEST_DATA.LAST_NAME,
      cvv: TEST_DATA.CVV,
      expiryMonth: TEST_DATA.EXPIRY_MONTH,
      expiryYear: getValidYearString(),
    });
    
    await helperFunctions.verifyFormFieldsHostedFields(page, TEST_DATA.CARD_NUMBER_FORMATTED, {
      cvv: TEST_DATA.CVV,
      firstName: TEST_DATA.FIRST_NAME,
      lastName: TEST_DATA.LAST_NAME,
      expiryMonth: TEST_DATA.EXPIRY_MONTH,
      expiryYear: getValidYearString(),
    });
    
    let apiResponse: any = null;
    let responseStatus: number | null = null;
    let apiRequestPayload: any = null;
    
    page.on('request', async (request) => {
      const url = request.url();
      if (url.includes('/v1/payment_methods/restricted.json') || url.includes('/v1/payment_methods')) {
        try {
          apiRequestPayload = request.postDataJSON();
        } catch (error) {
          console.log('Request payload is not JSON or empty');
        }
      }
    });
    page.on('response', async (response) => {
      const url = response.url();
      if (url.includes('/v1/payment_methods/restricted.json') || url.includes('/v1/payment_methods')) {
        responseStatus = response.status();
        try {
          apiResponse = await response.json();
          console.log('API Request URL:', url);
          console.log('API Response Status:', responseStatus);
        } catch (error) {
          console.log('Response is not JSON or empty');
        }
      }
    });
    
    await helperFunctions.clickOnHostedFieldsSubmitButton(page);
    const resultTitle = await tokenizePage.getResultCardTitle(page);
    await expect(resultTitle).toBe(HEADINGS.RESULT_TITLE_SUCCESS);
    if(apiRequestPayload) {
      await helperFunctions.verifyRequestPayloadData(apiRequestPayload, TEST_DATA.FIRST_NAME, TEST_DATA.LAST_NAME, TEST_DATA.CARD_NUMBER, TEST_DATA.CVV, TEST_DATA.EXPIRY_MONTH, getValidYearString());
    } else {
      console.log('API Request Payload was not captured');
    }
    expect(responseStatus).toBeDefined();
    expect([200, 204]).toContain(responseStatus);
    expect(apiResponse).toBeDefined();
    expect(apiResponse).not.toBeNull();
    if (apiResponse) {
      await helperFunctions.verifyApiResponse(page, apiResponse,true,'succeeded','Succeeded','AddPaymentMethod',TEST_DATA.CARD_NUMBER.slice(-4), TEST_DATA.CARD_NUMBER.slice(0, 6), 'visa', TEST_DATA.FIRST_NAME, TEST_DATA.LAST_NAME, parseInt(TEST_DATA.EXPIRY_MONTH), parseInt(getValidYearString()), 'credit_card', TEST_DATA.CARD_NUMBER.slice(0, 8), true, true, TEST_DATA.CARD_NUMBER);
    }
  });

  test('should generate token in express checkout dialog mode and validate API response', async ({ page }) => {
    await page.goto(MONOREPO_URLS.BASE);
    await landingPage.clickOnExpressCheckoutButton(page);
    await landingPage.clickOnTokenizeButton(page);
    await waitForAuthParams(page);
    await tokenizePage.clickOnDialogMode(page);
    await tokenizePage.clickOnOpenPaymentFormButtonExpressCheckout(page);
    await helperFunctions.fillExpressCheckoutForm(page, TEST_DATA.CARD_NUMBER, {
      firstName: TEST_DATA.FIRST_NAME,
      lastName: TEST_DATA.LAST_NAME,
      cvv: TEST_DATA.CVV,
      expiryMonth: TEST_DATA.EXPIRY_MONTH,
      expiryYear: getValidYearString(),
    });
    
    await helperFunctions.verifyFormFieldsExpressCheckout(page, TEST_DATA.CARD_NUMBER, {
      cvv: TEST_DATA.CVV,
      firstName: TEST_DATA.FIRST_NAME,
      lastName: TEST_DATA.LAST_NAME,
      expiryMonth: TEST_DATA.EXPIRY_MONTH,
      expiryYear: getValidYearString(),
    });
    
    let apiResponse: any = null;
    let responseStatus: number | null = null;
    let apiRequestPayload: any = null;
    
    page.on('request', async (request) => {
      const url = request.url();
      if (url.includes('/v1/payment_methods/restricted.json') || url.includes('/v1/payment_methods')) {
        try {
          apiRequestPayload = request.postDataJSON();
        } catch (error) {
          console.log('Request payload is not JSON or empty');
        }
      }
    });
    page.on('response', async (response) => {
      const url = response.url();
      if (url.includes('/v1/payment_methods/restricted.json') || url.includes('/v1/payment_methods')) {
        responseStatus = response.status();
        try {
          apiResponse = await response.json();
          console.log('API Request URL:', url);
          console.log('API Response Status:', responseStatus);
        } catch (error) {
          console.log('Response is not JSON or empty');
        }
      }
    });
    
    await helperFunctions.clickOnExpressCheckoutSubmitButton(page);
    const resultTitle = await tokenizePage.getResultCardTitle(page);
    await expect(resultTitle).toBe(HEADINGS.RESULT_TITLE_SUCCESS);
    if(apiRequestPayload) {
      await helperFunctions.verifyRequestPayloadData(apiRequestPayload, TEST_DATA.FIRST_NAME, TEST_DATA.LAST_NAME, TEST_DATA.CARD_NUMBER, TEST_DATA.CVV, TEST_DATA.EXPIRY_MONTH, getValidYearString());
    } else {
      console.log('API Request Payload was not captured');
    }
    expect(responseStatus).toBeDefined();
    expect([200, 204]).toContain(responseStatus);
    expect(apiResponse).toBeDefined();
    expect(apiResponse).not.toBeNull();
    if (apiResponse) {
      await helperFunctions.verifyApiResponse(page, apiResponse,true,'succeeded','Succeeded','AddPaymentMethod',TEST_DATA.CARD_NUMBER.slice(-4), TEST_DATA.CARD_NUMBER.slice(0, 6), 'visa', TEST_DATA.FIRST_NAME, TEST_DATA.LAST_NAME, parseInt(TEST_DATA.EXPIRY_MONTH), parseInt(getValidYearString()), 'credit_card', TEST_DATA.CARD_NUMBER.slice(0, 8), true, true, TEST_DATA.CARD_NUMBER);
    }  
  })

  test('should generate token in express checkout with allow blank date option and allow blank name option', async ({ page }) => {
    await page.goto(MONOREPO_URLS.BASE);
    await landingPage.clickOnExpressCheckoutButton(page);
    await landingPage.clickOnTokenizeButton(page);
    await waitForAuthParams(page);
    await tokenizePage.clickOnAllowBlankDateCheckbox(page);
    await tokenizePage.clickOnAllowBlankNameCheckbox(page);
    await tokenizePage.clickOnOpenPaymentFormButtonExpressCheckout(page);
    await helperFunctions.fillExpressCheckoutForm(page, TEST_DATA.CARD_NUMBER, {
      cvv: TEST_DATA.CVV,
    });
    await helperFunctions.verifyFormFieldsExpressCheckout(page, TEST_DATA.CARD_NUMBER, {
      cvv: TEST_DATA.CVV,
  })
  let apiResponse: any = null;
  let responseStatus: number | null = null;
  let apiRequestPayload: any = null;
  
  page.on('request', async (request) => {
    const url = request.url();
    if (url.includes('/v1/payment_methods/restricted.json') || url.includes('/v1/payment_methods')) {
      try {
        apiRequestPayload = request.postDataJSON();
      } catch (error) {
        console.log('Request payload is not JSON or empty');
      }
    }
  });
  page.on('response', async (response) => {
    const url = response.url();
    if (url.includes('/v1/payment_methods/restricted.json') || url.includes('/v1/payment_methods')) {
      responseStatus = response.status();
      try {
        apiResponse = await response.json();
        console.log('API Request URL:', url);
        console.log('API Response Status:', responseStatus);
      } catch (error) {
        console.log('Response is not JSON or empty');
      }
    }
  });
  
  await helperFunctions.clickOnExpressCheckoutSubmitButton(page);
  const resultTitle = await tokenizePage.getResultCardTitle(page);
  await expect(resultTitle).toBe(HEADINGS.RESULT_TITLE_SUCCESS);
  if(apiRequestPayload) {
    await helperFunctions.verifyRequestPayloadData(apiRequestPayload, TEST_DATA.EMPTY_STRING, TEST_DATA.EMPTY_STRING, TEST_DATA.CARD_NUMBER, TEST_DATA.CVV, TEST_DATA.EMPTY_STRING, TEST_DATA.EMPTY_STRING);
  } else {
    console.log('API Request Payload was not captured');
  }
  expect(responseStatus).toBeDefined();
  expect([200, 204]).toContain(responseStatus);
  expect(apiResponse).toBeDefined();
  expect(apiResponse).not.toBeNull();
  if (apiResponse) {
    await helperFunctions.verifyApiResponse(page, apiResponse,true,'succeeded','Succeeded','AddPaymentMethod',TEST_DATA.CARD_NUMBER.slice(-4), TEST_DATA.CARD_NUMBER.slice(0, 6), 'visa', TEST_DATA.EMPTY_STRING, TEST_DATA.EMPTY_STRING, 0, 0, 'credit_card', TEST_DATA.CARD_NUMBER.slice(0, 8), true, true, TEST_DATA.CARD_NUMBER);
  } 
  });

  test('should generate token in hosted fields with allow blank date option and allow blank name option', async ({ page }) => {
    await page.goto(MONOREPO_URLS.BASE);
    await landingPage.clickOnTokenizeButton(page);
    await waitForAuthParams(page);
    await tokenizePage.clickOnAllowBlankDateCheckbox(page);
    await tokenizePage.clickOnAllowBlankNameCheckbox(page);
    await tokenizePage.clickOnOpenPaymentFormButtonHostedFields(page);
    await helperFunctions.fillHostedFieldsForm(page, TEST_DATA.CARD_NUMBER, {
      cvv: TEST_DATA.CVV,
    });
    await helperFunctions.verifyFormFieldsHostedFields(page, TEST_DATA.CARD_NUMBER_FORMATTED, {
      cvv: TEST_DATA.CVV,
  })
  let apiResponse: any = null;
  let responseStatus: number | null = null;
  let apiRequestPayload: any = null;
  
  page.on('request', async (request) => {
    const url = request.url();
    if (url.includes('/v1/payment_methods/restricted.json') || url.includes('/v1/payment_methods')) {
      try {
        apiRequestPayload = request.postDataJSON();
      } catch (error) {
        console.log('Request payload is not JSON or empty');
      }
    }
  });
  page.on('response', async (response) => {
    const url = response.url();
    if (url.includes('/v1/payment_methods/restricted.json') || url.includes('/v1/payment_methods')) {
      responseStatus = response.status();
      try {
        apiResponse = await response.json();
        console.log('API Request URL:', url);
        console.log('API Response Status:', responseStatus);
      } catch (error) {
        console.log('Response is not JSON or empty');
      }
    }
  });
  
  await helperFunctions.clickOnHostedFieldsSubmitButton(page);
  const resultTitle = await tokenizePage.getResultCardTitle(page);
  await expect(resultTitle).toBe(HEADINGS.RESULT_TITLE_SUCCESS);
  if(apiRequestPayload) {
    await helperFunctions.verifyRequestPayloadData(apiRequestPayload, TEST_DATA.EMPTY_STRING, TEST_DATA.EMPTY_STRING, TEST_DATA.CARD_NUMBER, TEST_DATA.CVV, TEST_DATA.EMPTY_STRING, TEST_DATA.EMPTY_STRING);
  } else {
    console.log('API Request Payload was not captured');
  }
  expect(responseStatus).toBeDefined();
  expect([200, 204]).toContain(responseStatus);
  expect(apiResponse).toBeDefined();
  expect(apiResponse).not.toBeNull();
  if (apiResponse) {
    await helperFunctions.verifyApiResponse(page, apiResponse,true,'succeeded','Succeeded','AddPaymentMethod',TEST_DATA.CARD_NUMBER.slice(-4), TEST_DATA.CARD_NUMBER.slice(0, 6), 'visa', TEST_DATA.EMPTY_STRING, TEST_DATA.EMPTY_STRING, 0, 0, 'credit_card', TEST_DATA.CARD_NUMBER.slice(0, 8), true, true, TEST_DATA.CARD_NUMBER);
  } 
  })

  test('should generate token and validate API response structure in express checkout dialog mode with allow expired date option and allow blank name option', async ({ page }) => {
    await page.goto(MONOREPO_URLS.BASE);
    await landingPage.clickOnExpressCheckoutButton(page);
    await landingPage.clickOnTokenizeButton(page);
    await waitForAuthParams(page);
    await tokenizePage.clickOnDialogMode(page);
    await tokenizePage.clickOnAllowExpiredDateCheckbox(page);
    await tokenizePage.clickOnAllowBlankNameCheckbox(page);
    await tokenizePage.clickOnOpenPaymentFormButtonExpressCheckout(page);
    
    await helperFunctions.fillExpressCheckoutForm(page, TEST_DATA.CARD_NUMBER, {
      cvv: TEST_DATA.CVV,
      expiryMonth: TEST_DATA.EXPIRY_MONTH,
      expiryYear: getExpiredYearString(),
    });
    
    await helperFunctions.verifyFormFieldsExpressCheckout(page, TEST_DATA.CARD_NUMBER, {
      cvv: TEST_DATA.CVV,
      firstName: "",
      lastName: "",
      expiryMonth: TEST_DATA.EXPIRY_MONTH,
      expiryYear: getExpiredYearString(),
    });
    
    let apiResponse: any = null;
    let responseStatus: number | null = null;
    let apiRequestPayload: any = null;
    
    page.on('request', async (request) => {
      const url = request.url();
      if (url.includes('/v1/payment_methods/restricted.json') || url.includes('/v1/payment_methods')) {
        try {
          apiRequestPayload = request.postDataJSON();
        } catch (error) {
          console.log('Request payload is not JSON or empty');
        }
      }
    });
    page.on('response', async (response) => {
      const url = response.url();
      if (url.includes('/v1/payment_methods/restricted.json') || url.includes('/v1/payment_methods')) {
        responseStatus = response.status();
        try {
          apiResponse = await response.json();
          console.log('API Request URL:', url);
          console.log('API Response Status:', responseStatus);
        } catch (error) {
          console.log('Response is not JSON or empty');
        }
      }
    });
    
    await helperFunctions.clickOnExpressCheckoutSubmitButton(page);
    const resultTitle = await tokenizePage.getResultCardTitle(page);
    await expect(resultTitle).toBe(HEADINGS.RESULT_TITLE_SUCCESS);
    if(apiRequestPayload) {
      await helperFunctions.verifyRequestPayloadData(apiRequestPayload, TEST_DATA.EMPTY_STRING, TEST_DATA.EMPTY_STRING, TEST_DATA.CARD_NUMBER, TEST_DATA.CVV, TEST_DATA.EXPIRY_MONTH, getExpiredYearString());
    } else {
      console.log('API Request Payload was not captured');
    }
    expect(responseStatus).toBeDefined();
    expect([200, 204]).toContain(responseStatus);
    expect(apiResponse).toBeDefined();
    expect(apiResponse).not.toBeNull();
    if (apiResponse) {
      await helperFunctions.verifyApiResponse(page, apiResponse,true,'succeeded','Succeeded','AddPaymentMethod',TEST_DATA.CARD_NUMBER.slice(-4), TEST_DATA.CARD_NUMBER.slice(0, 6), 'visa', TEST_DATA.EMPTY_STRING, TEST_DATA.EMPTY_STRING, parseInt(TEST_DATA.EXPIRY_MONTH), parseInt(getExpiredYearString()), 'credit_card', TEST_DATA.CARD_NUMBER.slice(0, 8), true, true, TEST_DATA.CARD_NUMBER);
    }
  })

  test('should generate token and validate API response structure in express checkout dialog mode with allow blank date option and allow blank name option', async ({ page }) => {
    await page.goto(MONOREPO_URLS.BASE);
    await landingPage.clickOnExpressCheckoutButton(page);
    await landingPage.clickOnTokenizeButton(page);
    await waitForAuthParams(page);
    await tokenizePage.clickOnDialogMode(page);
    await tokenizePage.clickOnAllowBlankDateCheckbox(page);
    await tokenizePage.clickOnAllowBlankNameCheckbox(page);
    await tokenizePage.clickOnOpenPaymentFormButtonExpressCheckout(page);
    await helperFunctions.fillExpressCheckoutForm(page, TEST_DATA.CARD_NUMBER, {
      cvv: TEST_DATA.CVV,
    });
    await helperFunctions.verifyFormFieldsExpressCheckout(page, TEST_DATA.CARD_NUMBER, {
      cvv: TEST_DATA.CVV,
  })
  
  let apiResponse: any = null;
  let responseStatus: number | null = null;
  let apiRequestPayload: any = null;
  
  page.on('request', async (request) => {
    const url = request.url();
    if (url.includes('/v1/payment_methods/restricted.json') || url.includes('/v1/payment_methods')) {
      try {
        apiRequestPayload = request.postDataJSON();
      } catch (error) {
        console.log('Request payload is not JSON or empty');
      }
    }
  });
  page.on('response', async (response) => {
    const url = response.url();
    if (url.includes('/v1/payment_methods/restricted.json') || url.includes('/v1/payment_methods')) {
      responseStatus = response.status();
      try {
        apiResponse = await response.json();
        console.log('API Request URL:', url);
        console.log('API Response Status:', responseStatus);
      } catch (error) {
        console.log('Response is not JSON or empty');
      }
    }
  });
  
  await helperFunctions.clickOnExpressCheckoutSubmitButton(page);
  const resultTitle = await tokenizePage.getResultCardTitle(page);
  await expect(resultTitle).toBe(HEADINGS.RESULT_TITLE_SUCCESS);
  if(apiRequestPayload) {
    await helperFunctions.verifyRequestPayloadData(apiRequestPayload, TEST_DATA.EMPTY_STRING, TEST_DATA.EMPTY_STRING, TEST_DATA.CARD_NUMBER, TEST_DATA.CVV, TEST_DATA.EMPTY_STRING, TEST_DATA.EMPTY_STRING);
  } else {
    console.log('API Request Payload was not captured');
  }
  expect(responseStatus).toBeDefined();
  expect([200, 204]).toContain(responseStatus);
  expect(apiResponse).toBeDefined();
  expect(apiResponse).not.toBeNull();
  if (apiResponse) {
    await helperFunctions.verifyApiResponse(page, apiResponse,true,'succeeded','Succeeded','AddPaymentMethod',TEST_DATA.CARD_NUMBER.slice(-4), TEST_DATA.CARD_NUMBER.slice(0, 6), 'visa', TEST_DATA.EMPTY_STRING, TEST_DATA.EMPTY_STRING, 0, 0, 'credit_card', TEST_DATA.CARD_NUMBER.slice(0, 8), true, true, TEST_DATA.CARD_NUMBER);
  } 
  });
})


