import { test as setup, expect } from '@playwright/test';
import * as OTPAuth from 'otpauth';
import path from 'path';
import { authenticatedFileName } from '../playwright.config';

import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const totp = new OTPAuth.TOTP({
  issuer: 'Jira',
  label: 'testUser',
  algorithm: 'SHA1',
  digits: 6,
  period: 30,
  secret: process.env.JIRA_TOTP_SECRET,
});

setup('authenticate', async ({ page }) => {
  const authFile = path.join(__dirname, `../playwright/.auth/${authenticatedFileName}`);

  await page.goto('/');

  const loginButton = page.getByRole('button', { name: 'Connect to Jira' });
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

  const totpInput = page.getByLabel('6-digit verification code');
  await totpInput.waitFor({ state: 'visible' });

  const totpValue = totp.generate();
  await totpInput.fill(totpValue);

  // Submit the TOTP form — Atlassian's TOTP page may auto-submit after
  // filling all 6 digits, or may require pressing Enter / clicking a button.
  // We press Enter as a reliable way to submit regardless of the UI variant.
  await totpInput.press('Enter');

  // Wait for navigation to the consent page
  await page.waitForURL('**/oauth2/authorize/**', { timeout: 15000 });

  // Atlassian's consent page has two variants:
  //   1. Multi-site: shows a combobox to "Choose a site" — must select one
  //   2. Single-site: auto-selects the only site, no combobox shown
  // Handle both by checking if the combobox exists.
  const siteSelector = page.getByRole('combobox');
  const hasSiteSelector = await siteSelector.isVisible({ timeout: 5000 }).catch(() => false);

  if (hasSiteSelector) {
    await siteSelector.click();
    await page.getByText('bitovi-training.atlassian.net', { exact: true }).click();
  }

  // Wait for Accept button to become enabled (it starts disabled while loading)
  const acceptButton = page.getByRole('button', { name: 'Accept' });
  await acceptButton.waitFor({ state: 'visible', timeout: 15000 });
  await expect(acceptButton).toBeEnabled({ timeout: 10000 });
  await acceptButton.click();

  await expect(page.getByRole('button', { name: 'Log Out' })).toBeVisible();

  await page.context().storageState({ path: authFile });
});
