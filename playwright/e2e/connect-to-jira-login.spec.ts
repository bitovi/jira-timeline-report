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

    const loginButton = page.getByRole('button', { name: 'Connect to Jira' })
    await loginButton.waitFor({ state: 'visible' });
    await loginButton.click();

    const inputUsername =await page.locator('input[name="username"]');
    await inputUsername.click();
    await inputUsername.fill('testuser@bitovi.com');
    await page.getByRole('button', { name: 'Continue' }).click();

    const inputPassword = await page.locator('input[name="password"]');
    await inputPassword.click();
    await inputPassword.fill('Bitovi1234!');
    await page.getByRole('button', { name: 'Log in' }).click();

    const totpInput = page.getByPlaceholder('6-digit verification code').first()
    const totpValue = totp.generate()
    await totpInput.fill(totpValue)
    await page.locator('#react-select-2-input').click();
    await page.getByText('bitovi-training.atlassian.net', { exact: true }).click();
    await page.getByRole('button', { name: 'Accept' }).click();


    
    await page.getByRole('button', { name: 'Sources' }).click();
    const jqlTextarea = page.locator('textarea[placeholder="issueType in (Epic, Story) order by Rank"]').nth(1)
    jqlTextarea.click();
    jqlTextarea.fill('type = outcome');
    await page.getByRole('button', { name: 'Apply' }).click();

    await expect(page.locator('gantt-grid')).toBeVisible()
  });
});
