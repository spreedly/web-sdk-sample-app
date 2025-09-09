import { test as base, expect } from '@playwright/test';
import { URLS, waitForAuthParams } from './test-constants';

export const test = base;

test.beforeEach(async ({ page }) => {
  await page.goto(URLS.BASE);
  await waitForAuthParams(page);
});

export { expect };



