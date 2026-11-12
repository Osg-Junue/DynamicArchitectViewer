import infraHaFailover from '../../../../examples/01-infra-ha-failover.dav?raw';
import screenFlowCheckout from '../../../../examples/02-screen-flow-checkout.dav?raw';
import eventDrivenAsync from '../../../../examples/03-event-driven-async.dav?raw';
import enterpriseZeroTrustPayment from '../../../../examples/04-enterprise-zero-trust-payment.dav?raw';
import sequencePaymentRetry from '../../../../examples/05-sequence-payment-retry.dav?raw';
import lanOfficeNetwork from '../../../../examples/06-lan-office-network.dav?raw';
import dynamicArchitectViewer from '../../../../examples/07-dynamic-architect-viewer.dav?raw';

/** Text in each UI language. */
type Localized = readonly [ja: string, en: string];

export interface SampleTemplate {
  id: string;
  name: Localized;
  /** One line on what the sample shows, for the template picker. */
  description: Localized;
  dsl: string;
}

export const SAMPLE_TEMPLATES: readonly SampleTemplate[] = [
  {
    id: 'infra-ha-failover',
    name: [
      'インフラ: 冗長化した Web 構成とデータベースのフェイルオーバー',
      'Infrastructure: redundant web stack and database failover',
    ],
    description: [
      'CDN、ロードバランサー、API、Redis、プライマリ/スタンバイ DB。通常の流れとフェイルオーバー',
      'CDN, load balancer, API, Redis cache and primary/standby databases, with normal traffic and a failover',
    ],
    dsl: infraHaFailover,
  },
  {
    id: 'screen-flow-checkout',
    name: [
      '画面遷移と API 呼び出し: サインインから購入まで',
      'Screen flow with API calls: sign-in to checkout',
    ],
    description: [
      '画面の遷移と、その裏で動くバックエンド呼び出し',
      'Screen transitions together with the backend calls behind them',
    ],
    dsl: screenFlowCheckout,
  },
  {
    id: 'event-driven-async',
    name: [
      'マイクロサービス: イベント駆動の非同期パイプライン',
      'Microservices: event-driven async pipeline',
    ],
    description: [
      'キュー、ワーカー、オブジェクトストレージによる重いバックグラウンド処理',
      'A queue, a worker and object storage for slow background jobs',
    ],
    dsl: eventDrivenAsync,
  },
  {
    id: 'enterprise-zero-trust-10anim',
    name: [
      '大規模システム: ゼロトラスト決済と AI 不正検知',
      'Large system: zero-trust payments and AI fraud detection',
    ],
    description: [
      '5 つのゾーンをまたぐ長い流れと、不正検知によるロールバック',
      'A long flow across five zones, with a fraud case that rolls back',
    ],
    dsl: enterpriseZeroTrustPayment,
  },
  {
    id: 'sequence-payment-retry',
    name: [
      'シーケンス: 決済のリトライと非同期配信',
      'Sequence: payment retries and async delivery',
    ],
    description: [
      'レート制限、バックオフ付きリトライ、デッドレターキュー。パケットにアイコンを表示',
      'Rate limiting, retries with backoff, and a dead letter queue, with icons on packets',
    ],
    dsl: sequencePaymentRetry,
  },
  {
    id: 'lan-office-network',
    name: [
      'オフィス LAN: 拠点間 VPN と回線フェイルオーバー',
      'Office LAN: site-to-site VPN and link failover',
    ],
    description: [
      'スイッチ、Wi-Fi、プリンター、ファイルサーバー。VPN と LTE へのフェイルオーバー',
      'Switches, Wi-Fi, a printer and a file server, with a VPN and failover to LTE',
    ],
    dsl: lanOfficeNetwork,
  },
  {
    id: 'dynamic-architect-viewer',
    name: [
      'ソフトウェアの処理の流れ: DSL の解析、ライブプレビュー、HTML 書き出し',
      'Software pipeline: DSL parsing, live preview and HTML export',
    ],
    description: [
      'この拡張機能が .dav ファイルをプレビューと単一 HTML にするまで',
      'How this extension turns a .dav file into a live preview and a standalone HTML file',
    ],
    dsl: dynamicArchitectViewer,
  },
];

export const DEFAULT_SAMPLE: SampleTemplate = SAMPLE_TEMPLATES[0] ?? {
  id: 'default',
  name: ['既定', 'Default'],
  description: ['', ''],
  dsl: 'dav 1\n',
};
