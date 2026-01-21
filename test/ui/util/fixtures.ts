import { test as base, expect } from '@playwright/test';
import { waitForAuthParams } from '../test-constants';

export const test = base;

test.afterEach(async ({ page, context }) => {
  await context.clearCookies();
  await context.clearPermissions();
});

export { expect };