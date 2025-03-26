import { test as setup, expect } from '@playwright/test';
import * as OTPAuth from "otpauth";
import path from 'path';

let totp = new OTPAuth.TOTP({
  issuer: "Jira",
  label: "testUser",
  algorithm: "SHA1",
  digits: 6,
  period: 30,
  secret: process.env.JIRA_TOTP_SECRET,
});

const authFile = path.join(__dirname, '../playwright/.auth/authenticated.json');

setup('authenticate', async ({ page }) => {
  await page.goto("/");

  const loginButton = page.getByRole('button', { name: 'Connect to Jira' })
  await loginButton.waitFor({ state: 'visible' });
  await loginButton.click();

  const inputUsername = await page.getByPlaceholder('Enter your email');
  await inputUsername.click();
  await inputUsername.fill(process.env.JIRA_TEST_USERNAME || '');
  await page.getByRole('button', { name: 'Continue' }).click();

  const inputPassword = await page.getByPlaceholder('Enter password');
  await inputPassword.click();
  await inputPassword.fill(process.env.JIRA_TEST_PASSWORD || '');
  await page.getByRole('button', { name: 'Log in' }).click();

  const totpInput = page.getByPlaceholder('6-digit verification code').first()
  const totpValue = totp.generate()
  await totpInput.fill(totpValue)
  await page.locator('#react-select-2-input').click();
  await page.getByText('bitovi-training.atlassian.net', { exact: true }).click();
  await page.getByRole('button', { name: 'Accept' }).click();

  await expect(page.getByRole('button', { name: 'Log Out' })).toBeVisible();

  await page.context().storageState({ path: authFile });
});