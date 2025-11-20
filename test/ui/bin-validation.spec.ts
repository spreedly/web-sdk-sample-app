import { test, expect } from './fixtures';import {
    SELECTORS,
    waitForAuthParams,
    URLS,
    HEADINGS,
    PLACEHOLDERS,
    LABELS,
    TEST_DATA,
  } from "./test-constants";

  import BIN_TEST_CASES from './bin-test-cases.json';

test.describe('BIN validation',()=>{
    test('should validate card number with valid BIN in express checkout', async ({ page }) => {
        test.setTimeout(300000);
        await page.goto(URLS.BASE);
        await waitForAuthParams(page);
        const expressButton = page.getByTestId(SELECTORS.EXPRESS_BUTTON);
        await expect(expressButton).toBeEnabled();
        await expressButton.click();
       const iframe = page.frameLocator(SELECTORS.EXPRESS_IFRAME);
       await expect(page.locator(SELECTORS.EXPRESS_IFRAME)).toBeVisible();
       const payWithCardTitle = iframe.locator(`h1:has-text("${HEADINGS.EXPRESS_TITLE}")`);
       await expect(payWithCardTitle).toBeVisible();
       const cardNumberField = iframe.getByPlaceholder(PLACEHOLDERS.EXPRESS_CARD_NUMBER);
       const failures: string[] = [];
       for (const [expectedCardType, bins] of Object.entries(BIN_TEST_CASES)) {
        const binArray = Array.isArray(bins) ? bins : [bins]; 
        for (const bin of binArray) {
            try{
            await cardNumberField.fill(bin);
            const binCardLabel = iframe.locator(SELECTORS.BIN_CARD_LABEL);
            await binCardLabel.waitFor({ state: 'visible', timeout: 2000 });
            const binCardLabelText = await binCardLabel.textContent();
            console.log(`BIN: ${bin}, Expected: ${expectedCardType}, Got: ${binCardLabelText}`);
            expect(binCardLabelText).toContain(expectedCardType.toUpperCase());
            await cardNumberField.clear();
            await page.waitForTimeout(500);
            }
            catch(error){
                const errorMessage = `BIN ${bin} - Expected: ${expectedCardType}, Error: ${error instanceof Error ? error.message : String(error)}`;
                failures.push(errorMessage);
                console.error(`ERROR: ${errorMessage}`);
            }
        } 
    }
    if (failures.length > 0) {
        const failureSummary = `\n\n${failures.length} failure(s) found:\n${failures.map((f, i) => `${i + 1}. ${f}`).join('\n')}`;
        console.error(failureSummary);
        throw new Error(`BIN validation failed for ${failures.length},${failureSummary}`);
    } else {
        console.log('All BIN validations passed!');
    }
})

})