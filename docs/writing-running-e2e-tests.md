# Documentation for Running and Writing Unit Tests with Playwright

## Running Unit Tests

To run unit tests using Playwright, follow these steps:

1. **Install Dependencies**: Ensure you have all the necessary dependencies installed. You can install them using npm or yarn:

   ```sh
   npm install
   # or
   yarn install
   ```

2. **Run Tests in UI mode**: for running test in UI mode (helpful for debugging and running tests on watch mode) :

   ```sh
   npm run test:e2e:watch
   ```

3. **Run tests in headless mode**:

   ```sh
   npm run test:e2e
   ```

## Writing Unit Tests

To write unit tests using Playwright, follow these guidelines:

1. **Create Test Files**: Test files should be placed in the `playwright/e2e` directory

2. **Import Playwright**: Import the necessary Playwright modules at the beginning of your test files:

   ```typescript
   import { test, expect } from "@playwright/test";
   ```

3. **Write Test Cases**: Use the `test` function to define individual test cases. Each test case should have a descriptive name and a callback function containing the test logic:

   ```typescript
   test("should display the correct title", async ({ page }) => {
     await page.goto("https://example.com");
     const title = await page.title();
     expect(title).toBe("Example Domain");
   });
   ```

4. **Use Assertions**: Use Playwright's built-in assertions to verify the expected outcomes:

   ```typescript
   expect(await page.textContent("h1")).toBe("Example Domain");
   ```

5. **Run Setup and Teardown**: Use hooks like `beforeAll`, `beforeEach`, `afterAll`, and `afterEach` to run setup and teardown logic:

   ```typescript
   test.beforeEach(async ({ page }) => {
     await page.goto("https://example.com");
   });
   ```

For more detailed information, refer to the [Playwright documentation](https://playwright.dev/docs/intro).

6. Using Allure Reporter
