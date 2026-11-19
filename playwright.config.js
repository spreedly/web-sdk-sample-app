require('dotenv').config();

// This is a sample config for what users might be running locally
const config = {
  testDir: './test',
  testMatch: '**/*.spec.ts',
  retries: 1, // retry once on failure (2 total attempts)
  use: {
    baseURL: process.env.PUBLIC_APP_ORIGIN,
    trace: 'on-first-retry',
  },

  timeout: 90 * 1000,
  expect: {
    timeout: 5000,
  },
  workers: 2, // more workers send enough tokenizations at once for Spreedly to return 429
  reporter: [
    ['line'],
    ['junit', { outputFile: 'playwright-report/junit.xml' }],
  ],
  projects: [
    {
      name: 'Checkout Web SDK',
      use: {
        browserName: 'chromium',
        channel: 'chrome',
      },
    },
  ],
};

module.exports = config;
