import test, { expect } from '@playwright/test';

test.describe('Login Page', () => {
  test.describe('Initial Page Load', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/');
    });

    test('should display the login screen initially', async ({ page }) => {
      const loginScreen = page.locator('#loginScreen');
      await expect(loginScreen).toBeVisible();

      const mainContent = page.locator('#mainContent');
      await expect(mainContent).toHaveCSS('display', 'none');
    });

    test('should show both login options', async ({ page }) => {
      const connectToJiraBtn = page.getByTestId('connect-to-jira-button');
      const continueAsGuestBtn = page.getByTestId('continue-as-guest-button');

      await expect(connectToJiraBtn).toBeVisible();
      await expect(continueAsGuestBtn).toBeVisible();

      await expect(connectToJiraBtn).toHaveText('Connect to Jira');
      await expect(continueAsGuestBtn).toHaveText('Continue as Guest');
    });

    test('should display branding and title', async ({ page }) => {
      await expect(page.getByText('Status Reports for Jira')).toBeVisible();
      await expect(page.getByText('Generate PowerPoint slides for high-level status reporting')).toBeVisible();
      await expect(page.getByRole('img', { name: 'Bitovi Logo' })).toBeVisible();
    });

    test('should display links to external resources', async ({ page }) => {
      const githubLink = page.getByRole('link', { name: 'View on GitHub' });
      const consultingLink = page.getByRole('link', { name: 'Bitovi Consulting' });

      await expect(githubLink).toBeVisible();
      await expect(consultingLink).toBeVisible();

      await expect(githubLink).toHaveAttribute('href', 'https://github.com/bitovi/jira-timeline-report');
      await expect(consultingLink).toHaveAttribute(
        'href',
        'https://www.bitovi.com/services/agile-project-management-consulting',
      );
    });
  });

  test.describe('Guest Mode', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/');
    });

    test('should load main application when Continue as Guest is clicked', async ({ page }) => {
      const continueAsGuestBtn = page.getByTestId('continue-as-guest-button');
      await continueAsGuestBtn.click();

      // Login screen should be hidden
      const loginScreen = page.locator('#loginScreen');
      await expect(loginScreen).toHaveCSS('display', 'none');

      // Main content should be visible
      const mainContent = page.locator('#mainContent');
      await expect(mainContent).toBeVisible();

      // Wait for the application to load
      await page.waitForTimeout(2000);

      // Check that the application loaded with sample data
      const loadingMessage = page.getByText('Loading the Jira Timeline Report');
      await expect(loadingMessage).toBeHidden();
    });

    test('should show sample data navigation links in guest mode', async ({ page }) => {
      const continueAsGuestBtn = page.getByTestId('continue-as-guest-button');
      await continueAsGuestBtn.click();

      // Wait for the application to load
      await page.waitForTimeout(3000);

      // Should show sample reports navigation
      const sampleReportsHeading = page.getByText('Sample Reports', { exact: false });
      await expect(sampleReportsHeading).toBeVisible();
    });
  });

  test.describe('Jira Authentication', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/');
    });

    test('should show loading state when Connect to Jira is clicked', async ({ page }) => {
      const connectToJiraBtn = page.getByTestId('connect-to-jira-button');

      // Click the connect button
      await connectToJiraBtn.click();

      // Button should show loading state
      await expect(connectToJiraBtn).toHaveText('Connecting...');
      await expect(connectToJiraBtn).toBeDisabled();
    });
  });
});
