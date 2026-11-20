import { readFileSync } from 'node:fs';
import { expect, type Page, test } from '@playwright/test';
import { largeDiagram } from '../src/editor/__tests__/largeDiagram';
import { chosen, openWebview, sendDsl } from './helpers';

/** A diagram with links long enough that the zones are searched for a better place. */
const SEARCHED_DSL = readFileSync(
  new URL('../../../promo/pv/architecture-en.dav', import.meta.url),
  'utf8',
);

/** Serves the page under the policy the extension gives its webview, with or without workers. */
async function underWebviewPolicy(page: Page, workers: boolean): Promise<void> {
  const policy = [
    "default-src 'none'",
    "img-src 'self' data:",
    "style-src 'self' 'unsafe-inline'",
    "script-src 'self'",
    ...(workers ? ['worker-src blob:'] : []),
  ].join('; ');
  await page.route(
    (url) => url.pathname === '/',
    async (route) => {
      const response = await route.fetch();
      const body = (await response.text()).replace(
        '<head>',
        `<head><meta http-equiv="Content-Security-Policy" content="${policy}">`,
      );
      await route.fulfill({ response, body });
    },
  );
}

test.describe('searching for where the zones go', () => {
  test('runs in a worker under the webview policy, and the cursor waits for the layout', async ({
    page,
  }) => {
    let workers = 0;
    page.on('worker', () => workers++);
    await underWebviewPolicy(page, true);
    const longer = SEARCHED_DSL.replace('dav 1', 'dav 1\nnode audit "Audit log" [icon: storage]');
    await openWebview(page, longer);
    await expect(page.locator('.dav-node')).toHaveCount(10);
    expect(workers).toBe(1);

    // A change to the structure is searched again, and the cursor arrives before the answer
    // does. The line that went moved every step up: in the text still shown, the offset lies in
    // the first step, which the preview is on already.
    await page.evaluate(
      ([text, offset]) => {
        window.postMessage({ type: 'docChanged', dsl: text }, '*');
        window.postMessage({ type: 'cursorMoved', offset }, '*');
      },
      [SEARCHED_DSL, SEARCHED_DSL.indexOf('step "Reserve stock"') + 8] as const,
    );
    await expect(page.locator('.dav-node')).toHaveCount(9);
    await expect(chosen(page, 'select-step')).toHaveAttribute('data-value', '1');
    expect(workers).toBe(1);
  });

  test('runs a large diagram deterministically in a single worker across runs', async ({
    browser,
  }) => {
    const drawnOnce = async () => {
      const page = await browser.newPage();
      let workers = 0;
      page.on('worker', () => workers++);
      await underWebviewPolicy(page, true);
      await openWebview(page, largeDiagram());
      await expect(page.locator('.dav-node')).toHaveCount(40);
      const where = await page.locator('.dav-node').evaluateAll((nodes) =>
        nodes.map((node) => {
          const box = node.getBoundingClientRect();
          return `${Math.round(box.x)},${Math.round(box.y)}`;
        }),
      );
      await page.close();
      return { workers, where };
    };
    const first = await drawnOnce();
    const second = await drawnOnce();
    expect(first.workers).toBe(1);
    expect(second.workers).toBe(1);
    expect(new Set(first.where).size).toBe(40);
    expect(first.where).toEqual(second.where);
  });

  test('reuses the single worker across large diagrams', async ({ page }) => {
    await underWebviewPolicy(page, true);
    await openWebview(page, largeDiagram());
    await expect(page.locator('.dav-node')).toHaveCount(40);
    expect(page.workers()).toHaveLength(1);

    await sendDsl(page, largeDiagram('node more'), 'file:///other.dav');
    await expect(page.locator('.dav-node')).toHaveCount(41);
    expect(page.workers()).toHaveLength(1);
  });

  test('runs on the page itself where workers are not allowed', async ({ page }) => {
    await underWebviewPolicy(page, false);
    await openWebview(page, SEARCHED_DSL);
    await expect(page.locator('.dav-node')).toHaveCount(9);
    await sendDsl(page, `${SEARCHED_DSL}\nnode audit "Audit log" [icon: storage]\n`);
    await expect(page.locator('.dav-node')).toHaveCount(10);
  });
});
