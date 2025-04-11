import test, { expect } from "@playwright/test";

test.describe("Authenticated User", () => {
  test('Display graph', async ({ page }) => {
    await page.goto("/");
    
    await page.getByRole('button', { name: 'Sources' }).click();

    const jqlTextarea = await page.getByLabel('Add your JQL').filter({ visible: true })
    await jqlTextarea.click();
    await jqlTextarea.fill('type = outcome');

    await page.getByRole('button', { name: 'Apply' }).click();

    await expect(page.locator('gantt-grid')).toBeVisible()
  });
});