import type { DocGroupId, DocPage } from './elements';
import { LANGUAGE_PAGES } from './pagesLanguage';
import { REFERENCE_PAGES } from './pagesReference';
import { START_PAGES } from './pagesStart';
import { TOOLS_PAGES } from './pagesTools';

export { type DocContext, type DocGroupId, type DocPage, rich } from './elements';

export const DOC_GROUPS: ReadonlyArray<readonly [DocGroupId, string, string]> = [
  ['start', 'はじめに', 'Start'],
  ['catalog', 'カタログ', 'Catalog'],
  ['language', '言語ルール', 'Language rules'],
  ['reference', 'リファレンス', 'Reference'],
  ['tools', 'ツール', 'Tools'],
];

export const DOC_PAGES: readonly DocPage[] = [
  ...START_PAGES,
  ...LANGUAGE_PAGES,
  ...REFERENCE_PAGES,
  ...TOOLS_PAGES,
];
