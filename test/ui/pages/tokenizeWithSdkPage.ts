import { Page } from "@playwright/test";
import { expect } from "../util/fixtures";
import { SELECTORS } from "../util/test-constants";

export const tokenizeWithSdkPage = {
    clickOnHostedCatalogueFieldsDropdown: async (page: Page) => {
        const hostedCatalogueFieldsDropdown = page.getByText(SELECTORS.HOSTED_CATALOGUE_FIELDS_DROPDOWN);
        await expect(hostedCatalogueFieldsDropdown).toBeVisible();
        await hostedCatalogueFieldsDropdown.click();
    },

    selectFieldsByName: async (page: Page, fieldName: string) => {
        const field = await tokenizeWithSdkPage.getFieldCheckboxByName(page, fieldName);
        await expect(field).toBeVisible();
        await field.check();
        await expect(field).toBeChecked();
    },  

    getFieldCheckboxByName: async (page: Page, fieldName: string) => {
        const field = page.locator(`[data-hosted-field="${fieldName}"]`);
        await expect(field).toBeVisible();
        return field;
    },

    clickOnCustomFieldValidatorDropdown: async (page: Page) => {
        const customFieldValidatorDropdown = page.getByText(SELECTORS.CUSTOM_FIELD_VALIDATOR_DROPDOWN);
        await expect(customFieldValidatorDropdown).toBeVisible();
        await customFieldValidatorDropdown.click();
    },

    selectCustomFieldValidatorByName: async (page: Page, fieldName: string) => {
        const field = await tokenizeWithSdkPage.getCustomFieldValidatorCheckboxByName(page, fieldName);
        await expect(field).toBeVisible();
        await field.check();
        await expect(field).toBeChecked();
    },

    getCustomFieldValidatorCheckboxByName: async (page: Page, fieldName: string) => {
        const field = page.locator(`#${fieldName}`);
        await expect(field).toBeVisible();
        return field;
    },

    getHostedFieldErrorByFieldName: async (page: Page, fieldName: string) => {
        const error = page.locator(`#${fieldName}`);
        return error;
    },

    clickOnHostedCatalogueFieldsDropdownExpressCheckout: async (page: Page) => {
        const hostedCatalogueFieldsDropdownExpressCheckout = page.getByText(SELECTORS.HOSTED_CATALOGUE_FIELDS_DROPDOWN_EXPRESS_CHECKOUT);
        await expect(hostedCatalogueFieldsDropdownExpressCheckout).toBeVisible();
        await hostedCatalogueFieldsDropdownExpressCheckout.click();
    },

    selectFieldsByNameExpressCheckout: async (page: Page, fieldName: string) => {
        const field = await tokenizeWithSdkPage.getFieldCheckboxByNameExpressCheckout(page, fieldName);
        await expect(field).toBeVisible();
        await field.check();
        await expect(field).toBeChecked();
    },

    getFieldCheckboxByNameExpressCheckout: async (page: Page, fieldName: string) => {
        const field = page.locator(`[data-ec-field="${fieldName}"]`);
        await expect(field).toBeVisible();
        return field;
    },

}