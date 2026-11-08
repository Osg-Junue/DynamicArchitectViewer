import { writeFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { expect, type Page, test } from '@playwright/test';
import { createServer } from 'vite';
import { DEFAULT_SAMPLE } from '../src/samples';

interface PostedMessage {
  type: string;
  from?: number;
}

/** Loads the webview the way the extension does: it reports `ready` and receives the document. */
async function openWebview(page: Page, dsl: string = DEFAULT_SAMPLE.dsl): Promise<void> {
  await page.addInitScript((text) => {
    const posted: PostedMessage[] = [];
    (window as unknown as { __posted: PostedMessage[] }).__posted = posted;
    window.acquireVsCodeApi = () => ({
      postMessage(message) {
        posted.push(message);
        if (message.type === 'ready') window.postMessage({ type: 'docChanged', dsl: text }, '*');
      },
    });
  }, dsl);
  await page.goto('/');
}

function postedMessages(page: Page): Promise<PostedMessage[]> {
  return page.evaluate(() => (window as unknown as { __posted: PostedMessage[] }).__posted);
}

function sendDsl(page: Page, dsl: string): Promise<void> {
  return page.evaluate((text) => window.postMessage({ type: 'docChanged', dsl: text }, '*'), dsl);
}

function sendCursor(page: Page, offset: number): Promise<void> {
  return page.evaluate(
    (value) => window.postMessage({ type: 'cursorMoved', offset: value }, '*'),
    offset,
  );
}

type ExporterModule = typeof import('../src/exporter');
let exporter: Promise<ExporterModule> | undefined;

/** The exporter uses Vite-only `?raw` imports, so it is loaded through Vite. */
async function loadExporter(): Promise<ExporterModule> {
  const server = await createServer({
    root: fileURLToPath(new URL('..', import.meta.url)),
    appType: 'custom',
    logLevel: 'silent',
    server: { middlewareMode: true, hmr: false, watch: null },
  });
  const module = (await server.ssrLoadModule('/src/exporter/index.ts')) as ExporterModule;
  await server.close();
  return module;
}

async function writeExport(file: string, dsl: string = DEFAULT_SAMPLE.dsl): Promise<void> {
  exporter ??= loadExporter();
  await writeFile(file, await (await exporter).exportHtml(dsl, { locale: 'en' }));
}

/** Collects console errors, page errors and CSP violations. */
function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(`console: ${msg.text()}`);
  });
  return errors;
}

test.describe('webview preview', () => {
  test('renders the sample diagram in the shared player with top step dropdown and playback controls', async ({
    page,
  }) => {
    const errors = watchErrors(page);
    await openWebview(page);
    await expect(page.locator('.dav-node')).not.toHaveCount(0);
    await expect(page.locator('.dav-title')).toHaveText(/AWS/);

    // Playback controls (Step dropdown, Play step, Play all steps, Speed) are mounted in the top toolbar
    const topStepSelect = page.locator('header.toolbar [data-testid="select-step"]');
    const topPlayBtn = page.locator('header.toolbar [data-testid="btn-play"]');
    const topPlayAllBtn = page.locator('header.toolbar [data-testid="btn-play-all"]');
    await expect(topStepSelect).toBeVisible();
    await expect(topPlayBtn).toBeVisible();
    await expect(topPlayAllBtn).toBeVisible();
    await expect(topPlayBtn).toHaveAttribute('aria-pressed', 'false');
    await expect(topPlayAllBtn).toHaveAttribute('aria-pressed', 'false');

    // Zoom percentage, icon Fit button, and Follow Animation icon button are mounted inside the diagram canvas viewport corner
    await expect(
      page.locator('main.dav-viewport [data-testid="canvas-zoom-controls"]'),
    ).toBeVisible();
    const fitBtn = page.locator('main.dav-viewport [data-testid="btn-zoom-fit"]');
    const followBtn = page.locator('main.dav-viewport [data-testid="btn-follow-anim"]');
    await expect(fitBtn.locator('svg')).toBeVisible();
    await expect(followBtn.locator('svg')).toBeVisible();
    await expect(followBtn).toHaveAttribute('aria-pressed', 'false');

    // Steps open framed on their focus. Follow Animation zooms onto the active animation,
    // and Fit leaves follow mode and zooms out to the whole diagram.
    const scaleOf = (transform: string | null) =>
      Number(/scale\(([\d.]+)\)/.exec(transform ?? '')?.[1]);
    const initialTransform = await page.locator('.dav-world').getAttribute('transform');
    await followBtn.click();
    await expect(followBtn).toHaveAttribute('aria-pressed', 'true');
    const focusedTransform = await page.locator('.dav-world').getAttribute('transform');
    expect(focusedTransform).not.toBe(initialTransform);
    await fitBtn.click();
    await expect(followBtn).toHaveAttribute('aria-pressed', 'false');
    expect(scaleOf(await page.locator('.dav-world').getAttribute('transform'))).toBeLessThan(
      scaleOf(initialTransform),
    );

    // Step narrative (title + description) is mounted in the top header above the canvas viewport
    await expect(page.getByTestId('btn-open-help').locator('svg')).toBeVisible();
    await expect(page.getByTestId('btn-open-help')).toHaveText('');
    await expect(page.locator('header.dav-topbar .dav-dock .dav-step-title')).toContainText(
      'Step 1 / 4',
    );
    await expect(page.locator('.dav-packet .dav-packet-callout')).toHaveCount(1);
    await expect(page.locator('.dav-packet .dav-packet-label')).toHaveText('GET /products');
    await expect(page.locator('.dav-packet .dav-packet-desc').first()).toContainText('CloudFront');

    // Clicking a node on the canvas repeats that node's animation phase
    await page.locator('.dav-node[data-id="waf"]').click();
    await expect(page.locator('.dav-packet .dav-packet-label')).toHaveText('Pass ACL');

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

  test('updates the preview when the document changes', async ({ page }) => {
    const errors = watchErrors(page);
    await openWebview(page);
    await expect(page.locator('.dav-node')).not.toHaveCount(0);
    await sendDsl(page, 'dav 1\ntitle "Typed"\nnode a [icon: databse]\nnode b\na --> b');
    await expect(page.locator('.dav-title')).toHaveText('Typed');
    await expect(page.locator('.dav-node')).toHaveCount(2);

    // Diagram with 0 steps disables playback transport controls and keeps play buttons unpressed
    await expect(page.getByTestId('btn-play')).toBeDisabled();
    await expect(page.getByTestId('btn-play')).toHaveAttribute('aria-pressed', 'false');
    await expect(page.getByTestId('btn-play-all')).toBeDisabled();
    await expect(page.getByTestId('btn-play-all')).toHaveAttribute('aria-pressed', 'false');
    await expect(page.getByTestId('select-speed')).toBeDisabled();
    await expect(page.getByTestId('select-step')).toHaveValue('overview');

    await sendDsl(
      page,
      'dav 1\ntitle "Clean"\ngroup g {\n  node a "A" [icon: database]\n  node b\n}\na --> b\n',
    );
    await expect(page.locator('.dav-title')).toHaveText('Clean');
    await expect(page.locator('.dav-group[data-id="g"]')).not.toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test('adapts color names to the theme', async ({ page }) => {
    await openWebview(page, 'dav 1\nnode named "N" [color: yellow]\n');
    const strokeOf = (id: string) =>
      page
        .locator(`.dav-node[data-id="${id}"] .dav-station`)
        .evaluate((el) => getComputedStyle(el).stroke);

    await page.emulateMedia({ colorScheme: 'dark' });
    const darkNamed = await strokeOf('named');

    await page.emulateMedia({ colorScheme: 'light' });
    expect(await strokeOf('named')).not.toBe(darkNamed);
  });

  test('communicates with VS Code Extension Host via acquireVsCodeApi protocol', async ({
    page,
  }) => {
    const dsl =
      'dav 1\ntitle "From VS Code"\nnode api "API"\nnode db "DB"\napi --> db\nstep "S1" {\n  focus api\n}\nstep "S2" {\n  focus db\n}\n';
    await openWebview(page, dsl);
    expect((await postedMessages(page)).some((m) => m.type === 'ready')).toBe(true);

    await expect(page.locator('.dav-title')).toHaveText('From VS Code');
    await expect(page.locator('.dav-node')).toHaveCount(2);

    // Simulate Extension Host sending `cursorMoved` on `node api` -> highlights node
    const apiOffset = dsl.indexOf('node api') + 5;
    await sendCursor(page, apiOffset);
    await expect(page.locator('.editor-cursor-highlight')).toHaveCount(1);

    // Simulate Extension Host sending `cursorMoved` inside `step "S2"` -> switches player and top dropdown to step 2
    const s2Offset = dsl.indexOf('focus db') + 2;
    await sendCursor(page, s2Offset);
    await expect(page.locator('.dav-step-title')).toContainText('Step 2 / 2');
    await expect(page.getByTestId('select-step')).toHaveValue('1');

    // A cursor move within the same step must not rebuild the scene (which restarts animations)
    await page.locator('.dav-scene').evaluate((el) => el.setAttribute('data-marker', 'kept'));
    await sendCursor(page, s2Offset + 1);
    await page.waitForTimeout(50);
    await expect(page.locator('.dav-scene')).toHaveAttribute('data-marker', 'kept');

    // Double-clicking a canvas node posts `revealRange` to Extension Host
    await page.locator('.dav-node[data-id="api"]').dblclick();
    const revealMsg = (await postedMessages(page)).filter((m) => m.type === 'revealRange').pop();
    expect(revealMsg?.from).toBe(dsl.indexOf('node api "API"'));

    // Export HTML button posts `exportHtml` to Extension Host
    await page.getByTestId('btn-export-html').click();
    const exportMsg = (await postedMessages(page)).some((m) => m.type === 'exportHtml');
    expect(exportMsg).toBe(true);
  });

  test('opens the documentation and wraps cleanly on narrow viewports', async ({ page }) => {
    const errors = watchErrors(page);
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
    await expect(dialog.getByTestId('btn-play-all')).toBeHidden();
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
    await expect(icons).toHaveCount(18);
    await expect(icons.first().locator('.dav-station')).toHaveCount(1);
    await page.getByTestId('doc-icon-search').fill('database');
    await expect(icons).toHaveCount(1);

    // Animation pages show the phases of the running step.
    await page.getByTestId('doc-nav-animate').click();
    await expect(page.getByTestId('doc-figure')).toHaveCount(5);
    await expect(page.getByTestId('doc-phase-strip').first().locator('.doc-phase')).toHaveCount(3);
    await expect(page.locator('.doc-phase.is-active').first()).toBeVisible();

    // State shows accumulated values, including the reset in the last step.
    await page.getByTestId('doc-nav-state').click();
    await expect(page.getByTestId('doc-state-matrix').locator('tbody tr')).not.toHaveCount(0);

    await page.getByTestId('doc-nav-diagnostics').click();
    await expect(page.getByTestId('doc-diagnostics').locator('tbody tr')).toHaveCount(18);

    await page.getByTestId('doc-locale-ja').click();
    await expect(page.getByTestId('doc-nav-diagnostics')).toHaveText('診断メッセージ');
    await page.getByTestId('doc-locale-en').click();

    await page.getByTestId('doc-nav-prompt').click();
    await expect(page.getByTestId('ai-prompt-textarea')).toHaveValue(/dav 1/);
    await page.getByTestId('chk-include-current-dsl').check();
    await expect(page.getByTestId('ai-prompt-textarea')).toHaveValue(/AWS/);

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
    await expect(page.getByTestId('btn-export-html')).toBeVisible();

    expect(errors).toEqual([]);
  });
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

  test('honors prefers-reduced-motion', async ({ browser }, info) => {
    const context = await browser.newContext({ reducedMotion: 'reduce' });
    const file = info.outputPath('reduced.html');
    await writeExport(file);
    const viewer = await context.newPage();
    await viewer.goto(pathToFileURL(file).href);
    await expect(viewer.getByTestId('btn-play')).toHaveAttribute('aria-pressed', 'false');
    const before = await viewer.locator('.dav-packet-dot').first().getAttribute('transform');
    await viewer.waitForTimeout(600);
    expect(await viewer.locator('.dav-packet-dot').first().getAttribute('transform')).toBe(before);
    await context.close();
  });
});
