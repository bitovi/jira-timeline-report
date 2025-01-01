import test, { expect } from "@playwright/test";

test.describe("Sample reports navigation", () => {
  test.describe("On 'Release end dates with initiative status' click", () => {
    test.beforeEach(async ({ page }) => {
      await page.goto("/");
      await page.getByTestId("release-status").click();
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
  });

  test.describe("On 'Release timeline with initiative work breakdown' click", () => {
    test.beforeEach(async ({ page }) => {
      await page.goto("/");
      await page.getByTestId("release-work-breakdown").click();
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
  });

  test.describe("On 'Ready and in-development initiative work breakdown' click", () => {
    test.beforeEach(async ({ page }) => {
      await page.goto("/");
      await page.getByTestId("initiative-work-breakdown").click();
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
  });
});
