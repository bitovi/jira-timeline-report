import { test, expect } from '../base';

test('has Jira Timeline Report title', async ({ page }) => {
  // Navigate to the page (baseURL is used automatically for relative paths)
  await page.goto('/');
  await expect(page).toHaveTitle(/Jira Timeline Report/);
});

test.describe('Link validation test', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the page where the links exist (baseURL is used automatically for relative paths)
    await page.goto('/');
  });

  test('should check if the release end dates link exists and navigates to the correct URL', async ({ page }) => {
    const releaseEndDatesLink = await page.getByTestId('release-end-dates-link');
    await expect(releaseEndDatesLink).toBeVisible();
    await releaseEndDatesLink.click();
    await expect(page.url()).toContain('?primaryIssueType=Release&hideUnknownInitiatives=true&primaryReportType=due&secondaryReportType=status');
  });

  test('should check if the release timeline link exists and navigates to the correct URL', async ({ page }) => {
    const releaseTimelineLink = await page.getByTestId('release-timeline-link');
    await expect(releaseTimelineLink).toBeVisible();
    await releaseTimelineLink.click();
    await expect(page.url()).toContain('?primaryIssueType=Release&hideUnknownInitiatives=true&secondaryReportType=breakdown');
  });

  test('should check if the initiative work breakdown link exists and navigates to the correct URL', async ({ page }) => {
    const initiativeWorkBreakdownLink = await page.getByTestId('initiative-work-breakdown-link');
    await expect(initiativeWorkBreakdownLink).toBeVisible();
    await initiativeWorkBreakdownLink.click();
    await expect(page.url()).toContain('?primaryIssueType=Initiative&hideUnknownInitiatives=true&primaryReportType=breakdown');
  });
});
