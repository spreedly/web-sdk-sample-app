import { expect, Page } from '@playwright/test';
import { config } from 'dotenv';
import { LABELS } from '../util/test-constants';
config({ path: 'test/ui/credentials.env' });


const paypalUserId = String(process.env.PAYPAL_USER_ID);
const paypalUserPassword = String(process.env.PAYPAL_USER_PASSWORD);
const venmoUserId = String(process.env.VENMO_USER_ID);
const venmoUserPassword = String(process.env.VENMO_USER_PASSWORD);

export const ppcpPage = {
    clickOnPayPalButton: async (page: Page) => {
        await expect(page.getByRole('button').getByLabel(LABELS.PAYPAL_BUTTON)).toBeVisible();
        await page.getByRole('button').getByLabel(LABELS.PAYPAL_BUTTON).click();
    },
    clickOnVenmoButton: async (page: Page) => {
        await expect(page.getByRole('button').getByLabel(LABELS.VENMO_BUTTON)).toBeVisible();
        await page.getByRole('button').getByLabel(LABELS.VENMO_BUTTON).click();
    },
    clickOnPayLaterButton: async (page: Page) => {
        await expect(page.getByRole('button').getByLabel(LABELS.PAY_LATER_BUTTON)).toBeVisible();
        await page.getByRole('button').getByLabel(LABELS.PAY_LATER_BUTTON).click();
    },
    getCheckboxLocator: async (page: Page, checkboxName: string) => {
        return page.locator('label.cfg-opt', {hasText: checkboxName }).locator('input')
    },
    clickOnCheckbox: async (page: Page, checkboxName: string) => {
        const checkbox = await ppcpPage.getCheckboxLocator(page, checkboxName);
        await expect(checkbox).toBeVisible();
        await checkbox.click();
        await expect(checkbox).toBeChecked();
        
    },

    
}


export { paypalUserId, paypalUserPassword, venmoUserId, venmoUserPassword };



