import { parse } from '../dsl';
import { computeLayout, type Layout } from '../layout';
import type { DavDocument, IconName } from '../model/types';
import { EXPORT_DATA_ELEMENT_ID } from '../runtime/constants';
import playerStyles from '../runtime/generated/player.css?raw';
import runtimeScript from '../runtime/generated/player.js?raw';
import { ICON_SHAPES, type IconShapes } from '../scene/icons';

export const EXPORT_FORMAT = 'dynamic-architect-viewer';
export const EXPORT_FORMAT_VERSION = 1;
export { EXPORT_DATA_ELEMENT_ID };

/** JSON embedded in exported HTML. `dsl` is the source of truth for re-import. */
export interface ExportPayload {
  format: typeof EXPORT_FORMAT;
  version: number;
  locale: 'ja' | 'en';
  dsl: string;
  document: DavDocument;
  layout: Layout;
  /** Artwork of the icons this document uses; the runtime bundles none. */
  icons: IconShapes;
}

// Vite leaves a build marker comment at the end of the extracted CSS.
export const PLAYER_CSS = playerStyles.replace(/\/\*[\s\S]*?\*\//g, '').trim();
const PAGE_STYLES = `html,body{margin:0;height:100%;background:var(--dav-bg);overflow:hidden}${PLAYER_CSS}`;

export interface ExportOptions {
  locale?: 'ja' | 'en';
}

/**
 * Generates a self-contained HTML file: no external requests, works from file://.
 * A strict Content-Security-Policy allows only the exact inline script and style
 * (by SHA-256 hash); user content is carried as escaped JSON and rendered via DOM APIs.
 */
export async function exportHtml(dsl: string, options: ExportOptions = {}): Promise<string> {
  const { document } = parse(dsl);
  const locale = options.locale ?? 'en';
  const payload: ExportPayload = {
    format: EXPORT_FORMAT,
    version: EXPORT_FORMAT_VERSION,
    locale,
    dsl,
    document,
    layout: computeLayout(document),
    icons: usedIcons(document),
  };

  assertSafeInline(runtimeScript, 'runtime script');
  assertSafeInline(PAGE_STYLES, 'styles');
  const [scriptHash, styleHash] = await Promise.all([sha256(runtimeScript), sha256(PAGE_STYLES)]);
  const csp = [
    "default-src 'none'",
    `script-src 'sha256-${scriptHash}'`,
    `style-src 'sha256-${styleHash}'`,
    'img-src data:',
    "base-uri 'none'",
    "form-action 'none'",
  ].join('; ');

  const title = escapeHtml(document.title || 'DynamicArchitectViewer');
  return [
    '<!DOCTYPE html>',
    `<html lang="${locale}">`,
    '<head>',
    '<meta charset="UTF-8">',
    `<meta http-equiv="Content-Security-Policy" content="${escapeHtml(csp)}">`,
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<meta name="generator" content="${EXPORT_FORMAT}/${EXPORT_FORMAT_VERSION}">`,
    `<title>${title}</title>`,
    `<style>${PAGE_STYLES}</style>`,
    '</head>',
    '<body>',
    `<script type="application/json" id="${EXPORT_DATA_ELEMENT_ID}">${escapeJsonForHtml(JSON.stringify(payload))}</script>`,
    `<script>${runtimeScript}</script>`,
    '</body>',
    '</html>',
    '',
  ].join('\n');
}

function usedIcons(document: DavDocument): IconShapes {
  const names = new Set<IconName>(document.nodes.map((node) => node.icon));
  for (const step of document.steps) {
    for (const animation of step.animations) {
      if (animation.icon !== undefined) names.add(animation.icon);
    }
  }
  const icons: IconShapes = {};
  for (const name of names) icons[name] = ICON_SHAPES[name];
  return icons;
}

/**
 * Makes JSON safe inside a <script> element: `<`, `>` and `&` can never form
 * `</script>` or `<!--`, and line/paragraph separators are escaped. Still valid JSON.
 */
export function escapeJsonForHtml(json: string): string {
  return json
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function assertSafeInline(content: string, what: string): void {
  if (/<\/(script|style)/i.test(content) || content.includes('<!--')) {
    throw new Error(`Inline ${what} contains a sequence that would break out of its element`);
  }
}

async function sha256(content: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(content));
  let binary = '';
  for (const byte of new Uint8Array(digest)) binary += String.fromCharCode(byte);
  return btoa(binary);
}
