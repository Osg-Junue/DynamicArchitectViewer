// What the browser tests share: opening the webview as the extension does, and writing exports to look at.
import { readFileSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { expect, type Page } from '@playwright/test';
import { createServer } from 'vite';
import type { SvgExportOptions } from '../src/exporter';
import type { WebviewToHostMessage } from '../src/protocol/messages';

export const DEFAULT_DSL = readFileSync(
  new URL('../../../examples/01-infra-ha-failover.dav', import.meta.url),
  'utf8',
);
export const EVENT_DRIVEN_DSL = readFileSync(
  new URL('../../../examples/03-event-driven-async.dav', import.meta.url),
  'utf8',
);

/** Loads the webview the way the extension does: it reports `ready` and receives the document. */
export async function openWebview(page: Page, dsl: string = DEFAULT_DSL): Promise<void> {
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

export function postedMessages(page: Page): Promise<WebviewToHostMessage[]> {
  return page.evaluate(() => (window as unknown as { __posted: WebviewToHostMessage[] }).__posted);
}

export function sendDsl(page: Page, dsl: string, uri?: string): Promise<void> {
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

export function sendCursor(page: Page, offset: number): Promise<void> {
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

export async function writeExport(
  file: string,
  dsl: string = DEFAULT_DSL,
  locale: 'ja' | 'en' = 'en',
): Promise<void> {
  exporter ??= loadExporter();
  await writeFile(file, await (await exporter).exportHtml(dsl, { locale }));
}

export async function writeSvgExport(
  file: string,
  dsl: string = DEFAULT_DSL,
  options?: SvgExportOptions,
): Promise<void> {
  exporter ??= loadExporter();
  await writeFile(file, (await exporter).exportSvg(dsl, options));
}

export async function seekSvgTime(page: Page, seconds: number): Promise<void> {
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

export async function expectSvgLoadsInImg(
  page: Page,
  htmlPath: string,
  svgHref: string,
): Promise<void> {
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
export function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(`console: ${msg.text()}`);
  });
  return errors;
}
