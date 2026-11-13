import { expect, test } from '@playwright/test';
import { openWebview, postedMessages, sendDsl, watchErrors } from './helpers';

test.describe('the export menu', () => {
  test('exports single-step animated SVGs only when the step resolves motion', async ({ page }) => {
    const errors = watchErrors(page);
    const dsl = [
      'dav 1',
      'title "Step Motion"',
      'group zone "Zone" {',
      '  node api "API"',
      '  node db "DB"',
      '}',
      'api --> db : "SQL"',
      'step "Idle" {',
      '  focus api',
      '}',
      'step "Active flow" {',
      '  animate api --> db : "SELECT 1"',
      '}',
      'step "Missing endpoint" {',
      '  animate api --> ghost : "Noop"',
      '}',
      'step "Group endpoint" {',
      '  animate api --> zone : "Noop"',
      '}',
      '',
    ].join('\n');

    await openWebview(page, dsl);
    const stepSelect = page.getByTestId('select-step');
    const exportBtn = page.getByTestId('btn-export');

    // Step 2 resolves real motion: single-step animated SVG options are enabled and post step: 1
    await stepSelect.selectOption('1');
    await expect(page.locator('.dav-step-title')).toContainText('Step 2 / 4');

    await exportBtn.click();
    await page.getByTestId('export-scope-step').click();
    await expect(page.getByTestId('export-scope-step')).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByTestId('export-svg-animated')).toBeEnabled();
    await expect(page.getByTestId('export-svg-whole')).toBeEnabled();
    await page.getByTestId('export-svg-animated').click();

    await exportBtn.click();
    await expect(page.getByTestId('export-scope-step')).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByTestId('export-svg-whole')).toBeEnabled();
    await page.getByTestId('export-svg-whole').click();

    const svgMessages = (await postedMessages(page)).filter((m) => m.type === 'exportSvg');
    expect(svgMessages).toEqual([
      { type: 'exportSvg', animate: true, camera: 'follow', step: 1, dsl },
      { type: 'exportSvg', animate: true, camera: 'whole', step: 1, dsl },
    ]);

    // Undeclared node or group endpoints resolve 0 phases, keeping animated items disabled
    for (const stepValue of ['2', '3']) {
      await stepSelect.selectOption(stepValue);
      await exportBtn.click();
      await page.getByTestId('export-scope-step').click();
      await expect(page.getByTestId('export-svg-animated')).toBeDisabled();
      await expect(page.getByTestId('export-svg-whole')).toBeDisabled();
      await page.keyboard.press('Escape');
    }

    expect(errors).toEqual([]);
  });

  test('keeps the export menu inside a narrow 420x600 split-pane when the toolbar wraps', async ({
    page,
  }) => {
    const errors = watchErrors(page);
    await page.setViewportSize({ width: 420, height: 600 });
    await openWebview(page);
    await expect(page.locator('.dav-node')).not.toHaveCount(0);
    await expect(page.locator('.dav-step-title')).toContainText('Step 1 / 4');

    const docScrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(docScrollWidth).toBeLessThanOrEqual(420);

    const leftBox = await page.locator('.toolbar-left').boundingBox();
    const rightBox = await page.locator('.toolbar-right').boundingBox();
    const helpBox = await page.getByTestId('btn-open-help').boundingBox();
    expect(leftBox).not.toBeNull();
    expect(rightBox).not.toBeNull();
    expect(helpBox).not.toBeNull();
    if (leftBox && rightBox && helpBox) {
      expect(rightBox.y).toBeGreaterThan(leftBox.y);
      expect(helpBox.x + helpBox.width).toBeLessThanOrEqual(408);
    }

    await page.getByTestId('btn-export').click();
    await expect(page.getByTestId('export-scope-step')).toBeVisible();
    const listBox = await page.locator('.export-menu-list').boundingBox();
    expect(listBox).not.toBeNull();
    if (listBox) {
      expect(listBox.x).toBeGreaterThanOrEqual(12);
      expect(listBox.x + listBox.width).toBeLessThanOrEqual(408);
      expect(listBox.y + listBox.height).toBeLessThanOrEqual(600);
    }

    await page.keyboard.press('Escape');
    expect(errors).toEqual([]);
  });

  test('syncs export state across fatal syntax errors, contains arrow keys, and resets scope on step or URI change', async ({
    page,
  }) => {
    const errors = watchErrors(page);
    const validDsl = [
      'dav 1',
      'title "Valid"',
      'node api "API"',
      'node db "DB"',
      'api --> db',
      'step "One" {',
      '  animate api --> db : "Ping"',
      '}',
      'step "Two" {',
      '  animate db --> api : "Pong"',
      '}',
      '',
    ].join('\n');

    await openWebview(page, validDsl);
    await sendDsl(page, validDsl, 'file:///one.dav');
    const stepSelect = page.getByTestId('select-step');
    const exportBtn = page.getByTestId('btn-export');

    await stepSelect.selectOption('1');
    await expect(page.locator('.dav-step-title')).toContainText('Step 2 / 2');

    // ArrowLeft and ArrowRight inside the open menu do not leak to the underlying Player
    await exportBtn.click();
    await expect(page.getByRole('menu')).toBeVisible();
    await page.keyboard.press('ArrowLeft');
    await expect(page.locator('.dav-step-title')).toContainText('Step 2 / 2');
    await expect(stepSelect).toHaveValue('1');
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('.dav-step-title')).toContainText('Step 2 / 2');
    await expect(stepSelect).toHaveValue('1');

    // Scope stays on This step when reopened on the same step, and resets on another step
    await page.getByTestId('export-scope-step').click();
    await expect(page.getByTestId('export-scope-step')).toHaveAttribute('aria-checked', 'true');
    await page.keyboard.press('Escape');

    await exportBtn.click();
    await expect(page.getByTestId('export-scope-step')).toHaveAttribute('aria-checked', 'true');
    await page.keyboard.press('Escape');

    await stepSelect.selectOption('0');
    await expect(page.locator('.dav-step-title')).toContainText('Step 1 / 2');
    await exportBtn.click();
    await expect(page.getByTestId('export-scope-all')).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByTestId('export-scope-step')).toHaveAttribute('aria-checked', 'false');
    await page.keyboard.press('Escape');

    // A fatal syntax error keeps the last diagram on screen but blocks exporting, and closes the menu
    await stepSelect.selectOption('1');
    await expect(page.locator('.dav-step-title')).toContainText('Step 2 / 2');
    await exportBtn.click();
    await expect(page.getByRole('menu')).toBeVisible();
    await sendDsl(page, 'dav 1\n]', 'file:///one.dav');
    await expect(page.locator('.dav-node')).toHaveCount(2);
    await expect(page.locator('.dav-step-title')).toContainText('Step 2 / 2');
    await expect(page.getByRole('menu')).toBeHidden();
    await expect(exportBtn).toHaveAttribute('aria-disabled', 'true');
    await expect(exportBtn).toHaveAttribute('title', 'Fix the syntax error to export');
    // Playwright waits for an aria-disabled button to become enabled, so this click is forced.
    await exportBtn.click({ force: true });
    await exportBtn.focus();
    await page.keyboard.press('ArrowDown');
    await expect(page.getByRole('menu')).toBeHidden();
    expect((await postedMessages(page)).filter((m) => m.type.startsWith('export'))).toEqual([]);

    // Fixing the text makes exporting possible again
    await sendDsl(page, validDsl, 'file:///one.dav');
    await expect(exportBtn).not.toHaveAttribute('aria-disabled');
    await expect(exportBtn).not.toHaveAttribute('title');
    await expect(page.locator('.dav-step-title')).toContainText('Step 2 / 2');

    await exportBtn.click();
    await expect(page.getByTestId('export-scope-step')).toHaveText('This step: 2. Two');
    await page.getByTestId('export-scope-step').click();
    await page.getByTestId('export-svg-still').click();

    await exportBtn.click();
    await page.getByTestId('export-scope-all').click();
    await page.getByTestId('export-html').click();

    const exports = (await postedMessages(page)).filter((m) => m.type.startsWith('export'));
    expect(exports).toEqual([
      { type: 'exportSvg', animate: false, camera: 'follow', step: 1, dsl: validDsl },
      { type: 'exportHtml', dsl: validDsl },
    ]);

    // Switching to a new URI resets scope to All steps even when landing on the same step index
    await stepSelect.selectOption('0');
    await exportBtn.click();
    await page.getByTestId('export-scope-step').click();
    await expect(page.getByTestId('export-scope-step')).toHaveAttribute('aria-checked', 'true');
    await page.keyboard.press('Escape');

    await sendDsl(page, validDsl, 'file:///two.dav');
    await expect(page.locator('.dav-step-title')).toContainText('Step 1 / 2');
    await exportBtn.click();
    await expect(page.getByTestId('export-scope-all')).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByTestId('export-scope-step')).toHaveAttribute('aria-checked', 'false');
    await page.keyboard.press('Escape');

    expect(errors).toEqual([]);
  });

  test('keeps focus inside the menu on disabled clicks, places separator under menu, and supports High Contrast', async ({
    page,
  }) => {
    const errors = watchErrors(page);
    await openWebview(page);
    await expect(page.locator('.dav-step-title')).toContainText('Step 1 / 4');

    const exportBtn = page.getByTestId('btn-export');
    await exportBtn.focus();
    await page.keyboard.press('ArrowDown');
    await expect(page.getByRole('menu')).toBeVisible();

    // Separator is a direct child of role="menu" and visible while a step is active
    const separator = page.locator('[role="menu"] > [role="separator"]');
    await expect(separator).toHaveCount(1);
    await expect(separator).toBeVisible();

    // Keyboard :focus-visible outline is visible, and High Contrast radio dot uses 4px border
    const focusOutline = await page.getByTestId('export-scope-all').evaluate((el) => ({
      focusVisible: el.matches(':focus-visible'),
      outlineStyle: getComputedStyle(el).outlineStyle,
    }));
    expect(focusOutline.focusVisible).toBe(true);
    expect(focusOutline.outlineStyle).not.toBe('none');

    await page.emulateMedia({ forcedColors: 'active' });
    const radioBorderTop = await page
      .locator('.export-scope[aria-checked="true"]')
      .evaluate((el) => getComputedStyle(el, '::before').borderTopWidth);
    expect(radioBorderTop).toBe('4px');
    await page.emulateMedia({ forcedColors: 'none' });

    // Clicking disabled Standalone HTML or the separator keeps the menu open and focus inside it
    await page.getByTestId('export-scope-step').click();
    const htmlItem = page.getByTestId('export-html');
    await expect(htmlItem).toBeDisabled();

    for (const target of [htmlItem, separator]) {
      const box = await target.boundingBox();
      expect(box).not.toBeNull();
      if (box) {
        await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      }
      await expect(page.getByRole('menu')).toBeVisible();
      const focusState = await page.evaluate(() => {
        const menu = document.querySelector('[role="menu"]');
        const active = document.activeElement;
        return {
          insideMenu: Boolean(menu && active && menu.contains(active)),
          tagName: active?.tagName ?? null,
        };
      });
      expect(focusState.insideMenu).toBe(true);
      expect(focusState.tagName).not.toBe('BODY');
    }

    // On Overview, the separator is hidden along with the scope radios
    await page.keyboard.press('Escape');
    await page.getByTestId('select-step').selectOption('overview');
    await expect(page.locator('.dav-step-title')).toHaveText('Overview');
    await exportBtn.click();
    await expect(separator).toBeHidden();
    await page.keyboard.press('Escape');

    expect(errors).toEqual([]);
  });
});
