import test, { expect } from '@playwright/test';

/**
 * The sample links only ever point at reports that are `onByDefault: true` — the Scatter Plot and
 * the Gantt Chart. The first two used to render a `secondaryReportType` card board below their
 * chart; that slot is gone and its report is behind the `cardsReport` flag, so each is now just its
 * chart. See spec/018-card-report/alt-plan.md and SampleDataNotice.tsx.
 */
test.describe('Sample reports navigation', () => {
  test.describe("On 'Initiative end dates' click", () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/');
      const scatterLink = page.getByText('Initiative end dates');
      await scatterLink.waitFor({ state: 'visible' });
      await scatterLink.click();
    });

    test('URL contains selectedIssueType=Initiative', async ({ page }) => {
      expect(page.url()).toContain('selectedIssueType=Initiative');
    });
    test('URL contains hideUnknownInitiatives=true', async ({ page }) => {
      expect(page.url()).toContain('hideUnknownInitiatives=true');
    });
    test('URL contains primaryReportType=due', async ({ page }) => {
      expect(page.url()).toContain('primaryReportType=due');
    });

    test('the page contains existing initiatives', async ({ page }) => {
      const reportOnBtn = page.getByRole('button', { name: /Initiative/i });
      const reportTypeBtn = page.getByRole('button', { name: /Scatter Plot|Gantt Chart/i });
      await expect(reportOnBtn).toBeVisible();
      await expect(reportTypeBtn).toBeVisible();
      await expect(page.locator('#react-report-container')).toBeVisible();
    });

    test('the page renders the report', async ({ page }) => {
      await expect(page.locator('#react-report-container')).toBeVisible();
    });
  });

  test.describe("On 'Initiative timeline' click", () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/');
      await page.getByText('Initiative timeline').click();
    });

    test('URL contains selectedIssueType=Initiative', async ({ page }) => {
      expect(page.url()).toContain('selectedIssueType=Initiative');
    });
    test('URL contains hideUnknownInitiatives=true', async ({ page }) => {
      expect(page.url()).toContain('hideUnknownInitiatives=true');
    });

    test('URL contains primaryReportType=start-due', async ({ page }) => {
      expect(page.url()).toContain('primaryReportType=start-due');
    });

    test('the page contains existing initiatives', async ({ page }) => {
      const reportOnBtn = page.getByRole('button', { name: /Initiative/i });
      const reportTypeBtn = page.getByRole('button', { name: /Gantt Chart/i });
      await expect(reportOnBtn).toBeVisible();
      await expect(reportTypeBtn).toBeVisible();
      await expect(page.locator('#react-report-container')).toBeVisible();
    });
  });

  test.describe("On 'Ready and in-development initiative work breakdown' click", () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/');
      await page.getByText('Ready and in-development initiative work breakdown').click();
    });

    test('URL contains selectedIssueType=Initiative', async ({ page }) => {
      expect(page.url()).toContain('selectedIssueType=Initiative');
    });
    test('URL contains hideUnknownInitiatives=true', async ({ page }) => {
      expect(page.url()).toContain('hideUnknownInitiatives=true');
    });

    test('URL contains primaryReportType=start-due', async ({ page }) => {
      expect(page.url()).toContain('primaryReportType=start-due');
    });

    test('URL contains primaryReportBreakdown=true', async ({ page }) => {
      expect(page.url()).toContain('primaryReportBreakdown=true');
    });

    test('the page contains existing initiatives', async ({ page }) => {
      const reportOnBtn = page.getByRole('button', { name: /Initiative/i });
      const reportTypeBtn = page.getByRole('button', { name: /Gantt Chart/i });
      await expect(reportOnBtn).toBeVisible();
      await expect(reportTypeBtn).toBeVisible();
      await expect(page.locator('#react-report-container')).toBeVisible();
    });
  });
});
