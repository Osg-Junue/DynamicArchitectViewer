import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import {
  INITIAL_DOC_ELEMENT_ID,
  serializeInitialDoc,
  type WebviewToHostMessage,
} from '../src/protocol/messages';
import { openWebview, postedMessages, sendCursor, sendDsl, watchErrors } from './helpers';

test.describe('the preview', () => {
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

  test('boots from inline CSS and document with one script fetch, skips duplicate ready render, and lazy-loads HelpModal without loading the script twice', async ({
    page,
  }) => {
    const errors = watchErrors(page);
    const webviewCss = await readFile(
      new URL('../dist/webview/assets/webview.css', import.meta.url),
      'utf8',
    );
    const initialDsl = [
      'dav 1',
      'title "Cold </script> Boot"',
      'node api "API </script>"',
      'node db "DB"',
      'api --> db : "SQL"',
      'step "Run" {',
      '  animate api --> db : "Query"',
      '}',
      '',
    ].join('\n');
    const nonce = '0123456789abcdef0123456789abcdef';
    const csp = [
      "default-src 'none'",
      "img-src 'self' data:",
      `style-src 'nonce-${nonce}' 'self'`,
      `script-src 'nonce-${nonce}' 'self'`,
    ].join('; ');
    const initialJson = serializeInitialDoc({
      uri: 'file:///cold.dav',
      dsl: initialDsl,
      version: 7,
    });
    const inlineHtml = [
      '<!DOCTYPE html>',
      '<html lang="en">',
      '<head>',
      '<meta charset="UTF-8">',
      `<meta http-equiv="Content-Security-Policy" content="${csp}">`,
      '<meta name="viewport" content="width=device-width, initial-scale=1.0">',
      `<style nonce="${nonce}">${webviewCss}</style>`,
      '<title>DynamicArchitectViewer</title>',
      '</head>',
      '<body>',
      '<div id="root"></div>',
      `<script id="${INITIAL_DOC_ELEMENT_ID}" type="application/json">${initialJson}</script>`,
      `<script nonce="${nonce}" type="module" src="/assets/webview.js"></script>`,
      '</body>',
      '</html>',
    ].join('\n');

    const requestedPaths: string[] = [];
    page.on('request', (req) => {
      const url = new URL(req.url());
      if (url.pathname !== '/favicon.ico') requestedPaths.push(url.pathname);
    });

    await page.route('**/inline-cold-start', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'text/html; charset=utf-8',
        headers: { 'content-security-policy': csp },
        body: inlineHtml,
      });
    });

    // Host does NOT reply to `ready` with `docChanged` when initial doc is up to date.
    await page.addInitScript(() => {
      const posted: WebviewToHostMessage[] = [];
      (window as unknown as { __posted: WebviewToHostMessage[] }).__posted = posted;
      window.acquireVsCodeApi = () => ({
        postMessage(message) {
          posted.push(message);
        },
      });
    });

    await page.goto('/inline-cold-start');
    await expect(page.locator('.dav-node')).toHaveCount(2);
    await expect(page.locator('.dav-title')).toHaveText('Cold </script> Boot');
    await expect(page.locator('.dav-step-title')).toContainText('Step 1 / 1');

    // Cold boot fetched only the script (no stylesheet) and posted versioned ready.
    expect(requestedPaths).toEqual(['/inline-cold-start', '/assets/webview.js']);
    expect(await postedMessages(page)).toEqual([
      { type: 'ready', uri: 'file:///cold.dav', version: 7 },
    ]);

    // SVG url(#dav-arrow) fragment marker resolves without <base href> breakage.
    await expect(page.locator('defs marker#dav-arrow')).toHaveCount(1);
    await expect(page.locator('.dav-edge path[marker-end="url(#dav-arrow)"]')).toHaveCount(1);

    // Duplicate (uri, version) docChanged does not re-render; newer version updates cleanly.
    await page.locator('.dav-node[data-id="api"]').evaluate((el) => {
      el.setAttribute('data-boot-marker', 'kept');
    });
    await page.evaluate((dsl) => {
      window.postMessage({ type: 'docChanged', dsl, uri: 'file:///cold.dav', version: 7 }, '*');
    }, initialDsl);
    await expect(page.locator('.dav-node[data-id="api"]')).toHaveAttribute(
      'data-boot-marker',
      'kept',
    );

    const nextDsl = initialDsl.replace('Cold </script> Boot', 'Warm Update');
    await page.evaluate((dsl) => {
      window.postMessage({ type: 'docChanged', dsl, uri: 'file:///cold.dav', version: 8 }, '*');
    }, nextDsl);
    await expect(page.locator('.dav-title')).toHaveText('Warm Update');

    // Clicking Help lazy-loads HelpModal.js, which shares the script already loaded.
    await page.getByTestId('btn-open-help').click();
    const dialog = page.getByTestId('help-dialog');
    await expect(dialog).toBeVisible();
    expect(requestedPaths).toEqual([
      '/inline-cold-start',
      '/assets/webview.js',
      '/assets/HelpModal.js',
    ]);
    await expect(page.locator('#root > .shell')).toHaveCount(1);

    await page.getByTestId('doc-nav-prompt').click();
    await page.getByTestId('chk-include-current-dsl').check();
    await expect(page.getByTestId('ai-prompt-textarea')).toHaveValue(/Warm Update/);

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
