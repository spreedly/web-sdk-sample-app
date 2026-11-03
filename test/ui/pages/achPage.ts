import { expect } from "../util/fixtures";
import { Page } from "@playwright/test";
import { CSS_PROPERTIES, SELECTORS } from "../util/test-constants";

const routingField = (page: Page) =>
  page.frameLocator(SELECTORS.ACH_ROUTING_IFRAME).locator(SELECTORS.ACH_ROUTING_HOSTED_INPUT);

const accountField = (page: Page) =>
  page.frameLocator(SELECTORS.ACH_ACCOUNT_IFRAME).locator(SELECTORS.ACH_ACCOUNT_HOSTED_INPUT);

const expressCheckoutForm = (page: Page) => page.frameLocator(SELECTORS.ACH_FORM_IFRAME);

const placeholderColor = async (page: Page, field: "routing" | "account") => {
  const input = field === "routing" ? routingField(page) : accountField(page);
  return input.evaluate(el => getComputedStyle(el, "::placeholder").color);
};

export const achPage = {
  getErrorMessage: async (page: Page) => {
    return page.locator(SELECTORS.ACH_ERROR_MESSAGE);
  },

  waitForHostedFields: async (page: Page) => {
    await expect(routingField(page)).toBeVisible({ timeout: 20000 });
    await expect(accountField(page)).toBeVisible({ timeout: 20000 });
  },

  setRoutingPlaceholder: async (page: Page, placeholder: string) => {
    const input = page.locator(SELECTORS.ACH_ROUTING_PLACEHOLDER_INPUT);
    await input.fill(placeholder);
    await input.blur();
    await expect(routingField(page)).toHaveAttribute("placeholder", placeholder);
  },

  setAccountPlaceholder: async (page: Page, placeholder: string) => {
    const input = page.locator(SELECTORS.ACH_ACCOUNT_PLACEHOLDER_INPUT);
    await input.fill(placeholder);
    await input.blur();
    await expect(accountField(page)).toHaveAttribute("placeholder", placeholder);
  },

  enableCustomFieldStyles: async (page: Page) => {
    const checkbox = page.locator(SELECTORS.ACH_CUSTOM_FIELD_STYLES);
    await checkbox.check();
    await expect(checkbox).toBeChecked();
    await expect.poll(() => placeholderColor(page, "routing")).toBe(CSS_PROPERTIES.ACH_PLACEHOLDER_COLOR_CUSTOM);
    await expect.poll(() => placeholderColor(page, "account")).toBe(CSS_PROPERTIES.ACH_PLACEHOLDER_COLOR_CUSTOM);
  },

  getRoutingPlaceholderColor: (page: Page) => placeholderColor(page, "routing"),

  getAccountPlaceholderColor: (page: Page) => placeholderColor(page, "account"),

  expectAccountNumberMasked: async (page: Page) => {
    await expect(page.locator(SELECTORS.ACH_MASK_ACCOUNT_CHECKBOX)).toBeChecked();
    await expect(accountField(page)).toHaveAttribute("type", "password");
  },

  waitForExpressCheckoutForm: async (page: Page) => {
    await expect(expressCheckoutForm(page).getByTestId("full_name")).toBeVisible({ timeout: 20000 });
  },

  clickExpressCheckoutSubmit: async (page: Page) => {
    const submit = expressCheckoutForm(page).locator(SELECTORS.ACH_FORM_SUBMIT);
    await submit.scrollIntoViewIfNeeded();
    await expect(submit).toBeEnabled();
    await submit.click();
  },
};
