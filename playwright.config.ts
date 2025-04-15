import { defineConfig, devices } from "@playwright/test";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(__dirname, ".env") });

export const authenticatedFileName = 'authenticated.json'

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  globalSetup: "./playwright/global-setup",
  globalTeardown: "./playwright/global-teardown",
  testDir: "./playwright/",
  outputDir: "./playwright/test-results",
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  workers: undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: [["allure-playwright", { resultsDir: "./playwright/report" }]],
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    // command: BASE_URL=https://timeline-report.bitovi-jira.com npx playwright test
    baseURL: process.env.BASE_URL || "http://localhost:8080",

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: "on-first-retry",
    video: "on",
    viewport: { width: 1920, height: 1080 },
  },

  /* Configure projects for major browsers */
  projects: [
    { name: "setup", testMatch: /.*\.setup\.ts/ },
    // {
    //   name: "firefox",
    //   use: { ...devices["Desktop Firefox"] },
    // },
    // {
    //   name: "chromium",
    //   use: { 
    //     ...devices["Desktop Chrome"] },
    //   dependencies: ['setup'],
    // },
    {
      name: "auth",
      testMatch: "authenticated/*.spec.ts",
      use: { 
        ...devices["Desktop Chrome"],
        storageState: `playwright/.auth/${authenticatedFileName}`,
      },
      dependencies: ["setup"],
    },
    {
      name: "unauth",
      testMatch: "unauthenticated/*.spec.ts",
      use: { 
        ...devices["Desktop Chrome"],
      },
    },
    // {
    //   name: 'webkit',
    //   use: { ...devices['Desktop Safari'] },
    // },

    /* Test against mobile viewports. */
    // {
    //   name: 'Mobile Chrome',
    //   use: { ...devices['Pixel 5'] },
    // },
    // {
    //   name: 'Mobile Safari',
    //   use: { ...devices['iPhone 12'] },
    // },

    /* Test against branded browsers. */
    // {
    //   name: 'Microsoft Edge',
    //   use: { ...devices['Desktop Edge'], channel: 'msedge' },
    // },
    // {
    //   name: 'Google Chrome',
    //   use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    // },
  ],

  /* Run your local dev server before starting the tests */
  // webServer: {
  //   command: "npx http-server ./dist",
  //   url: "http://localhost:8080",
  //   reuseExistingServer: true,
  // },
  reportSlowTests: null,
});
