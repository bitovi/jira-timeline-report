import { test, expect } from '../base';

test.describe('Connect to Jira', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
    });

    test('Login test', async ({ page }) => {
        await page.getByTestId('login-button').click();
        await page.getByTestId('username').click();
        await page.getByTestId('username').fill('testuser@bitovi.com');
        await page.getByRole('button', { name: 'Continue' }).click();
        await page.getByTestId('password').click();
        await page.getByTestId('password').fill('Bitovi1234!');
        await page.getByRole('button', { name: 'Log in' }).click();
        await page.locator('div').filter({ hasText: /^Choose a site$/ }).nth(2).click();
        await page.getByText('bitovi-training.atlassian.net', { exact: true }).click();
        await page.getByRole('button', { name: 'Accept' }).click();
        await page.locator('#configuration').getByRole('img').click();
        await page.getByRole('textbox').click();
        await page.getByRole('textbox').fill('issueType in (Epic, Story) order by Rank');
    });
});
