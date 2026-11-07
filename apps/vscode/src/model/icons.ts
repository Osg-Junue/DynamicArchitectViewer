import type { IconName } from './types';

export type IconCategory = 'infra' | 'screen';

export interface IconMeta {
  category: IconCategory;
  accentColor: string;
}

/** Icon metadata. SVG artwork is defined by the renderer (M2). */
export const ICON_META: Record<IconName, IconMeta> = {
  server: { category: 'infra', accentColor: '#3b82f6' },
  container: { category: 'infra', accentColor: '#0ea5e9' },
  function: { category: 'infra', accentColor: '#f59e0b' },
  database: { category: 'infra', accentColor: '#10b981' },
  cache: { category: 'infra', accentColor: '#ef4444' },
  queue: { category: 'infra', accentColor: '#a855f7' },
  storage: { category: 'infra', accentColor: '#14b8a6' },
  lb: { category: 'infra', accentColor: '#6366f1' },
  firewall: { category: 'infra', accentColor: '#f43f5e' },
  cdn: { category: 'infra', accentColor: '#8b5cf6' },
  cloud: { category: 'infra', accentColor: '#38bdf8' },
  router: { category: 'infra', accentColor: '#ec4899' },
  external: { category: 'infra', accentColor: '#64748b' },
  screen: { category: 'screen', accentColor: '#3b82f6' },
  modal: { category: 'screen', accentColor: '#a855f7' },
  browser: { category: 'screen', accentColor: '#06b6d4' },
  mobile: { category: 'screen', accentColor: '#10b981' },
  user: { category: 'screen', accentColor: '#f59e0b' },
};
