import test, { expect } from "@playwright/test";

// since we are authorized during setup, this clears the storage out so we can test the unauthorized state
test.use({ storageState: { cookies: [], origins: [] } });

test.describe("Sample reports navigation", () => {
  test.describe("On 'Release end dates with initiative status' click", () => {
    test.beforeEach(async ({ page }) => {
      await page.goto("/");
      const releaseLink = page.getByText("Release end dates with initiative status");
      await releaseLink.waitFor({ state: "visible" });
      await releaseLink.click();
    });

    test("URL contains primaryIssueType=Release", async ({ page }) => {
      expect(page.url()).toContain("primaryIssueType=Release");
    });
    test("URL contains hideUnknownInitiatives=true", async ({ page }) => {
      expect(page.url()).toContain("hideUnknownInitiatives=true");
    });
    test("URL contains primaryReportType=due", async ({ page }) => {
      expect(page.url()).toContain("primaryReportType=due");
    });
    test("URL contains secondaryReportType=status", async ({ page }) => {
      expect(page.url()).toContain("secondaryReportType=status");
    });

    test("the page contains existing initiatives", async ({ page }) => {
      const reportOnBtn = page.locator('select-issue-type').locator('button');
      const reportTypeBtn = page.locator('select-report-type').locator('button');
      await expect(reportOnBtn).toHaveText('Initiatives');
      await expect(reportTypeBtn).toHaveText('Scatter Plot');
      await expect(page.getByText('Track your order maps')).toBeDefined();
      await expect(page.getByText('Favorite sharing')).toBeDefined();
      await expect(page.getByText('Order Playback')).toBeDefined();
      await expect(page.getByText('Social sharing')).toBeDefined();
    });

    test("the page has status report", async ({ page }) => {
      await expect(page.locator("status-report")).toBeVisible();
      await expect(page.locator("status-report").getByText('Track your order maps')).toBeVisible();
      await expect(page.locator("status-report").getByText('Social sharing')).toBeVisible();
      await expect(page.locator("status-report").getByText('QA: Favorite Sharing')).toBeVisible();
      await expect(page.locator("status-report").getByText("QA: Internationalization")).toBeVisible();
      await expect(page.locator("status-report").getByText('Order Playback')).toBeVisible();
    });
  });

  test.describe("On 'Release timeline with initiative work breakdown' click", () => {
    test.beforeEach(async ({ page }) => {
      await page.goto("/");
      await page.getByText("Release timeline with initiative work breakdown").click();
    });

    test("URL contains primaryIssueType=Release", async ({ page }) => {
      expect(page.url()).toContain("primaryIssueType=Release");
    });
    test("URL contains hideUnknownInitiatives=true", async ({ page }) => {
      expect(page.url()).toContain("hideUnknownInitiatives=true");
    });

    test("URL contains secondaryReportType=breakdown", async ({ page }) => {
      expect(page.url()).toContain("secondaryReportType=breakdown");
    });

    test("the page contains existing initiatives", async ({ page }) => {
      const reportOnBtn = page.locator('select-issue-type').locator('button');
      const reportTypeBtn = page.locator('select-report-type').locator('button');
      await expect(reportOnBtn).toHaveText('Initiatives');
      await expect(reportTypeBtn).toHaveText('Gantt Chart');
      await expect(page.locator('gantt-grid')).toBeVisible()
    });

    test("the page has status report", async ({ page }) => {
      await expect(page.locator("status-report")).toBeVisible();
      await expect(page.locator("status-report").getByText('Track your order maps')).toBeVisible();
      await expect(page.locator("status-report").getByText('Social sharing')).toBeVisible();
      await expect(page.locator("status-report").getByText('QA: Favorite Sharing')).toBeVisible();
      await expect(page.locator("status-report").getByText("QA: Internationalization")).toBeVisible();
      await expect(page.locator("status-report").getByText('Order Playback')).toBeVisible();
    })
  });

  test.describe("On 'Ready and in-development initiative work breakdown' click", () => {
    test.beforeEach(async ({ page }) => {
      await page.goto("/");
      await page.getByText("Ready and in-development initiative work breakdown").click();
    });

    test("URL contains primaryIssueType=Initiative", async ({ page }) => {
      expect(page.url()).toContain("primaryIssueType=Initiative");
    });
    test("URL contains hideUnknownInitiatives=true", async ({ page }) => {
      expect(page.url()).toContain("hideUnknownInitiatives=true");
    });

    test("URL contains primaryReportType=start-due", async ({ page }) => {
      expect(page.url()).toContain("primaryReportType=start-due");
    });

    test("URL contains primaryReportBreakdown=true", async ({ page }) => {
      expect(page.url()).toContain("primaryReportBreakdown=true");
    });

    test("the page contains existing initiatives", async ({ page }) => {
      const reportOnBtn = page.locator('select-issue-type').locator('button');
      const reportTypeBtn = page.locator('select-report-type').locator('button');
      await expect(reportOnBtn).toHaveText('Initiatives');
      await expect(reportTypeBtn).toHaveText('Gantt Chart');
      await expect(page.locator('gantt-grid')).toBeVisible()
    });

  });
});
