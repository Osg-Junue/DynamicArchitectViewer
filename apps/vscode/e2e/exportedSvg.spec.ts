import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { expect, test } from '@playwright/test';
import type { SvgExportOptions } from '../src/exporter';
import {
  DEFAULT_DSL,
  EVENT_DRIVEN_DSL,
  expectSvgLoadsInImg,
  seekSvgTime,
  watchErrors,
  writeSvgExport,
} from './helpers';

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
