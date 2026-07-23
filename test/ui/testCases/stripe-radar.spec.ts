import { test, expect } from "../util/fixtures";
import { landingPage } from "../pages/landingPage";
import { getValidYearString, TEST_DATA, waitForAuthParams } from "../util/test-constants";
import { helperFunctions } from "../util/utils";
import { MONOREPO_URLS } from "../util/urls";
import { stripeRadarPage } from "../pages/stripeRadarPage";

test.describe('Stripe Radar', () => {
    test('should process Stripe Radar payment', async ({ page }) => {
        await page.goto(MONOREPO_URLS.BASE);
        await landingPage.clickOnStripeRadarButton(page);
        await waitForAuthParams(page);
        await helperFunctions.fillHostedFieldsForm(page, TEST_DATA.CARD_NUMBER, {
            firstName: TEST_DATA.FIRST_NAME,
            lastName: TEST_DATA.LAST_NAME,
            cvv: TEST_DATA.CVV,
            expiryMonth: TEST_DATA.EXPIRY_MONTH,
            expiryYear: getValidYearString(),
        });
        await page.waitForTimeout(10000);
        let apiRequestPayload: any = null;
        let responseStatus: number | null = null;
        let apiResponse: any = null;
        page.on('request', async (request) => {
            const url = request.url();
            if (url.includes('/v1/stripe-radar-purchase')) {
              try {
                apiRequestPayload = request.postDataJSON();
              } catch (error) {
                console.log('Request payload is not JSON or empty');
              }
            }
          });
          page.on('response', async (response) => {
            const url = response.url();
            if (url.includes('/v1/stripe-radar-purchase')) {
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

          await stripeRadarPage.clickOnPayButton(page);
          await stripeRadarPage.waitForResultCardToBeVisible(page);

          expect(apiResponse).toBeDefined();
          expect(apiResponse).not.toBeNull();
          expect(responseStatus).toBe(200);
          expect(apiRequestPayload).toBeDefined();
          expect(apiRequestPayload.payment_method_token).toBeTruthy();
          expect(apiRequestPayload.radar_session_id).toBeTruthy();

          expect(apiResponse.success).toBe(true);
          expect(apiResponse.radar_session_forwarded).toBe(true);
          expect(apiResponse.transaction).toBeDefined();
          expect(apiResponse.transaction.succeeded).toBe(true);
          expect(apiResponse.transaction.state).toBe('succeeded');

          const radarSessionId =
            apiResponse.transaction.gateway_specific_fields?.stripe_payment_intents
              ?.radar_session_id;
          expect(radarSessionId).toBeTruthy();
          expect(radarSessionId).toMatch(/^rse_/);
          expect(apiRequestPayload.radar_session_id).toBe(radarSessionId);

          const paymentMethod = apiResponse.transaction.payment_method;
          expect(paymentMethod).toBeDefined();
          expect(paymentMethod.payment_method_type).toBe('credit_card');
          expect(paymentMethod.card_type).toBe('visa');
          expect(paymentMethod.last_four_digits).toBe(TEST_DATA.CARD_NUMBER.slice(-4));
          expect(paymentMethod.first_six_digits).toBe(TEST_DATA.CARD_NUMBER.slice(0, 6));
          expect(paymentMethod.number).toBe(
            `XXXX-XXXX-XXXX-${TEST_DATA.CARD_NUMBER.slice(-4)}`,
          );
          expect(paymentMethod.first_name).toBe(TEST_DATA.FIRST_NAME);
          expect(paymentMethod.last_name).toBe(TEST_DATA.LAST_NAME);
    });
});
