import { readFileSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { gzipSync } from 'node:zlib';
import { expect, type Page, test } from '@playwright/test';
import { createServer } from 'vite';
import type { SvgExportOptions } from '../src/exporter';
import { ICON_NAMES } from '../src/model/types';
import type { WebviewToHostMessage } from '../src/protocol/messages';

const DEFAULT_DSL = readFileSync(
  new URL('../../../examples/01-infra-ha-failover.dav', import.meta.url),
  'utf8',
);
const EVENT_DRIVEN_DSL = readFileSync(
  new URL('../../../examples/03-event-driven-async.dav', import.meta.url),
  'utf8',
);

/** Loads the webview the way the extension does: it reports `ready` and receives the document. */
async function openWebview(page: Page, dsl: string = DEFAULT_DSL): Promise<void> {
  await page.addInitScript((text) => {
    const posted: WebviewToHostMessage[] = [];
    (window as unknown as { __posted: WebviewToHostMessage[] }).__posted = posted;
    window.acquireVsCodeApi = () => ({
      postMessage(message) {
        posted.push(message);
        if (message.type === 'ready') window.postMessage({ type: 'docChanged', dsl: text }, '*');
      },
    });
  }, dsl);
  await page.goto('/');
}

function postedMessages(page: Page): Promise<WebviewToHostMessage[]> {
  return page.evaluate(() => (window as unknown as { __posted: WebviewToHostMessage[] }).__posted);
}

function sendDsl(page: Page, dsl: string, uri?: string): Promise<void> {
  return page.evaluate(
    ([text, nextUri]) =>
      window.postMessage(
        nextUri === undefined
          ? { type: 'docChanged', dsl: text }
          : { type: 'docChanged', dsl: text, uri: nextUri },
        '*',
      ),
    [dsl, uri] as const,
  );
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

async function writeExport(
  file: string,
  dsl: string = DEFAULT_DSL,
  locale: 'ja' | 'en' = 'en',
): Promise<void> {
  exporter ??= loadExporter();
  await writeFile(file, await (await exporter).exportHtml(dsl, { locale }));
}

async function writeSvgExport(
  file: string,
  dsl: string = DEFAULT_DSL,
  options?: SvgExportOptions,
): Promise<void> {
  exporter ??= loadExporter();
  await writeFile(file, (await exporter).exportSvg(dsl, options));
}

async function seekSvgTime(page: Page, seconds: number): Promise<void> {
  await page.evaluate(async (t) => {
    for (const svg of document.querySelectorAll('svg')) {
      svg.pauseAnimations();
      svg.setCurrentTime(t);
    }
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );
  }, seconds);
}

async function expectSvgLoadsInImg(page: Page, htmlPath: string, svgHref: string): Promise<void> {
  await writeFile(htmlPath, `<!doctype html><img id="diagram" src="${svgHref}" alt="diagram">`);
  await page.goto(pathToFileURL(htmlPath).href);
  await expect
    .poll(() =>
      page
        .locator('#diagram')
        .evaluate((img: HTMLImageElement) => (img.complete ? img.naturalWidth : 0)),
    )
    .toBe(960);
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
    await expect(page.locator('.dav-packet .dav-packet-desc').first()).toContainText(
      'The browser sends',
    );

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

    // The Export menu posts the picked format to Extension Host
    const exportBtn = page.getByTestId('btn-export');
    await exportBtn.click();
    await expect(exportBtn).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByRole('menuitem')).toHaveCount(4);
    // The range comes first: every step, or the one the preview shows
    await expect(page.getByTestId('export-scope-all')).toBeFocused();
    await expect(page.getByTestId('export-scope-all')).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByTestId('export-scope-step')).toHaveText('This step: 2. S2');
    await page.getByTestId('export-html').click();
    await expect(page.getByRole('menu')).toBeHidden();
    expect((await postedMessages(page)).some((m) => m.type === 'exportHtml')).toBe(true);

    // Keyboard: arrows move through the range and the formats, Enter picks one, Escape closes
    await exportBtn.focus();
    for (let i = 0; i < 4; i++) await page.keyboard.press('ArrowDown');
    await expect(page.getByTestId('export-svg-animated')).toBeFocused();
    await page.keyboard.press('Enter');
    await exportBtn.click();
    await page.getByTestId('export-svg-whole').click();

    // One step: picking it keeps the menu open, and S2 has nothing to animate or to make HTML of
    await exportBtn.click();
    await page.getByTestId('export-scope-step').click();
    await expect(page.getByTestId('export-scope-step')).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByRole('menu')).toBeVisible();
    await expect(page.getByTestId('export-html')).toBeDisabled();
    await expect(page.getByTestId('export-svg-animated')).toBeDisabled();
    await expect(page.getByTestId('export-svg-whole')).toBeDisabled();
    await page.keyboard.press('End');
    await page.keyboard.press('Enter');
    const svgMessages = (await postedMessages(page)).filter((m) => m.type === 'exportSvg');
    expect(svgMessages.map((m) => [m.animate, m.camera, m.step])).toEqual([
      [true, 'follow', null],
      [true, 'whole', null],
      [false, 'follow', 1],
    ]);
    // The range stays chosen while the same step shows
    await exportBtn.click();
    await expect(page.getByTestId('export-scope-step')).toHaveAttribute('aria-checked', 'true');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('menu')).toBeHidden();
    await expect(exportBtn).toBeFocused();
    await expect(page.locator('.dav-step-title')).toContainText('Step 2 / 2');

    // A click elsewhere closes it without exporting
    await exportBtn.click();
    await page.locator('.dav-viewport').click({ position: { x: 5, y: 5 } });
    await expect(page.getByRole('menu')).toBeHidden();
    expect((await postedMessages(page)).filter((m) => m.type.startsWith('export'))).toHaveLength(4);
  });

  for (const [lang, nav, close] of [
    ['ja', '診断メッセージ', '閉じる'],
    ['en', 'Diagnostics', 'Close'],
  ]) {
    test(`shows the documentation in the display language: ${lang}`, async ({ page }) => {
      // The extension host writes the VS Code display language into <html lang>.
      await page.route(/\/$/, async (route) => {
        const response = await route.fetch();
        const body = (await response.text()).replace(/<html[^>]*>/, `<html lang="${lang}">`);
        await route.fulfill({ response, body });
      });
      await openWebview(page);
      await page.getByTestId('btn-open-help').click();
      await expect(page.getByTestId('doc-nav-diagnostics')).toHaveText(nav as string);
      await expect(page.getByTestId('help-close-btn')).toHaveText(close as string);
    });
  }

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
    await expect(icons).toHaveCount(ICON_NAMES.length);
    await expect(icons.first().locator('.dav-station')).toHaveCount(1);
    await page.getByTestId('doc-icon-search').fill('database');
    await expect(icons).toHaveCount(1);

    // Animation pages show the phases of the running step.
    await page.getByTestId('doc-nav-animate').click();
    await expect(page.getByTestId('doc-figure')).toHaveCount(6);
    await expect(page.getByTestId('doc-phase-strip').first().locator('.doc-phase')).toHaveCount(3);
    await expect(page.locator('.doc-phase.is-active').first()).toBeVisible();

    // State shows accumulated values, including the reset in the last step.
    await page.getByTestId('doc-nav-state').click();
    const badgeRow = page.getByTestId('doc-state-matrix').locator('tbody tr').first();
    await expect(badgeRow.locator('th')).toHaveText('db.badge');
    await expect(badgeRow.locator('td').last()).toHaveText('—');

    await page.getByTestId('doc-nav-diagnostics').click();
    await expect(page.getByTestId('doc-diagnostics').locator('tbody tr')).toHaveCount(19);

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

test('follow mode keeps a single animation loop', async ({ page }) => {
  await page.addInitScript(() => {
    const original = window.requestAnimationFrame.bind(window);
    const counter = { callbacks: 0, uncounted: original };
    (window as unknown as { __raf: typeof counter }).__raf = counter;
    window.requestAnimationFrame = (callback) =>
      original((time) => {
        counter.callbacks++;
        callback(time);
      });
  });
  await openWebview(page);
  await expect(page.locator('.dav-node')).not.toHaveCount(0);
  await page.getByTestId('btn-follow-anim').click();
  await page.getByTestId('select-speed').selectOption('2');
  await page.locator('header.toolbar').getByTestId('btn-play').click();
  await page.waitForTimeout(4500);

  const perFrame = await page.evaluate(async () => {
    const counter = (
      window as unknown as {
        __raf: { callbacks: number; uncounted: typeof requestAnimationFrame };
      }
    ).__raf;
    const before = counter.callbacks;
    let frames = 0;
    await new Promise<void>((done) => {
      const step = () => {
        if (++frames === 30) done();
        else counter.uncounted(step);
      };
      counter.uncounted(step);
    });
    return (counter.callbacks - before) / frames;
  });
  expect(perFrame).toBeLessThan(1.5);
});

test('pause freezes the packet and play continues from the same place', async ({ page }) => {
  await openWebview(page);
  const play = page.locator('header.toolbar').getByTestId('btn-play');
  await expect(page.locator('.dav-packet')).not.toHaveCount(0);
  await play.click();
  await page.waitForTimeout(500);

  await play.click();
  await expect(play).toHaveAttribute('aria-label', 'Play step');
  const dot = page.locator('.dav-packet-dot').first();
  const label = await page.locator('.dav-packet-label').first().textContent();
  const frozen = await dot.getAttribute('transform');
  await page.waitForTimeout(500);
  expect(await dot.getAttribute('transform')).toBe(frozen);

  await play.click();
  await expect(play).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(() => dot.getAttribute('transform')).not.toBe(frozen);
  expect(await page.locator('.dav-packet-label').first().textContent()).toBe(label);
});

test('Play step only reads as playing while there is something to play', async ({ page }) => {
  await openWebview(page);
  await expect(page.locator('.dav-node')).not.toHaveCount(0);
  const play = page.locator('header.toolbar').getByTestId('btn-play');
  await play.click();
  await expect(play).toHaveAttribute('aria-pressed', 'true');
  await page.getByTestId('select-step').selectOption('overview');
  await expect(play).toHaveAttribute('aria-pressed', 'false');
  await page.getByTestId('select-step').selectOption('1');
  await expect(play).toHaveAttribute('aria-pressed', 'true');
});

test('switching documents discards the previous one', async ({ page }) => {
  await openWebview(
    page,
    'dav 1\ntitle "A"\nnode a\nnode b\na --> b\nstep "1" {\n focus a\n}\nstep "2" {\n focus b\n}\n',
  );
  await expect(page.locator('.dav-title')).toHaveText('A');
  await sendDsl(page, 'dav 1\ntitle "A"\nnode a', 'file:///a.dav');
  await expect(page.locator('.dav-node')).toHaveCount(1);
  // Without steps there is nothing to animate, and no step to pick
  await page.getByTestId('btn-export').click();
  await expect(page.getByTestId('export-svg-animated')).toBeDisabled();
  await expect(page.getByTestId('export-svg-whole')).toBeDisabled();
  await expect(page.getByTestId('export-scope-step')).toBeHidden();
  await expect(page.getByTestId('export-html')).toBeFocused();
  await page.keyboard.press('Escape');

  await sendDsl(page, '', 'file:///b.dav');
  await expect(page.locator('.dav-node')).toHaveCount(0);
  await expect(page.locator('.dav-title')).toHaveText('');
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

test('animation can be stopped for a still view of each step', async ({ page }) => {
  await openWebview(page);
  const motion = page.locator('header.toolbar').getByTestId('btn-motion');
  await expect(page.locator('.dav-packet')).not.toHaveCount(0);
  await expect(motion).toHaveAttribute('aria-pressed', 'false');
  await expect(motion).toHaveAttribute('aria-label', 'Stop animation');

  // Stopped: no packets, and every rail of the step is highlighted.
  await motion.click();
  await expect(motion).toHaveAttribute('aria-pressed', 'true');
  await expect(motion).toHaveAttribute('aria-label', 'Start animation');
  await expect(page.locator('.dav-packet')).toHaveCount(0);
  await expect(page.locator('.dav-flow')).not.toHaveCount(0);
  await expect(page.locator('.dav-flow[hidden]')).toHaveCount(0);
  await expect(page.locator('.dav-stop')).not.toHaveCount(0);

  // A click parks that node's phase; clicking past its last phase clears it.
  await page.locator('.dav-node[data-id="waf"]').click();
  await expect(page.locator('.dav-packet .dav-packet-label')).toHaveText('Pass ACL');
  await page.locator('.dav-node[data-id="waf"]').click();
  await expect(page.locator('.dav-packet')).toHaveCount(0);

  // It stays stopped across steps, and playing turns animation back on.
  await page.getByTestId('select-step').selectOption('1');
  await expect(page.locator('.dav-step-title')).toContainText('Step 2 / 4');
  await expect(motion).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.dav-packet')).toHaveCount(0);

  await page.locator('header.toolbar').getByTestId('btn-play').click();
  await expect(motion).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('.dav-packet')).not.toHaveCount(0);
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
    await expect(page.getByTestId('btn-play-all')).toHaveAttribute(
      'aria-label',
      'すべてのステップを再生',
    );
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

test.describe('exported SVG', () => {
  test('parses as strict XML, adapts theme colors, and renders cleanly standalone and in <img>', async ({
    page,
  }, info) => {
    const errors = watchErrors(page);
    const svgFile = info.outputPath('export.svg');
    const dslWithUnicode = `${DEFAULT_DSL}\nnode unicode_probe "🚀 𠮷 \uD800\uFFFE\uFFFF"\n`;
    await writeSvgExport(svgFile, dslWithUnicode);

    await page.goto(pathToFileURL(svgFile).href);
    await expect(page.locator('parsererror')).toHaveCount(0);
    await expect(page.locator('svg.dav-svg')).toHaveAttribute('aria-describedby', 'dav-desc');
    await expect(page.locator('desc#dav-desc')).toHaveCount(1);

    // Translucent zone fill uses SVG-native fill + fill-opacity rather than color-mix().
    const groupRect = page.locator('.dav-group > rect').first();
    const zoneStyle = await groupRect.evaluate((el) => {
      const cs = getComputedStyle(el);
      return { fill: cs.fill, fillOpacity: cs.fillOpacity };
    });
    expect(zoneStyle.fill).toMatch(/^rgb\(/);
    expect(Number(zoneStyle.fillOpacity)).toBeGreaterThan(0);
    expect(Number(zoneStyle.fillOpacity)).toBeLessThan(1);

    // Scoped .dav-svg tokens resolve light-dark() across color schemes.
    const stationStroke = () =>
      page
        .locator('.dav-station')
        .first()
        .evaluate((el) => getComputedStyle(el).stroke);
    await page.emulateMedia({ colorScheme: 'dark' });
    const darkStroke = await stationStroke();
    await page.emulateMedia({ colorScheme: 'light' });
    expect(await stationStroke()).not.toBe(darkStroke);

    // Zone labels render inside the SVG canvas viewport.
    const canvasBox = await page.locator('svg.dav-svg > svg').boundingBox();
    const labelBox = await page.locator('.dav-group-label').first().boundingBox();
    expect(canvasBox).not.toBeNull();
    expect(labelBox).not.toBeNull();
    if (canvasBox && labelBox) {
      expect(labelBox.x).toBeGreaterThanOrEqual(canvasBox.x - 1);
      expect(labelBox.y).toBeGreaterThanOrEqual(canvasBox.y - 1);
      expect(labelBox.x + labelBox.width).toBeLessThanOrEqual(canvasBox.x + canvasBox.width + 1);
      expect(labelBox.y + labelBox.height).toBeLessThanOrEqual(canvasBox.y + canvasBox.height + 1);
    }

    // Loads as an <img> without broken-image fallback.
    await expectSvgLoadsInImg(page, info.outputPath('img-host.html'), './export.svg');

    expect(errors).toEqual([]);
  });

  test('keeps nested zone labels inside the canvas without overlapping across SMIL camera pans', async ({
    page,
  }, info) => {
    const errors = watchErrors(page);
    const svgFile = info.outputPath('nested-zones.svg');
    const nestedDsl = [
      'dav 1',
      'node hub "Hub"',
      'group outer "Outer Zone" {',
      '  group mid "Middle Zone" {',
      '    group inner "Inner Zone" {',
      '      node n1 "Top"',
      '    }',
      '    node n2 "Mid"',
      '  }',
      '  group lower "Lower Zone" {',
      ...Array.from({ length: 6 }, (_, i) => `    node n${i + 3} "Row ${i + 3}"`),
      '  }',
      '}',
      ...Array.from({ length: 8 }, (_, i) => `hub --> n${i + 1}`),
      'step "Top" {',
      '  focus n1',
      '}',
      'step "Bottom" {',
      '  focus n8',
      '}',
    ].join('\n');
    await writeSvgExport(svgFile, nestedDsl);

    await page.goto(pathToFileURL(svgFile).href);
    await expect(page.locator('parsererror')).toHaveCount(0);

    for (const sec of [0, 1.8, 1.835, 1.87, 1.9, 2.6]) {
      await seekSvgTime(page, sec);
      const snapshot = await page.evaluate(() => {
        const canvas = document.querySelector('svg.dav-svg > svg')?.getBoundingClientRect();
        const labels = Array.from(document.querySelectorAll('.dav-layer-zone-labels > g'))
          .filter((g) => getComputedStyle(g).display !== 'none')
          .map((g) => {
            const box = g.querySelector('text')?.getBoundingClientRect();
            return {
              id: g.getAttribute('data-id') ?? '',
              left: box?.left ?? 0,
              right: box?.right ?? 0,
              top: box?.top ?? 0,
              bottom: box?.bottom ?? 0,
            };
          });
        return { canvas, labels };
      });

      expect(snapshot.canvas).toBeDefined();
      expect(snapshot.labels.length).toBeGreaterThan(0);
      if (snapshot.canvas) {
        for (const label of snapshot.labels) {
          expect(label.left).toBeGreaterThanOrEqual(snapshot.canvas.left - 2);
          expect(label.right).toBeLessThanOrEqual(snapshot.canvas.right + 2);
          expect(label.top).toBeGreaterThanOrEqual(snapshot.canvas.top - 2);
          expect(label.bottom).toBeLessThanOrEqual(snapshot.canvas.bottom + 2);
        }
      }
      for (let i = 0; i < snapshot.labels.length; i++) {
        for (let j = i + 1; j < snapshot.labels.length; j++) {
          const a = snapshot.labels[i];
          const b = snapshot.labels[j];
          if (!a || !b) continue;
          const verticalOverlap = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
          const horizontalOverlap = Math.min(a.right, b.right) - Math.max(a.left, b.left);
          expect(verticalOverlap > 1 && horizontalOverlap > 1).toBe(false);
        }
      }
    }

    expect(errors).toEqual([]);
  });

  test('renders whole-diagram and single-step SVG modes as valid XML and <img> without clipping callouts', async ({
    page,
  }, info) => {
    const errors = watchErrors(page);
    const modes: Array<{ name: string; options: SvgExportOptions }> = [
      { name: 'whole-all.svg', options: { camera: 'whole' } },
      { name: 'whole-step3.svg', options: { step: 2, camera: 'whole' } },
      { name: 'still-step1.svg', options: { step: 0, animate: false } },
    ];

    for (const { name, options } of modes) {
      const svgFile = info.outputPath(name);
      await writeSvgExport(svgFile, EVENT_DRIVEN_DSL, options);

      await page.goto(pathToFileURL(svgFile).href);
      await expect(page.locator('parsererror')).toHaveCount(0);

      await expectSvgLoadsInImg(page, info.outputPath(`${name}.html`), `./${name}`);
    }

    // Inline 03-event-driven-async Step 3 ({ step: 2, camera: 'whole' }): every callout lies inside viewBox
    const step3Svg = (await readFile(info.outputPath('whole-step3.svg'), 'utf8')).replace(
      /^<\?xml[^>]*\?>\s*/,
      '',
    );
    const inlineHtml = info.outputPath('inline-event-step3.html');
    await writeFile(inlineHtml, `<!doctype html><meta charset="utf-8"><body>${step3Svg}</body>`);
    await page.goto(pathToFileURL(inlineHtml).href);

    for (const sec of [0, 0.9]) {
      await seekSvgTime(page, sec);
      const geometry = await page.evaluate(() => {
        const canvasSvg = document.querySelector<SVGSVGElement>('svg.dav-svg > svg');
        if (!canvasSvg) return null;
        const vb = canvasSvg.viewBox.animVal;
        const callouts = Array.from(
          canvasSvg.querySelectorAll<SVGGraphicsElement>('.dav-packet-callout'),
        ).map((el) => {
          const b = el.getBBox();
          return { x: b.x, y: b.y, width: b.width, height: b.height };
        });
        return {
          viewBox: { x: vb.x, y: vb.y, width: vb.width, height: vb.height },
          callouts,
        };
      });

      expect(geometry).not.toBeNull();
      expect(geometry?.callouts.length).toBeGreaterThan(0);
      if (geometry) {
        const { viewBox } = geometry;
        for (const box of geometry.callouts) {
          expect(box.x).toBeGreaterThanOrEqual(viewBox.x);
          expect(box.y).toBeGreaterThanOrEqual(viewBox.y);
          expect(box.x + box.width).toBeLessThanOrEqual(viewBox.x + viewBox.width);
          expect(box.y + box.height).toBeLessThanOrEqual(viewBox.y + viewBox.height);
        }
      }
    }

    expect(errors).toEqual([]);
  });
});
