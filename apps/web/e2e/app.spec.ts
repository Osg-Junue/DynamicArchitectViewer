import { pathToFileURL } from 'node:url';
import { expect, type Page, test } from '@playwright/test';

/** Collects console errors, page errors and CSP violations. */
function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(`console: ${msg.text()}`);
  });
  return errors;
}

test.describe('web app', () => {
  test('renders the sample diagram in the shared player', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto('/');
    await expect(page.locator('.dav-node')).not.toHaveCount(0);
    await expect(page.locator('.dav-title')).toHaveText(/AWS/);
    await expect(page.locator('.problems .ok')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('updates the preview and reports problems while typing', async ({ page }) => {
    await page.goto('/');
    const input = page.locator('textarea.dsl-input');
    await input.fill('dav 1\ntitle "Typed"\nnode a [icon: databse]\nnode b\na --> b');
    await expect(page.locator('.dav-title')).toHaveText('Typed');
    await expect(page.locator('.dav-node')).toHaveCount(2);
    await expect(page.locator('.problems .error')).toContainText('database');
  });
});

test.describe('exported HTML', () => {
  test('works standalone from file:// under its strict CSP', async ({ page, context }, info) => {
    await page.goto('/');
    await expect(page.locator('.dav-node')).not.toHaveCount(0);
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.locator('.toolbar button.primary').click(),
    ]);
    const file = info.outputPath('export.html');
    await download.saveAs(file);

    const viewer = await context.newPage();
    const errors = watchErrors(viewer);
    await viewer.goto(pathToFileURL(file).href);

    // Rendered by the inline runtime (would be blocked if the CSP hash were wrong).
    await expect(viewer.locator('.dav-node')).toHaveCount(8);
    await expect(viewer.locator('.dav-pill')).toHaveCount(5);
    await expect(viewer.locator('.dav-step-title')).toContainText('1 / 4');

    // Packets animate along paths.
    await expect(viewer.locator('.dav-packet')).not.toHaveCount(0);

    // Keyboard navigation.
    await viewer.locator('body').press('ArrowRight');
    await expect(viewer.locator('.dav-step-title')).toContainText('2 / 4');
    await viewer.locator('.dav-pill').nth(4).click();
    await expect(viewer.locator('.dav-step-title')).toContainText('4 / 4');
    await expect(viewer.locator('.dav-node[data-id="db_pri"] .dav-badge')).toContainText('DOWN');

    // Scene DOM in exported HTML must match the editor preview at the same step.
    await page.locator('.dav-pill').nth(4).click();
    expect(await viewer.locator('.dav-scene').innerHTML()).toBe(
      await page.locator('.dav-scene').innerHTML(),
    );

    // Embedded DSL dialog.
    await viewer.getByRole('button', { name: /DSL/ }).first().click();
    await expect(viewer.locator('.dav-source')).toContainText('dav 1');
    await viewer.keyboard.press('Escape');

    expect(errors).toEqual([]);
  });

  test('re-imports an exported file into the app', async ({ page }, info) => {
    await page.goto('/');
    await page
      .locator('textarea.dsl-input')
      .fill('dav 1\ntitle "Round trip"\nnode a\nnode b\na --> b');
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.locator('.toolbar button.primary').click(),
    ]);
    const file = info.outputPath('roundtrip.html');
    await download.saveAs(file);

    await page.reload();
    await page.locator('input[type=file]').setInputFiles(file);
    await expect(page.locator('textarea.dsl-input')).toHaveValue(
      'dav 1\ntitle "Round trip"\nnode a\nnode b\na --> b',
    );
  });

  test('honors prefers-reduced-motion', async ({ browser }, info) => {
    const context = await browser.newContext({ reducedMotion: 'reduce' });
    const page = await context.newPage();
    await page.goto('/');
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.locator('.toolbar button.primary').click(),
    ]);
    const file = info.outputPath('reduced.html');
    await download.saveAs(file);
    const viewer = await context.newPage();
    await viewer.goto(pathToFileURL(file).href);
    await expect(viewer.locator('.dav-btn[aria-pressed]')).toHaveAttribute('aria-pressed', 'false');
    const before = await viewer.locator('.dav-packet').first().getAttribute('transform');
    await viewer.waitForTimeout(600);
    expect(await viewer.locator('.dav-packet').first().getAttribute('transform')).toBe(before);
    await context.close();
  });
});
