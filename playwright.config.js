/** @type {import('@playwright/test').PlaywrightTestConfig} */
module.exports = {
  testDir: './test',
  testMatch: ['sites/**/*.spec.js'],
  timeout: 90000,
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
  use: {
    baseURL: 'http://localhost:3567',
  },
  webServer: {
    command: 'node test/helpers/site-server.js 3567',
    port: 3567,
    reuseExistingServer: !process.env.CI,
  },
};
