import { expect } from "../util/fixtures";
import { Page } from "@playwright/test";
import { SELECTORS } from "../util/test-constants";

export const achPage = {
    getErrorMessage: async (page: Page) => {
        return page.locator(SELECTORS.ACH_ERROR_MESSAGE);
    },
};
