import type { IconName } from './types';

export type IconCategory = 'infra' | 'screen';

export interface IconMeta {
  category: IconCategory;
}

/** Icon metadata. SVG artwork is defined by the renderer (M2). */
export const ICON_META: Record<IconName, IconMeta> = {
  server: { category: 'infra' },
  container: { category: 'infra' },
  function: { category: 'infra' },
  database: { category: 'infra' },
  cache: { category: 'infra' },
  queue: { category: 'infra' },
  storage: { category: 'infra' },
  lb: { category: 'infra' },
  firewall: { category: 'infra' },
  cdn: { category: 'infra' },
  cloud: { category: 'infra' },
  router: { category: 'infra' },
  external: { category: 'infra' },
  screen: { category: 'screen' },
  modal: { category: 'screen' },
  browser: { category: 'screen' },
  mobile: { category: 'screen' },
  user: { category: 'screen' },
};
