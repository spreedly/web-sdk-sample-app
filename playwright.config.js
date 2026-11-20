require('dotenv').config();

const resolveHttpCredentials = () => {
  const username = process.env.E2E_BASIC_AUTH_USER;
  const password = process.env.E2E_BASIC_AUTH_PASSWORD;
  if (!username && !password) return undefined;
  if (!username || !password || !process.env.PUBLIC_APP_ORIGIN) {
    throw new Error(
      'E2E_BASIC_AUTH_USER, E2E_BASIC_AUTH_PASSWORD and PUBLIC_APP_ORIGIN must be set together'
    );
  }
  return { username, password, origin: new URL(process.env.PUBLIC_APP_ORIGIN).origin };
};
const httpCredentials = resolveHttpCredentials();

// This is a sample config for what users might be running locally
const config = {
  testDir: './test',
  testMatch: '**/*.spec.ts',
  retries: 1, // retry once on failure (2 total attempts)
  use: {
    baseURL: process.env.PUBLIC_APP_ORIGIN,
    httpCredentials,
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
