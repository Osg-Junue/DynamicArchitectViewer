import { NodeIconType } from './types';

export interface IconMeta {
  type: NodeIconType;
  label: string;
  category: 'infra' | 'screen';
  accentColor: string;
  svgInner: string;
}

export const ICON_META_MAP: Record<NodeIconType, IconMeta> = {
  server: {
    type: 'server',
    label: 'Server / API',
    category: 'infra',
    accentColor: '#3b82f6',
    svgInner: `<rect x="2" y="3" width="20" height="7" rx="2"/><rect x="2" y="14" width="20" height="7" rx="2"/><circle cx="6" cy="6.5" r="1"/><circle cx="6" cy="17.5" r="1"/><line x1="10" y1="6.5" x2="18" y2="6.5"/><line x1="10" y1="17.5" x2="18" y2="17.5"/>`,
  },
  container: {
    type: 'container',
    label: 'Container / K8s',
    category: 'infra',
    accentColor: '#0ea5e9',
    svgInner: `<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>`,
  },
  function: {
    type: 'function',
    label: 'Serverless / Lambda',
    category: 'infra',
    accentColor: '#f59e0b',
    svgInner: `<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>`,
  },
  database: {
    type: 'database',
    label: 'Database (RDB/NoSQL)',
    category: 'infra',
    accentColor: '#10b981',
    svgInner: `<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>`,
  },
  cache: {
    type: 'cache',
    label: 'Cache (Redis/Memcached)',
    category: 'infra',
    accentColor: '#ef4444',
    svgInner: `<polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>`,
  },
  queue: {
    type: 'queue',
    label: 'Queue / Event Bus',
    category: 'infra',
    accentColor: '#a855f7',
    svgInner: `<rect x="2" y="6" width="20" height="12" rx="2"/><line x1="7" y1="10" x2="7" y2="14"/><line x1="12" y1="10" x2="12" y2="14"/><line x1="17" y1="10" x2="17" y2="14"/>`,
  },
  storage: {
    type: 'storage',
    label: 'Object Storage (S3)',
    category: 'infra',
    accentColor: '#14b8a6',
    svgInner: `<path d="M4 4h16l-2 16H6L4 4z"/><path d="M2 4h20"/><path d="M9 9h6"/>`,
  },
  lb: {
    type: 'lb',
    label: 'Load Balancer / ALB',
    category: 'infra',
    accentColor: '#6366f1',
    svgInner: `<circle cx="5" cy="12" r="3"/><circle cx="19" cy="6" r="2.5"/><circle cx="19" cy="12" r="2.5"/><circle cx="19" cy="18" r="2.5"/><path d="M8 12h8.5"/><path d="M8 11l8.5-5"/><path d="M8 13l8.5 5"/>`,
  },
  firewall: {
    type: 'firewall',
    label: 'WAF / Firewall / Auth',
    category: 'infra',
    accentColor: '#f43f5e',
    svgInner: `<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/>`,
  },
  cdn: {
    type: 'cdn',
    label: 'CDN / Edge / DNS',
    category: 'infra',
    accentColor: '#8b5cf6',
    svgInner: `<circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>`,
  },
  cloud: {
    type: 'cloud',
    label: 'Cloud / External Network',
    category: 'infra',
    accentColor: '#38bdf8',
    svgInner: `<path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/>`,
  },
  router: {
    type: 'router',
    label: 'API Gateway / Router',
    category: 'infra',
    accentColor: '#ec4899',
    svgInner: `<rect x="3" y="13" width="18" height="7" rx="2"/><line x1="7" y1="16.5" x2="7.01" y2="16.5"/><line x1="11" y1="16.5" x2="11.01" y2="16.5"/><path d="M12 13V4"/><polyline points="9 7 12 4 15 7"/>`,
  },
  external: {
    type: 'external',
    label: 'External SaaS / API',
    category: 'infra',
    accentColor: '#64748b',
    svgInner: `<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>`,
  },
  screen: {
    type: 'screen',
    label: 'Screen / 画面カード',
    category: 'screen',
    accentColor: '#3b82f6',
    svgInner: `<rect x="2" y="3" width="20" height="18" rx="2"/><line x1="2" y1="8" x2="22" y2="8"/><circle cx="5.5" cy="5.5" r="0.8"/><circle cx="8" cy="5.5" r="0.8"/><rect x="5" y="11" width="6" height="7" rx="1"/><line x1="14" y1="12" x2="19" y2="12"/><line x1="14" y1="15" x2="18" y2="15"/>`,
  },
  modal: {
    type: 'modal',
    label: 'Modal / ダイアログ画面',
    category: 'screen',
    accentColor: '#a855f7',
    svgInner: `<rect x="4" y="5" width="16" height="14" rx="2"/><line x1="4" y1="9" x2="20" y2="9"/><line x1="17" y1="7" x2="17.01" y2="7"/><rect x="8" y="13" width="8" height="3" rx="1"/>`,
  },
  browser: {
    type: 'browser',
    label: 'Web Browser',
    category: 'screen',
    accentColor: '#06b6d4',
    svgInner: `<rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>`,
  },
  mobile: {
    type: 'mobile',
    label: 'Mobile App',
    category: 'screen',
    accentColor: '#10b981',
    svgInner: `<rect x="6" y="2" width="12" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/>`,
  },
  user: {
    type: 'user',
    label: 'User / Actor',
    category: 'screen',
    accentColor: '#f59e0b',
    svgInner: `<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>`,
  },
};

export const ALL_ICON_TYPES = Object.keys(ICON_META_MAP) as NodeIconType[];

export function isValidIconType(value: string): value is NodeIconType {
  return Object.prototype.hasOwnProperty.call(ICON_META_MAP, value);
}
