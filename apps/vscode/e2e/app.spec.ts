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

test.describe('code-only authoring & live preview', () => {
  test('renders the sample diagram in the shared player with top playback controls', async ({
    page,
  }) => {
    const errors = watchErrors(page);
    await page.goto('/');
    await expect(page.locator('.dav-node')).not.toHaveCount(0);
    await expect(page.locator('.dav-title')).toHaveText(/AWS/);
    await expect(page.locator('.problems .ok')).toBeVisible();

    // Playback controls (Play/Start, Prev, Next, Speed) are mounted in the top toolbar (Visual Studio style)
    const topPlayBtn = page.locator('header.toolbar [data-testid="btn-play"]');
    await expect(topPlayBtn).toBeVisible();
    await expect(topPlayBtn).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('footer.dav-dock [data-testid="btn-play"]')).toHaveCount(0);

    // Step navigation from the top toolbar
    await expect(page.locator('.dav-step-title')).toContainText('1 / 4');
    await page.locator('header.toolbar [data-testid="btn-step-next"]').click();
    await expect(page.locator('.dav-step-title')).toContainText('2 / 4');
    await page.locator('header.toolbar [data-testid="btn-step-prev"]').click();
    await expect(page.locator('.dav-step-title')).toContainText('1 / 4');

    // Toggle play/pause from top toolbar and verify accessible label/title updates
    const pausedLabel = await topPlayBtn.getAttribute('aria-label');
    await topPlayBtn.click();
    await expect(topPlayBtn).toHaveAttribute('aria-pressed', 'true');
    const playingLabel = await topPlayBtn.getAttribute('aria-label');
    expect(playingLabel).not.toBe(pausedLabel);
    await expect(topPlayBtn).toHaveAttribute('title', playingLabel ?? '');
    await topPlayBtn.click();
    await expect(topPlayBtn).toHaveAttribute('aria-pressed', 'false');
    await expect(topPlayBtn).toHaveAttribute('aria-label', pausedLabel ?? '');

    // Global keyboard shortcuts work from document.body without manual focus on .dav-app,
    // while modifier combinations (e.g. Alt+ArrowLeft) are ignored.
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('.dav-step-title')).toContainText('2 / 4');
    await page.keyboard.press('Alt+ArrowLeft');
    await expect(page.locator('.dav-step-title')).toContainText('2 / 4');
    await page.keyboard.press('Home');
    await expect(page.locator('.dav-pill[data-index="overview"]')).toHaveAttribute(
      'aria-selected',
      'true',
    );

    expect(errors).toEqual([]);
  });

  test('updates the preview, reports diagnostics, and formats DSL code', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto('/');
    const input = page.locator('textarea.dsl-input');
    await input.fill('dav 1\ntitle "Typed"\nnode a [icon: databse]\nnode b\na --> b');
    await expect(page.locator('.dav-title')).toHaveText('Typed');
    await expect(page.locator('.dav-node')).toHaveCount(2);
    await expect(page.locator('.problems .error')).toContainText('database');

    // Diagram with 0 steps disables playback transport controls and keeps play button unpressed
    await expect(page.getByTestId('btn-play')).toBeDisabled();
    await expect(page.getByTestId('btn-play')).toHaveAttribute('aria-pressed', 'false');
    await expect(page.getByTestId('btn-step-prev')).toBeDisabled();
    await expect(page.getByTestId('btn-step-next')).toBeDisabled();
    await expect(page.getByTestId('select-speed')).toBeDisabled();

    // Fix typo and format
    await input.fill(
      'dav   1\ntitle   "Formatted"\ngroup g{\nnode a "A"[icon:database]\nnode b\n}\na-->b\n',
    );
    await page.getByTestId('btn-format').click();
    await expect(input).toHaveValue(
      'dav 1\ntitle "Formatted"\ngroup g {\n  node a "A" [icon: database]\n  node b\n}\na --> b\n',
    );
    await expect(page.locator('.problems .ok')).toBeVisible();
    expect(errors).toEqual([]);
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
    const dsl =
      'dav 1\ntitle "From VS Code"\nnode api "API"\nnode db "DB"\napi --> db\nstep "S1" {\n  focus api\n}\nstep "S2" {\n  focus db\n}\n';
    await page.evaluate((text) => {
      window.postMessage(
        {
          type: 'docChanged',
          dsl: text,
        },
        '*',
      );
    }, dsl);
    await expect(page.locator('.dav-title')).toHaveText('From VS Code');
    await expect(page.locator('.dav-node')).toHaveCount(2);

    // Simulate Extension Host sending `cursorMoved` on `node api` -> highlights node
    const apiOffset = dsl.indexOf('node api') + 5;
    await page.evaluate((offset) => {
      window.postMessage({ type: 'cursorMoved', offset }, '*');
    }, apiOffset);
    await expect(page.locator('.editor-cursor-highlight')).toHaveCount(1);

    // Simulate Extension Host sending `cursorMoved` inside `step "S2"` -> switches player to step 2
    const s2Offset = dsl.indexOf('focus db') + 2;
    await page.evaluate((offset) => {
      window.postMessage({ type: 'cursorMoved', offset }, '*');
    }, s2Offset);
    await expect(page.locator('.dav-step-title')).toContainText('2 / 2');

    // Double-clicking a canvas node posts `revealRange` to Extension Host
    await page.locator('.dav-node[data-id="api"]').dblclick();
    const revealMsg = await page.evaluate(() => {
      const msgs = (
        window as unknown as {
          __postedMessages: Array<{ type: string; from?: number; to?: number }>;
        }
      ).__postedMessages;
      return msgs.filter((m) => m.type === 'revealRange').pop();
    });
    expect(revealMsg?.from).toBe(dsl.indexOf('node api "API"'));

    // Format button posts `formatDocument` to Extension Host
    await page.getByTestId('btn-format').click();
    const formatMsg = await page.evaluate(() => {
      const msgs = (window as unknown as { __postedMessages: Array<{ type: string }> })
        .__postedMessages;
      return msgs.some((m) => m.type === 'formatDocument');
    });
    expect(formatMsg).toBe(true);
  });

  test('opens AI Prompt & DSL Reference modal, preserves playback state across JA/EN locale toggle, and wraps cleanly on narrow viewports', async ({
    page,
  }) => {
    const errors = watchErrors(page);
    await page.goto('/');

    // Select Overview tab, toggle locale, and verify Overview tab remains selected
    await page.locator('.dav-pill[data-index="overview"]').click();
    await expect(page.locator('.dav-pill[data-index="overview"]')).toHaveAttribute(
      'aria-selected',
      'true',
    );
    const localeBtn = page.getByTestId('btn-locale-toggle');
    const initialLocale = await localeBtn.textContent();
    await localeBtn.click();
    const nextLocale = await localeBtn.textContent();
    expect(nextLocale).not.toBe(initialLocale);
    await expect(page.locator('.dav-pill[data-index="overview"]')).toHaveAttribute(
      'aria-selected',
      'true',
    );

    // Start playing at 2x speed, toggle locale back, and verify playing state & speed are preserved
    await page.getByTestId('select-speed').selectOption('2');
    await page.getByTestId('btn-play').click();
    await expect(page.getByTestId('btn-play')).toHaveAttribute('aria-pressed', 'true');
    await localeBtn.click();
    await expect(page.getByTestId('btn-play')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('select-speed')).toHaveValue('2');
    await page.getByTestId('btn-play').click();

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

    // Narrow split-pane viewport (600px wide): toolbar wraps cleanly without horizontal overflow
    await page.setViewportSize({ width: 600, height: 800 });
    const toolbarOverflow = await page.locator('header.toolbar').evaluate((el) => ({
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
    }));
    expect(toolbarOverflow.scrollWidth).toBeLessThanOrEqual(toolbarOverflow.clientWidth);
    await expect(page.locator('header.toolbar [data-testid="btn-play"]')).toBeVisible();
    await expect(page.getByTestId('btn-export-html')).toBeVisible();

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
    await expect(viewer.locator('header.dav-topbar [data-testid="btn-play"]')).toBeVisible();
    await expect(viewer.locator('footer.dav-dock [data-testid="btn-play"]')).toHaveCount(0);

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
