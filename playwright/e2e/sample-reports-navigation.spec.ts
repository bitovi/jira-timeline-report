import test, { expect } from "@playwright/test";

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
      const initiatives = await page.locator('.release-timeline-item').count();
      await expect(initiatives).toBeGreaterThan(0)
    });

    test("the page has status report", async ({ page }) => {
      await expect(page.locator("status-report")).toBeVisible();
      const items = await page.locator("status-report .release_box ul li").count();
      await expect(items).toBeGreaterThan(1);
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
      const items = await page.locator("status-report .release_box ul li").count();
      await expect(items).toBeGreaterThan(1);
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
