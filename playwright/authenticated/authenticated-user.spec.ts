import test, { expect } from '@playwright/test';

test.describe('Authenticated User', () => {
  test('Display graph', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('button', { name: 'Sources' }).click();

    // The JQL input is the `@atlaskit/jql-editor` widget: a ProseMirror `role="combobox"`
    // contenteditable div (not a `<textarea>`), so it's targeted by its stable `data-testid`
    // rather than an accessible name/label (the widget's own aria-label is "JQL query", and the
    // optional "load children" JQL editor renders the identical combobox/testid, so a label-based
    // locator can't uniquely identify this one either). `AnimatedSidebar` also renders `children`
    // a second time inside a permanently `display:none` div (to measure the panel's target width
    // before animating), so this testid resolves to 2 elements in the DOM — filter down to the
    // one that's actually visible to satisfy Playwright's strict-mode single-match requirement.
    const jqlEditor = page.getByTestId('jql-editor-input').filter({ visible: true });
    await jqlEditor.click();
    await jqlEditor.pressSequentially('type = outcome');
    await page.keyboard.press('Escape'); // dismiss the autocomplete suggestion popover

    await page.getByRole('button', { name: 'Apply' }).click();

    await expect(page.getByTestId('gantt-grid')).toBeVisible();
  });
});
