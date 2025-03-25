import test, { expect } from "@playwright/test";
import * as OTPAuth from "otpauth";
import dotenv from 'dotenv';
dotenv.config();

let totp = new OTPAuth.TOTP({
  issuer: "Jira",
  label: "testUser",
  algorithm: "SHA1",
  digits: 6,
  period: 30,
  secret: process.env.JIRA_TOTP_SECRET,
});

test.describe("Connect to Jira", () => {
  test('Login test', async ({ page }) => {
    await page.goto("/");
    
    await page.getByRole('button', { name: 'Sources' }).click();
    const jqlTextarea = page.locator('textarea[placeholder="issueType in (Epic, Story) order by Rank"]').nth(1)
    jqlTextarea.click();
    jqlTextarea.fill('type = outcome');
    await page.getByRole('button', { name: 'Apply' }).click();

    await expect(page.locator('gantt-grid')).toBeVisible()
  });
});
