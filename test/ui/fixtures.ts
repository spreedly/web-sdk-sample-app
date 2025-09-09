import { test as base, expect } from '@playwright/test';
import { waitForAuthParams } from './test-constants';

export const test = base;

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await waitForAuthParams(page);
});

export { expect };



