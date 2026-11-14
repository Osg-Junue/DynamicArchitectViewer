import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { expect, type Page, test } from '@playwright/test';
import { type PreviewServer, preview } from 'vite';
import { watchErrors } from './helpers';

const DSL = [
  'dav 1',
  'title "Hello"',
  'node alpha "Alpha"',
  'node beta "Beta"',
  'alpha --> beta : "go"',
  'step "One" {',
  '  animate alpha --> beta : "ping"',
  '}',
  '',
].join('\n');

/** Serves `dist/playground`, which the web server of the tests has built. */
let server: PreviewServer;
let url: string;

test.beforeAll(async () => {
  server = await preview({
    configFile: fileURLToPath(new URL('../vite.playground.config.ts', import.meta.url)),
    logLevel: 'error',
    preview: { port: 4180 },
  });
  const local = server.resolvedUrls?.local[0];
  if (!local) throw new Error('The playground is not served');
  url = local;
});

test.afterAll(async () => {
  await server.close();
});

const editor = (page: Page) => page.locator('.pg-editor .monaco-editor').first();
/** A line of the editor; Monaco draws spaces as no-break spaces, which `\s` matches. */
const line = (page: Page, text: RegExp) => page.locator('.pg-editor .view-line', { hasText: text });

async function open(page: Page): Promise<void> {
  await page.goto(url);
  await expect(editor(page)).toBeVisible();
  await expect(page.locator('.dav-node')).not.toHaveCount(0);
}

/** Replaces the whole text, as a paste would. */
async function setText(page: Page, text: string): Promise<void> {
  await editor(page).click();
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.insertText(text);
}

test.describe('the playground', () => {
  test('plays the sample beside its text, and draws what is typed', async ({ page }) => {
    const errors = watchErrors(page);
    await open(page);
    await expect(page.locator('.dav-title')).toHaveText(/AWS/);
    await expect(line(page, /^dav\s1$/)).toBeVisible();
    // The words of the language have the colors of a keyword and a string.
    await expect(page.locator('.pg-editor .view-line .mtk1')).not.toHaveCount(0);
    expect(
      await page
        .locator('.pg-editor .view-line')
        .first()
        .evaluate(
          (el) => new Set([...el.querySelectorAll('span span')].map((s) => s.className)).size,
        ),
    ).toBeGreaterThan(1);

    await setText(page, DSL);
    await expect(page.locator('.dav-title')).toHaveText('Hello');
    await expect(page.locator('.dav-node[data-id="beta"]')).toBeVisible();

    // Typing goes to the text alone: Space does not start the playback, as it does in the preview.
    await page.keyboard.press('ControlOrMeta+End');
    await page.keyboard.type('node gamma "Gamma  ray"');
    await expect(page.locator('.dav-node[data-id="gamma"]')).toBeVisible();
    await expect(page.getByTestId('btn-play')).toHaveAttribute('aria-pressed', 'false');
    await expect(page.getByTestId('btn-play-all')).toHaveAttribute('aria-pressed', 'false');
    expect(errors).toEqual([]);
  });

  test('underlines an error and applies its Quick Fix', async ({ page }) => {
    const errors = watchErrors(page);
    await open(page);
    await setText(page, 'dav 1\nnode alpha "Alpha" [icon: serverr]\n');
    await expect(
      page.locator('.pg-editor .squiggly-error, .pg-editor .squiggly-warning'),
    ).toHaveCount(1);

    // "Go to Next Problem" puts the cursor on the error, where the fix is offered.
    await page.keyboard.press('F8');
    await expect(page.locator('.pg-editor .marker-widget')).toContainText('Unknown icon "serverr"');
    await page.keyboard.press('Escape');
    await page.keyboard.press('ControlOrMeta+.');
    await page.getByText("Change to 'server'").click();

    await expect(line(page, /\[icon:\sserver\]/)).toBeVisible();
    await expect(
      page.locator('.pg-editor .squiggly-error, .pg-editor .squiggly-warning'),
    ).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test('completes a statement and formats the text', async ({ page }) => {
    const errors = watchErrors(page);
    await open(page);
    await setText(page, 'dav 1\nnode   alpha   "Alpha"\n');
    await page.keyboard.press('ControlOrMeta+End');
    await page.keyboard.press('ControlOrMeta+Space');
    const suggestions = page.locator('.pg-editor .suggest-widget');
    await expect(suggestions).toBeVisible();
    await expect(suggestions.getByText('group', { exact: true })).toBeVisible();
    await page.keyboard.type('gro');
    await page.keyboard.press('Enter');
    await expect(line(page, /^group/)).toBeVisible();
    await page.keyboard.type(' zone "Zone" {');
    await expect(page.locator('.dav-group[data-id="zone"]').first()).toBeVisible();

    await page.keyboard.press('Shift+Alt+F');
    await expect(line(page, /^node\salpha\s"Alpha"$/)).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('shows another sample, and goes from a node to its text', async ({ page }) => {
    const errors = watchErrors(page);
    await open(page);
    await page.getByTestId('pg-sample').selectOption('screen-flow-checkout');
    await expect(page.locator('.dav-title')).toHaveText(/Online store/);
    await expect(line(page, /^title\s"Online\sstore/)).toBeVisible();

    // The picker is a menu: the sample it loaded last is loaded again over the reader's text.
    await setText(page, DSL);
    await expect(page.locator('.dav-title')).toHaveText('Hello');
    await page.getByTestId('pg-sample').selectOption('screen-flow-checkout');
    await expect(page.locator('.dav-title')).toHaveText(/Online store/);

    await setText(page, DSL);
    await expect(page.locator('.dav-node[data-id="beta"]')).toBeVisible();
    // A double click selects the statement of the node in the editor; Delete removes it.
    await page.locator('.dav-node[data-id="beta"]').dblclick();
    await expect(editor(page)).toContainClass('focused');
    await page.keyboard.press('Delete');
    await expect(page.locator('.dav-node[data-id="beta"]')).toHaveCount(0);
    await expect(page.locator('.dav-node[data-id="alpha"]')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('colors the words of the language where they are words', async ({ page }) => {
    await open(page);
    await setText(
      page,
      [
        'dav 1',
        'node code "Code" [color:',
        'node beta "Beta" [icon: server]',
        'beta --> code : "go"',
        'step "One" {',
        '  animate beta --> code { code json "{}" }',
        '}',
        '',
      ].join('\n'),
    );
    /** The color class of each token of a line, by its text. */
    const classes = (text: RegExp): Promise<Record<string, string>> =>
      line(page, text).evaluate((el) =>
        Object.fromEntries(
          [...el.querySelectorAll('span > span')].map((s) => [
            (s.textContent ?? '').trim(),
            s.className,
          ]),
        ),
      );
    const first = await classes(/^node\scode/);
    const second = await classes(/^node\sbeta/);
    const animate = await classes(/animate\sbeta/);
    // `code` is a name here, and the word of a statement after `{`.
    expect(first.code).not.toBe(first.node);
    expect(animate.code).toBe(first.node);
    // An attribute left open at the end of a line does not color the next line.
    expect(second.node).toBe(first.node);
    // The value of `icon:` and the id of a node have colors of their own.
    expect(second.server).not.toBe(second.beta);
  });

  test('takes its text from its own editor only', async ({ page }) => {
    await open(page);
    await setText(page, DSL);
    await expect(page.locator('.dav-title')).toHaveText('Hello');
    // Another window, as a page that opened or framed the playground would be.
    const [other] = await Promise.all([
      page.waitForEvent('popup'),
      page.evaluate(() => {
        window.open('about:blank');
      }),
    ]);
    await other.evaluate(() => {
      window.opener.postMessage(
        { type: 'docChanged', dsl: 'dav 1\ntitle "Injected"\nnode x "X"\n' },
        '*',
      );
    });
    // Long enough for the preview to have drawn that text, had it taken it.
    await page.waitForTimeout(500);
    await expect(page.locator('.dav-title')).toHaveText('Hello');
    await expect(page.locator('.dav-node[data-id="x"]')).toHaveCount(0);
  });

  test('says so when an export fails', async ({ page }) => {
    await open(page);
    await page.route(/\/assets\/exporter-[^/]*\.js$/, (route) => route.abort());
    await page.getByTestId('btn-export').click();
    await page.getByTestId('export-html').click();
    await expect(page.locator('.pg-notice')).toContainText('The export failed');
  });

  test('saves an export as a download', async ({ page }) => {
    const errors = watchErrors(page);
    await open(page);
    await setText(page, DSL);
    await expect(page.locator('.dav-title')).toHaveText('Hello');

    const saved = async (item: string): Promise<{ name: string; content: string }> => {
      await page.getByTestId('btn-export').click();
      const [download] = await Promise.all([
        page.waitForEvent('download'),
        page.getByTestId(item).click(),
      ]);
      return {
        name: download.suggestedFilename(),
        content: await readFile(await download.path(), 'utf8'),
      };
    };

    const html = await saved('export-html');
    expect(html.name).toBe('diagram.html');
    expect(html.content.startsWith('<!DOCTYPE html>')).toBe(true);
    expect(html.content).toContain('<title>Hello</title>');

    const svg = await saved('export-svg-animated');
    expect(svg.name).toBe('diagram.svg');
    expect(svg.content.startsWith('<?xml version="1.0" encoding="UTF-8"?>\n<svg ')).toBe(true);
    expect(svg.content).toContain('<animate');

    const still = await saved('export-svg-still');
    expect(still.name).toBe('diagram.svg');
    expect(still.content).not.toContain('<animate');
    expect(errors).toEqual([]);
  });

  test('puts the diagram above the text on a narrow screen', async ({ page }) => {
    await page.setViewportSize({ width: 420, height: 800 });
    await open(page);
    const previewBox = await page.getByTestId('pg-preview').boundingBox();
    const editorBox = await page.getByTestId('pg-editor').boundingBox();
    expect(previewBox && editorBox && previewBox.y + previewBox.height <= editorBox.y + 1).toBe(
      true,
    );
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      420,
    );
  });
});

test.describe('the playground in Japanese', () => {
  test.use({ locale: 'ja-JP' });

  test('has the texts of the editor in Japanese too', async ({ page }) => {
    const errors = watchErrors(page);
    await open(page);
    await expect(page.getByTestId('pg-sample')).toContainText('サンプルを開く');
    await editor(page).click();
    await page.keyboard.press('F1');
    const palette = page.locator('.pg-editor .quick-input-widget');
    await expect(palette).toBeVisible();
    // The commands of Monaco, which come from its own bundle of texts.
    await expect(palette.locator('.quick-input-list')).toContainText(/[ぁ-んァ-ヶ一-龠]/);
    expect(errors).toEqual([]);
  });
});
