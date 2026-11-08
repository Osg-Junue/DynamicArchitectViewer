import type { IconName } from './types';

export type IconCategory = 'infra' | 'screen';

export interface IconMeta {
  category: IconCategory;
  description: readonly [ja: string, en: string];
}

/** Icon metadata. SVG artwork is defined by the renderer (M2). */
export const ICON_META: Record<IconName, IconMeta> = {
  server: { category: 'infra', description: ['サーバー / VM（既定）', 'Server or VM (default)'] },
  container: { category: 'infra', description: ['コンテナ / Pod', 'Container or pod'] },
  function: { category: 'infra', description: ['サーバーレス関数', 'Serverless function'] },
  database: { category: 'infra', description: ['データベース', 'Database'] },
  cache: { category: 'infra', description: ['キャッシュ', 'Cache'] },
  queue: { category: 'infra', description: ['キュー / ストリーム', 'Queue or stream'] },
  storage: {
    category: 'infra',
    description: ['オブジェクト / ファイルストレージ', 'Object or file storage'],
  },
  lb: { category: 'infra', description: ['ロードバランサー', 'Load balancer'] },
  firewall: { category: 'infra', description: ['ファイアウォール / WAF', 'Firewall or WAF'] },
  cdn: { category: 'infra', description: ['CDN', 'CDN'] },
  cloud: {
    category: 'infra',
    description: ['クラウド / マネージドサービス', 'Cloud or managed service'],
  },
  router: { category: 'infra', description: ['ルーター / ゲートウェイ', 'Router or gateway'] },
  external: { category: 'infra', description: ['外部システム', 'External system'] },
  auth: {
    category: 'infra',
    description: ['認証 / IdP / 鍵管理', 'Auth, IdP or secret manager'],
  },
  ai: {
    category: 'infra',
    description: ['AI / LLM / ML推論', 'AI, LLM or ML inference'],
  },
  mail: {
    category: 'infra',
    description: ['メール / 通知配信', 'Mail or notification service'],
  },
  monitor: {
    category: 'infra',
    description: ['監視 / ログ / 可観測性', 'Monitoring, logs or observability'],
  },
  schedule: {
    category: 'infra',
    description: ['スケジューラ / Cron', 'Scheduler or cron trigger'],
  },
  search: {
    category: 'infra',
    description: ['検索エンジン / 分析', 'Search or analytics engine'],
  },
  screen: { category: 'screen', description: ['画面（ウィンドウ形）', 'Screen (window shape)'] },
  modal: {
    category: 'screen',
    description: ['モーダル（ウィンドウ形）', 'Modal (window shape)'],
  },
  browser: { category: 'screen', description: ['ブラウザ', 'Web browser'] },
  mobile: { category: 'screen', description: ['モバイル端末', 'Mobile device'] },
  terminal: {
    category: 'screen',
    description: ['CLI / 端末クライアント', 'CLI or terminal client'],
  },
  user: { category: 'screen', description: ['ユーザー / アクター', 'User or actor'] },
};
