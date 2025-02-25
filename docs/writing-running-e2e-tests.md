# Guide to Running E2E Tests

This guide covers how to run the end-to-end (E2E) tests in Status Reports

## Building the Application (Optional)

Before running your tests, you need to build your application to ensure everything is properly compiled.

- **Build the JavaScript (only once):**

  ```bash
  npm run fe:js:build:only
  npm run fe:css:build:only
  ```

End-to-end tests are managed by **Playwright**. Use these commands to run your browser-based tests:

- **Run Playwright E2E tests:**

  ```bash
  npm run test:e2e
  ```

  This will execute all Playwright E2E tests once, running the tests across configured browsers.

- **Run Playwright E2E tests in watch mode (with UI):**
  ```bash
  npm run test:e2e:watch
  ```
  This command will run Playwright E2E tests in watch mode, opening a UI for easier test management and debugging.
