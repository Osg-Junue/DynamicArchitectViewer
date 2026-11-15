import { expect, test } from '@playwright/test';
import { ICON_NAMES } from '../src/model/types';
import { openWebview, watchErrors } from './helpers';

test.describe('the documentation inside the preview', () => {
  test('opens the documentation and wraps cleanly on narrow viewports', async ({ page }) => {
    const errors = watchErrors(page);
    // The same restrictions the extension host puts on the webview.
    await page.route(/\/$/, async (route) => {
      const response = await route.fetch();
      await route.fulfill({
        response,
        headers: {
          ...response.headers(),
          'content-security-policy':
            "default-src 'none'; img-src 'self' data:; style-src 'self'; script-src 'self'",
        },
      });
    });
    await openWebview(page);
    await expect(page.locator('.dav-node')).not.toHaveCount(0);

    await page.getByTestId('btn-open-help').click();
    const dialog = page.getByTestId('help-dialog');
    await expect(dialog).toBeVisible();

    // The overview plays a real diagram under the page's CSP.
    await expect(dialog.locator('.dav-node')).toHaveCount(3);
    await expect(dialog.locator('.doc-line.is-running')).toHaveCount(1);

    // Examples repeat the current step, and only the reader changes steps.
    const figurePlay = dialog.getByTestId('btn-play');
    await expect(figurePlay).toBeVisible();
    await expect(figurePlay).toHaveAttribute('aria-pressed', 'true');
    await expect(dialog.getByTestId('btn-play-mode')).toBeHidden();
    await expect(dialog.locator('.dav-step-title')).toContainText('Step 1 / 2');
    await dialog.locator('.dav-tick').nth(1).click();
    await expect(dialog.locator('.dav-step-title')).toContainText('Step 2 / 2');
    await expect(figurePlay).toHaveAttribute('aria-pressed', 'true');

    // Every color shows distinct light and dark values read from the theme.
    await page.getByTestId('doc-nav-colors').click();
    const swatches = page.getByTestId('doc-palette').locator('.doc-swatch');
    await expect(swatches).toHaveCount(9);
    await expect(page.getByTestId('doc-color-none').locator('.dav-node')).toHaveCount(6);
    const [lightHex, darkHex] = await swatches.first().locator('.doc-swatch-hex').allTextContents();
    expect(lightHex).toMatch(/^#[0-9a-f]{6}$/);
    expect(darkHex).toMatch(/^#[0-9a-f]{6}$/);
    expect(lightHex).not.toBe(darkHex);
    await page.getByTestId('doc-chip-red').click();
    await expect(page.getByTestId('doc-color-lab').locator('.doc-code')).toContainText(
      'color: red',
    );

    // All icons render, and the filter narrows them.
    await page.getByTestId('doc-nav-icons').click();
    const icons = page.getByTestId('doc-icon-catalog').locator('.doc-icon-card');
    await expect(icons).toHaveCount(ICON_NAMES.length);
    await expect(icons.first().locator('.dav-station')).toHaveCount(1);
    await page.getByTestId('doc-icon-search').fill('database');
    await expect(icons).toHaveCount(1);

    // Animation pages show the phases of the running step.
    await page.getByTestId('doc-nav-animate').click();
    await expect(page.getByTestId('doc-figure')).toHaveCount(7);
    await expect(page.getByTestId('doc-phase-strip').first().locator('.doc-phase')).toHaveCount(3);
    await expect(page.locator('.doc-phase.is-active').first()).toBeVisible();

    // State shows accumulated values, including the reset in the last step.
    await page.getByTestId('doc-nav-state').click();
    const badgeRow = page.getByTestId('doc-state-matrix').locator('tbody tr').first();
    await expect(badgeRow.locator('th')).toHaveText('db.badge');
    await expect(badgeRow.locator('td').last()).toHaveText('—');

    await page.getByTestId('doc-nav-diagnostics').click();
    await expect(page.getByTestId('doc-diagnostics').locator('tbody tr')).toHaveCount(20);

    await page.getByTestId('doc-nav-prompt').click();
    await expect(page.getByTestId('ai-prompt-textarea')).toHaveValue(/dav 1/);
    await page.getByTestId('chk-include-current-dsl').check();
    await expect(page.getByTestId('ai-prompt-textarea')).toHaveValue(/AWS/);

    await page.getByTestId('doc-nav-skill').click();
    await expect(page.getByTestId('doc-skill-commands').locator('.doc-command')).toHaveCount(2);

    // In a narrow split pane, pages reflow instead of scrolling sideways.
    await page.setViewportSize({ width: 600, height: 800 });
    for (const pageId of ['overview', 'animate', 'diagnostics', 'skill']) {
      await page.getByTestId(`doc-nav-${pageId}`).click();
      const overflow = await dialog
        .locator('.doc-content')
        .evaluate((el) => el.scrollWidth - el.clientWidth);
      expect(overflow).toBeLessThanOrEqual(0);
    }

    await page.getByTestId('help-close-btn').click();
    await expect(dialog.locator('.dav-node')).toHaveCount(0);

    // Narrow split-pane viewport (600px wide): toolbar wraps cleanly without horizontal overflow
    await page.setViewportSize({ width: 600, height: 800 });
    const toolbarOverflow = await page.locator('header.toolbar').evaluate((el) => ({
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
    }));
    expect(toolbarOverflow.scrollWidth).toBeLessThanOrEqual(toolbarOverflow.clientWidth);
    await expect(page.locator('header.toolbar [data-testid="btn-play"]')).toBeVisible();
    await expect(page.getByTestId('btn-export')).toBeVisible();
    // The open menu stays inside the narrow pane
    await page.getByTestId('btn-export').click();
    const menuBox = await page.getByRole('menu').boundingBox();
    expect(menuBox).not.toBeNull();
    if (menuBox) {
      expect(menuBox.x).toBeGreaterThanOrEqual(0);
      expect(menuBox.x + menuBox.width).toBeLessThanOrEqual(600);
    }
    await page.keyboard.press('Escape');

    expect(errors).toEqual([]);
  });
});

test('documentation stays open, keeps focus, and reports clipboard failures', async ({ page }) => {
  await openWebview(page);
  await expect(page.locator('.dav-node')).not.toHaveCount(0);
  await page.getByTestId('btn-open-help').click();
  const dialog = page.getByTestId('help-dialog');

  const nav = page.getByTestId('doc-nav-nodes');
  await nav.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('doc-nav-nodes')).toBeFocused();

  // A drag from the page that ends on the backdrop is not a click on the backdrop.
  const heading = await dialog.locator('h1').boundingBox();
  await page.mouse.move((heading?.x ?? 0) + 2, (heading?.y ?? 0) + 2);
  await page.mouse.down();
  await page.mouse.move(2, 2);
  await page.mouse.up();
  await expect(dialog).toBeVisible();

  await page.evaluate(() => {
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: () => Promise.reject(new Error('denied')) },
    });
  });
  await page.getByTestId('doc-nav-overview').click();
  const copy = dialog.locator('.doc-copy').first();
  await copy.click();
  await expect(copy).toHaveText('Copy failed');

  await page.mouse.click(2, 2);
  await expect(dialog).toBeHidden();
});

test('documentation examples keep the source where the reader scrolled it', async ({ page }) => {
  await openWebview(page);
  await expect(page.locator('.dav-node')).not.toHaveCount(0);
  await page.getByTestId('btn-open-help').click();
  const figure = page.getByTestId('doc-figure').first();
  const code = figure.locator('.doc-code');
  const scrollTop = () => code.evaluate((el) => el.scrollTop);

  // Changing steps brings the step into view.
  await figure.locator('.dav-tick').nth(1).click();
  await expect.poll(scrollTop).toBeGreaterThan(0);

  // Repeating the same step (one phase plus the hold) must not move it back.
  await code.evaluate((el) => {
    el.scrollTop = 0;
  });
  await page.waitForTimeout(4200);
  expect(await scrollTop()).toBe(0);
});
