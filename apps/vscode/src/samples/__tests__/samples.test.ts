import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SAMPLE_TEMPLATES } from '../index';

describe('samples', () => {
  it('keeps the templates identical to the files in examples/', () => {
    const examples = resolve(__dirname, '../../../../../examples');
    const files = readdirSync(examples).map((file) =>
      readFileSync(resolve(examples, file), 'utf8').replace(/\r\n/g, '\n'),
    );
    expect(SAMPLE_TEMPLATES.map((sample) => sample.dsl).sort()).toEqual(files.sort());
  });
});
