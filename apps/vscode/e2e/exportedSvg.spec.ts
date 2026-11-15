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

    // Loads as an <img> without broken-image fallback.
    await expectSvgLoadsInImg(page, info.outputPath('img-host.html'), './export.svg');

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
