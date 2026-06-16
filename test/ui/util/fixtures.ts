import { test as base, expect } from '@playwright/test';

export const test = base;

test.afterEach(async ({ page, context }) => {
  await context.clearCookies();
  await context.clearPermissions();
});

export { expect };
