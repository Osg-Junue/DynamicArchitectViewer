import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { gzipSync } from 'node:zlib';
import { expect, test } from '@playwright/test';
import { DEFAULT_DSL, openWebview, watchErrors, writeExport } from './helpers';

test.describe('exported HTML', () => {
  test('works standalone from file:// under its strict CSP', async ({ page, context }, info) => {
    await openWebview(page);
    await expect(page.locator('.dav-node')).not.toHaveCount(0);
    const file = info.outputPath('export.html');
    await writeExport(file);

    const viewer = await context.newPage();
    const errors = watchErrors(viewer);
    await viewer.goto(pathToFileURL(file).href);

    // Rendered by the inline runtime (would be blocked if the CSP hash were wrong).
    await expect(viewer.locator('.dav-node')).toHaveCount(8);
    await expect(viewer.getByTestId('select-step').locator('option')).toHaveCount(5);
    await expect(viewer.locator('.dav-step-title')).toContainText('Step 1 / 4');
    await expect(viewer.locator('header.dav-topbar [data-testid="btn-play"]')).toBeVisible();

    // Packets animate along paths.
    await expect(viewer.locator('.dav-packet')).not.toHaveCount(0);

    // The step ruler tracks animation progress under the strict CSP.
    await expect(viewer.getByTestId('step-timeline').locator('.dav-tick')).toHaveCount(4);
    await expect
      .poll(() =>
        viewer
          .locator('.dav-tick.is-current .dav-tick-fill')
          .evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).a),
      )
      .toBeGreaterThan(0);

    // Keyboard & top dropdown navigation.
    await viewer.locator('body').press('ArrowRight');
    await expect(viewer.locator('.dav-step-title')).toContainText('Step 2 / 4');
    await viewer.getByTestId('select-step').selectOption('3');
    await expect(viewer.locator('.dav-step-title')).toContainText('Step 4 / 4');
    await expect(viewer.locator('.dav-node[data-id="db_pri"] .dav-badge')).toContainText('DOWN');

    // Scene DOM in exported HTML must match the editor preview at the same step.
    await page.getByTestId('select-step').selectOption('3');
    expect(await viewer.locator('.dav-scene').innerHTML()).toBe(
      await page.locator('.dav-scene').innerHTML(),
    );

    expect(errors).toEqual([]);
  });

  test('keeps its inline stylesheet minified and within budget', async ({ page: _ }, info) => {
    const file = info.outputPath('style.html');
    await writeExport(file);
    const style = /<style>([\s\S]*?)<\/style>/.exec(await readFile(file, 'utf8'))?.[1] ?? '';
    expect(style).toContain('.dav-app');
    expect(style).not.toContain('/*');
    expect(style).not.toContain('\n');
    expect(Buffer.byteLength(style, 'utf8')).toBeLessThan(10 * 1024);
    expect(gzipSync(style).length).toBeLessThan(3.5 * 1024);
  });

  test('shows its UI in the language it was exported with', async ({ page }, info) => {
    const file = info.outputPath('ja.html');
    await writeExport(file, DEFAULT_DSL, 'ja');
    await page.goto(pathToFileURL(file).href);
    await expect(page.getByTestId('btn-play')).toHaveAttribute('aria-label', 'このステップを再生');
    await expect(page.locator('html')).toHaveAttribute('lang', 'ja');
  });

  test('honors prefers-reduced-motion', async ({ browser }, info) => {
    const context = await browser.newContext({ reducedMotion: 'reduce' });
    const file = info.outputPath('reduced.html');
    await writeExport(file);
    const viewer = await context.newPage();
    await viewer.goto(pathToFileURL(file).href);
    await expect(viewer.locator('.dav-node')).not.toHaveCount(0);
    await expect(viewer.getByTestId('btn-play')).toHaveAttribute('aria-pressed', 'false');
    await expect(viewer.getByTestId('btn-motion')).toHaveAttribute('aria-pressed', 'true');
    await expect(viewer.getByTestId('btn-motion')).toBeDisabled();
    await expect(viewer.locator('.dav-packet')).toHaveCount(0);

    // A node's phase can still be inspected, parked on its rail.
    await viewer.locator('.dav-node[data-id="waf"]').click();
    await expect(viewer.locator('.dav-packet .dav-packet-label')).toHaveText('Pass ACL');
    const before = await viewer.locator('.dav-packet-dot').first().getAttribute('transform');
    await viewer.waitForTimeout(600);
    expect(await viewer.locator('.dav-packet-dot').first().getAttribute('transform')).toBe(before);
    await context.close();
  });
});
