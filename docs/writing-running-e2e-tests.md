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

- **Config Setup**

Atlassian has a security causing automated testing to not run smoothly. They're a few workarounds to get E2E testing to use 2SV (two-step verification) suggested by the Atlassian team. ***keep in mind these workarounds may stop working in the future as Atlassian continues to evolve and change.***

To [setup 2SV](https://confluence.atlassian.com/cloudkb/emailed-otp-marketplace-partners-automation-guide-for-e2e-end-to-end-testing-using-two-step-verification-2sv-mfa-2fa-1456346710.html). Navigate to the link and in the **TOTP** section to setup 2SV and get the TOTP key. 

Once you have the key, copy the following code into your `.env`

```
JIRA_TEST_USERNAME=<UserName>
JIRA_TEST_PASSWORD=<Password>
JIRA_TOTP_SECRET=<TOTP key>
```

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
