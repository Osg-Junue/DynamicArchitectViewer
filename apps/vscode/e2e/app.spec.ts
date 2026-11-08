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
  test('renders the sample diagram in the shared player with top step dropdown and playback controls', async ({
    page,
  }) => {
    const errors = watchErrors(page);
    await page.goto('/');
    await expect(page.locator('.dav-node')).not.toHaveCount(0);
    await expect(page.locator('.dav-title')).toHaveText(/AWS/);
    await expect(page.locator('.problems .ok')).toBeVisible();

    // Top toolbar has no brand title, Format button, Prev/Next, locale toggle, or DSL source button
    await expect(page.locator('.brand')).toHaveCount(0);
    await expect(page.locator('[data-testid="btn-format"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="btn-step-prev"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="btn-step-next"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="btn-locale-toggle"]')).toHaveCount(0);
    await expect(page.locator('.dav-topbar').getByRole('button', { name: 'DSL' })).toHaveCount(0);

    // Playback controls (Step dropdown, Play step, Play all steps, Speed) are mounted in the top toolbar
    const topStepSelect = page.locator('header.toolbar [data-testid="select-step"]');
    const topPlayBtn = page.locator('header.toolbar [data-testid="btn-play"]');
    const topPlayAllBtn = page.locator('header.toolbar [data-testid="btn-play-all"]');
    await expect(topStepSelect).toBeVisible();
    await expect(topPlayBtn).toBeVisible();
    await expect(topPlayAllBtn).toBeVisible();
    await expect(topPlayBtn).toHaveAttribute('aria-pressed', 'false');
    await expect(topPlayAllBtn).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('footer.dav-dock [data-testid="btn-play"]')).toHaveCount(0);

    // Zoom percentage, icon Fit button, and Follow Animation icon button are mounted inside the diagram canvas viewport corner
    await expect(
      page.locator('main.dav-viewport [data-testid="canvas-zoom-controls"]'),
    ).toBeVisible();
    await expect(
      page.locator('header.dav-topbar [data-testid="canvas-zoom-controls"]'),
    ).toHaveCount(0);
    const fitBtn = page.locator('main.dav-viewport [data-testid="btn-zoom-fit"]');
    const followBtn = page.locator('main.dav-viewport [data-testid="btn-follow-anim"]');
    await expect(fitBtn.locator('svg')).toBeVisible();
    await expect(followBtn.locator('svg')).toBeVisible();
    await expect(followBtn).toHaveAttribute('aria-pressed', 'false');

    // Toggling Follow Animation focuses (zooms/pans) onto the active animation and Fit resets it
    const initialTransform = await page.locator('.dav-world').getAttribute('transform');
    await followBtn.click();
    await expect(followBtn).toHaveAttribute('aria-pressed', 'true');
    const focusedTransform = await page.locator('.dav-world').getAttribute('transform');
    expect(focusedTransform).not.toBe(initialTransform);
    await fitBtn.click();
    await expect(followBtn).toHaveAttribute('aria-pressed', 'false');
    expect(await page.locator('.dav-world').getAttribute('transform')).toBe(initialTransform);

    // Step narrative (title + description) is mounted in the top header above the canvas viewport (no bottom footer or keyboard hint)
    await expect(page.locator('footer.dav-dock')).toHaveCount(0);
    await expect(page.locator('.dav-hint')).toHaveCount(0);
    await expect(page.getByTestId('btn-open-help').locator('svg')).toBeVisible();
    await expect(page.getByTestId('btn-open-help')).toHaveText('');
    await expect(page.locator('header.dav-topbar .dav-dock .dav-step-title')).toContainText(
      'Step 1 / 4',
    );
    await expect(page.getByTestId('dock-anim-list')).toHaveCount(0);
    await expect(page.locator('.dav-packet .dav-packet-callout')).toHaveCount(1);
    await expect(page.locator('.dav-packet .dav-packet-label')).toHaveText('GET /products');
    await expect(page.locator('.dav-packet .dav-packet-desc').first()).toContainText('CloudFront');

    // Dashed halo boxes only outline the current phase's A -> B endpoints (client & cdn), hiding C/D (waf & alb)
    await expect(page.locator('.dav-node[data-id="client"] .dav-halo')).not.toHaveAttribute(
      'hidden',
    );
    await expect(page.locator('.dav-node[data-id="cdn"] .dav-halo')).not.toHaveAttribute('hidden');
    await expect(page.locator('.dav-node[data-id="waf"] .dav-halo')).toHaveAttribute('hidden', '');
    await expect(page.locator('.dav-node[data-id="alb"] .dav-halo')).toHaveAttribute('hidden', '');

    // Clicking a node on the canvas repeats that node's animation phase and shifts the dashed halo boxes to B & C
    await page.locator('.dav-node[data-id="waf"]').click();
    await expect(page.locator('.dav-packet .dav-packet-label')).toHaveText('Pass ACL');
    await expect(page.locator('.dav-node[data-id="waf"] .dav-halo')).not.toHaveAttribute('hidden');
    await expect(page.locator('.dav-node[data-id="alb"] .dav-halo')).not.toHaveAttribute('hidden');
    await expect(page.locator('.dav-node[data-id="client"] .dav-halo')).toHaveAttribute(
      'hidden',
      '',
    );
    await expect(page.locator('.dav-node[data-id="cdn"] .dav-halo')).toHaveAttribute('hidden', '');

    await topStepSelect.selectOption('2');
    await expect(page.locator('.dav-step-title')).toContainText('Step 3 / 4');
    await expect(page.locator('.dav-packet .dav-packet-label').first()).toHaveText(
      'INSERT INTO orders',
    );
    await expect(page.locator('.dav-packet .dav-packet-desc').first()).toBeVisible();

    // Toggle Play step (single triangle) and Play all steps (double triangle) from top toolbar
    await expect(topPlayBtn).toHaveText('');
    await expect(topPlayBtn.locator('svg polygon')).toHaveCount(1);
    await expect(topPlayBtn).toHaveAttribute('aria-label', 'Play step');
    await expect(topPlayAllBtn).toHaveText('');
    await expect(topPlayAllBtn.locator('svg polygon')).toHaveCount(2);
    await expect(topPlayAllBtn).toHaveAttribute('aria-label', 'Play all steps');

    await topPlayBtn.click();
    await expect(topPlayBtn).toHaveAttribute('aria-pressed', 'true');
    await expect(topPlayBtn).toHaveAttribute('aria-label', 'Pause');
    await expect(topPlayAllBtn).toHaveAttribute('aria-pressed', 'false');

    await topPlayAllBtn.click();
    await expect(topPlayAllBtn).toHaveAttribute('aria-pressed', 'true');
    await expect(topPlayAllBtn).toHaveAttribute('aria-label', 'Pause');
    await expect(topPlayBtn).toHaveAttribute('aria-pressed', 'false');
    await expect(topPlayBtn).toHaveAttribute('aria-label', 'Play step');

    await topPlayAllBtn.click();
    await expect(topPlayAllBtn).toHaveAttribute('aria-pressed', 'false');
    await expect(topPlayAllBtn).toHaveAttribute('aria-label', 'Play all steps');

    // Global keyboard shortcuts work from document.body and sync the top step dropdown
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('.dav-step-title')).toContainText('Step 4 / 4');
    await expect(topStepSelect).toHaveValue('3');
    await page.keyboard.press('Alt+ArrowLeft');
    await expect(page.locator('.dav-step-title')).toContainText('Step 4 / 4');
    await page.keyboard.press('Home');
    await expect(topStepSelect).toHaveValue('overview');
    await expect(page.locator('.dav-step-title')).toHaveText('Overview');

    expect(errors).toEqual([]);
  });

  test('updates the preview and reports diagnostics on DSL edits', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto('/');
    const input = page.locator('textarea.dsl-input');
    await input.fill('dav 1\ntitle "Typed"\nnode a [icon: databse]\nnode b\na --> b');
    await expect(page.locator('.dav-title')).toHaveText('Typed');
    await expect(page.locator('.dav-node')).toHaveCount(2);
    await expect(page.locator('.problems .error')).toContainText('database');

    // Diagram with 0 steps disables playback transport controls and keeps play buttons unpressed
    await expect(page.getByTestId('btn-play')).toBeDisabled();
    await expect(page.getByTestId('btn-play')).toHaveAttribute('aria-pressed', 'false');
    await expect(page.getByTestId('btn-play-all')).toBeDisabled();
    await expect(page.getByTestId('btn-play-all')).toHaveAttribute('aria-pressed', 'false');
    await expect(page.getByTestId('select-speed')).toBeDisabled();
    await expect(page.getByTestId('select-step')).toHaveValue('overview');

    // Fix typo
    await input.fill(
      'dav 1\ntitle "Clean"\ngroup g {\n  node a "A" [icon: database]\n  node b\n}\na --> b\n',
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

    // Simulate Extension Host sending `cursorMoved` inside `step "S2"` -> switches player and top dropdown to step 2
    const s2Offset = dsl.indexOf('focus db') + 2;
    await page.evaluate((offset) => {
      window.postMessage({ type: 'cursorMoved', offset }, '*');
    }, s2Offset);
    await expect(page.locator('.dav-step-title')).toContainText('Step 2 / 2');
    await expect(page.getByTestId('select-step')).toHaveValue('1');

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

    // Export HTML button posts `exportHtml` to Extension Host
    await page.getByTestId('btn-export-html').click();
    const exportMsg = await page.evaluate(() => {
      const msgs = (window as unknown as { __postedMessages: Array<{ type: string }> })
        .__postedMessages;
      return msgs.some((m) => m.type === 'exportHtml');
    });
    expect(exportMsg).toBe(true);
  });

  test('opens AI Prompt & DSL Reference modal and wraps cleanly on narrow viewports', async ({
    page,
  }) => {
    const errors = watchErrors(page);
    await page.goto('/');

    // Open AI Prompt & DSL Reference dialog (English UI)
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
    await expect(viewer.getByTestId('select-step').locator('option')).toHaveCount(5);
    await expect(viewer.locator('.dav-step-title')).toContainText('Step 1 / 4');
    await expect(viewer.locator('header.dav-topbar [data-testid="btn-play"]')).toBeVisible();
    await expect(viewer.locator('footer.dav-dock [data-testid="btn-play"]')).toHaveCount(0);
    await expect(viewer.locator('.dav-topbar').getByRole('button', { name: 'DSL' })).toHaveCount(0);

    // Packets animate along paths.
    await expect(viewer.locator('.dav-packet')).not.toHaveCount(0);

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
    await expect(viewer.getByTestId('btn-play')).toHaveAttribute('aria-pressed', 'false');
    const before = await viewer.locator('.dav-packet-dot').first().getAttribute('transform');
    await viewer.waitForTimeout(600);
    expect(await viewer.locator('.dav-packet-dot').first().getAttribute('transform')).toBe(before);
    await context.close();
  });
});
