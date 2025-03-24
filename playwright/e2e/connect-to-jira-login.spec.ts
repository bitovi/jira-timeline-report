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

    const loginButton = page.getByTestId('login-button')
    await loginButton.waitFor({ state: 'visible' });
    await loginButton.click();
    await page.getByTestId('username').click();
    // await page.getByTestId('username').fill('dtran@bitovi.com');
    await page.getByTestId('username').fill('testuser@bitovi.com');

    await page.getByRole('button', { name: 'Continue' }).click();
    await page.getByTestId('password').click();
    // await page.getByTestId('password').fill('Dt@121989');
    await page.getByTestId('password').fill('Bitovi1234!');
    await page.getByRole('button', { name: 'Log in' }).click();

    const totpInput = page.getByPlaceholder('6-digit verification code').first()

    const totpValue = totp.generate()
    await totpInput.fill(totpValue)
    await page.locator('div').filter({ hasText: /^Choose a site$/ }).nth(2).click();
    await page.getByText('bitovi-training.atlassian.net', { exact: true }).click();
    await page.getByRole('button', { name: 'Accept' }).click();
    await page.getByRole('button', { name: 'Sources' }).click();
    const jqlTextarea = await page.getByTestId('JQL-textarea').nth(1)
    jqlTextarea.click();
    jqlTextarea.fill('type = outcome');
    await page.getByRole('button', { name: 'Apply' }).click();

    await expect(page.locator('gantt-grid')).toBeVisible()
  });
});
