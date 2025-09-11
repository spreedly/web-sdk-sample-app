// This is a sample config for what users might be running locally
const config = {
  testDir: './test',
  testMatch: '**/*.spec.ts',

  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },

  timeout: 90 * 1000,
  expect: {
    timeout: 5000,
  },
  workers: 1,
  reporter: 'line',
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
