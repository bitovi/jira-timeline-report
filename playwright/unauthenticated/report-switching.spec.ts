import test, { expect } from '@playwright/test';

// Exercises the React shell's live primary-report switching — the registry swap that replaces the
// StacheElement's `listenTo('primaryReportType')` attach/detach logic. Runs in sample-data mode.
test.describe('Report type switching (React shell)', () => {
  test('swaps the primary report in place when the report type changes', async ({ page }) => {
    await page.goto('/');
    await page.getByText('Release end dates with initiative status').click();

    // Scatter Plot ('due') renders.
    await expect(page.locator('#react-report-container')).toBeVisible();
    expect(page.url()).toContain('primaryReportType=due');
    await expect(page.getByRole('button', { name: /Scatter Plot/i })).toBeVisible();

    // Open the "Report type" dropdown (its trigger shows the current report name) and pick Gantt Chart.
    await page.getByRole('button', { name: /Scatter Plot/i }).click();
    await page.getByRole('menuitem', { name: /Gantt Chart/i }).click();

    // The shell reactively swapped to the gantt report without losing the container.
    await expect(page).toHaveURL(/primaryReportType=start-due/);
    await expect(page.locator('#react-report-container')).toBeVisible();
    await expect(page.getByRole('button', { name: /Gantt Chart/i })).toBeVisible();
  });
});
