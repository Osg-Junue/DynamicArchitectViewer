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

test.describe('authoring canvas & inspector (M3)', () => {
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

  test('edits elements via canvas selection, drag, inspector, and undo/redo', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto('/');
    const input = page.locator('textarea.dsl-input');
    await input.fill(
      '// Preserved header comment\ndav 1\ntitle "Edit Test"\nnode web "Web"\nnode db "DB"\nweb --> db\n',
    );

    // Select node `web` on the canvas
    const webNode = page.locator('.dav-node[data-id="web"]');
    await webNode.click();
    await expect(page.locator('.editor-selection-box[data-selected-id="web"]')).toBeVisible();
    await expect(page.getByTestId('element-inspector')).toBeVisible();

    // Edit label and badge via ElementInspector
    await page.getByTestId('inspector-label-input').fill('Frontend Web');
    await page.getByTestId('inspector-badge-input').fill('v2');
    await expect(input).toHaveValue(/node web "Frontend Web"/);
    await expect(input).toHaveValue(/badge: "v2"/);
    // Comment is preserved
    await expect(input).toHaveValue(/\/\/ Preserved header comment/);

    // Drag node `web` on canvas -> writes @pos(...)
    const box = await webNode.boundingBox();
    expect(box).not.toBeNull();
    if (box) {
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width / 2 + 80, box.y + box.height / 2 + 40, { steps: 4 });
      await page.mouse.up();
    }
    await expect(input).toHaveValue(/@pos\(/);

    // Undo reverts the drag placement, Redo restores it
    await page.getByTestId('btn-undo').click();
    await expect(input).not.toHaveValue(/@pos\(/);
    await page.getByTestId('btn-redo').click();
    await expect(input).toHaveValue(/@pos\(/);

    // Add a new node via toolbar button
    await page.getByTestId('btn-add-node').click();
    await expect(page.locator('.dav-node')).toHaveCount(3);

    expect(errors).toEqual([]);
  });

  test('supports multi-selection alignment and step inspector editing', async ({ page }) => {
    await page.goto('/');
    const input = page.locator('textarea.dsl-input');
    await input.fill(
      'dav 1\ntitle "Multi"\nnode a "A" @pos(40, 40)\nnode b "B" @pos(240, 140)\na --> b\n',
    );

    await page.locator('.dav-node[data-id="a"]').click();
    await page.locator('.dav-node[data-id="b"]').click({ modifiers: ['Shift'] });
    await expect(page.getByTestId('multi-inspector')).toBeVisible();
    await page.getByTestId('align-left').click();
    await expect(input).toHaveValue(/node b "B" @pos\(40, 140\)/);

    // Switch to Steps tab, add a step, and add an animation
    await page.getByTestId('tab-steps').click();
    await page.getByTestId('btn-add-step').click();
    await expect(input).toHaveValue(/step "Step 1"/);

    await page.getByTestId('new-anim-label').fill('Ping');
    await page.getByTestId('btn-add-anim').click();
    await expect(input).toHaveValue(/animate a --> b : "Ping"/);
  });

  test('communicates with VS Code Extension Host via acquireVsCodeApi protocol', async ({
    page,
  }) => {
    await page.addInitScript(() => {
      const posted: unknown[] = [];
      (window as unknown as { __postedMessages: unknown[] }).__postedMessages = posted;
      window.acquireVsCodeApi = () => ({
        postMessage(msg: unknown) {
          posted.push(msg);
        },
        getState() {
          return undefined;
        },
        setState() {},
      });
    });

    await page.goto('/');
    // Webview sends `{ type: 'ready' }` on startup
    const postedReady = await page.evaluate(
      () => (window as unknown as { __postedMessages: Array<{ type: string }> }).__postedMessages,
    );
    expect(postedReady.some((m) => m.type === 'ready')).toBe(true);

    // Simulate Extension Host sending `docChanged`
    await page.evaluate(() => {
      window.postMessage(
        {
          type: 'docChanged',
          dsl: 'dav 1\ntitle "From VS Code"\nnode api "API"\nnode db "DB"\napi --> db\n',
        },
        '*',
      );
    });
    await expect(page.locator('.dav-title')).toHaveText('From VS Code');
    await expect(page.locator('.dav-node')).toHaveCount(2);

    // Edit via Webview Inspector -> posts `updateDsl` back to Extension Host
    await page.locator('.dav-node[data-id="api"]').click();
    await page.getByTestId('inspector-label-input').fill('Gateway API');

    const lastUpdate = await page.evaluate(() => {
      const msgs = (
        window as unknown as { __postedMessages: Array<{ type: string; dsl?: string }> }
      ).__postedMessages;
      return msgs.filter((m) => m.type === 'updateDsl').pop();
    });
    expect(lastUpdate?.dsl).toContain('node api "Gateway API"');
  });

  test('opens AI Prompt & DSL Reference modal and toggles JA/EN locale (M4)', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto('/');

    // Toggle locale between EN and JA
    const localeBtn = page.getByTestId('btn-locale-toggle');
    const initialLocale = await localeBtn.textContent();
    await localeBtn.click();
    const nextLocale = await localeBtn.textContent();
    expect(nextLocale).not.toBe(initialLocale);

    // Open AI Prompt & DSL Reference dialog
    await page.getByTestId('btn-open-help').click();
    await expect(page.getByTestId('help-dialog')).toBeVisible();
    await expect(page.getByTestId('ai-prompt-textarea')).toHaveValue(/dav 1/);

    // Include current DSL in prompt
    await page.getByTestId('chk-include-current-dsl').check();
    await expect(page.getByTestId('ai-prompt-textarea')).toHaveValue(/AWS/);

    // Switch to Reference tab and verify all 18 icons are shown
    await page.getByTestId('help-tab-ref').click();
    await expect(page.getByTestId('ref-icon-catalog').locator('.icon-card')).toHaveCount(18);

    await page.getByTestId('help-close-btn').click();
    expect(errors).toEqual([]);
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
