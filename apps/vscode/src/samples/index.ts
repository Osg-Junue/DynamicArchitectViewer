export interface SampleTemplate {
  id: string;
  name: string;
  category: 'infra' | 'screen';
  description: string;
  dsl: string;
}

export const SAMPLE_TEMPLATES: readonly SampleTemplate[] = [
  {
    id: 'infra-ha-failover',
    name: 'インフラ構成図：冗長Web構成とDBフェイルオーバー',
    category: 'infra',
    description: 'CDN・ALB・API・Redisキャッシュ・Primary/Standby DBの通常通信と障害切替ステップ',
    dsl: `dav 1
title "AWS マルチAZ Webアーキテクチャ & DBフェイルオーバー"

group edge_net "Edge & Security" {
  node cdn "CloudFront CDN" [icon: cdn, sub: "Edge Cache"]
  node waf "AWS WAF" [icon: firewall, sub: "Rate Limit / ACL"]
}

group vpc "Production VPC (ap-northeast-1)" {
  node alb "Application LB" [icon: lb, sub: "Ingress HTTPS"]
  node api "Order API" [icon: container, sub: "ECS Fargate x4"]
  node redis "ElastiCache" [icon: cache, sub: "Redis Cluster"]
  node db_pri "Primary DB" [icon: database, sub: "Aurora Writer (AZ-a)"]
  node db_sby "Standby DB" [icon: database, sub: "Aurora Reader (AZ-c)", status: muted, badge: "STANDBY"]
}

node client "Web Browser" [icon: browser, sub: "エンドユーザー"]

client --> cdn : "HTTPS"
cdn --> waf : "Origin Fetch"
waf --> alb : "Verified"
alb --> api : "HTTP/2"
api --> redis : "Cache Lookup"
api --> db_pri : "Read / Write"
db_pri -.-> db_sby : "Sync Replication"
api -.-> db_sby : "Failover Route" [id: e_failover, visible: false, color: #f59e0b]

step "エッジ検証とALBへのルーティング" {
  desc "ブラウザからのリクエストをCloudFrontが受け取り、WAFで検査した後にVPC内のALBへ転送します。"
  focus client, cdn, waf, alb
  animate client --> cdn : "GET /products" [color: #38bdf8, desc: "ブラウザからCloudFrontエッジロケーションへHTTPSリクエストを送信"]
  animate cdn --> waf : "Inspect Request" [color: #8b5cf6, desc: "キャッシュミス時、AWS WAFへ転送してACL・レート制限ルールで検査"]
  animate waf --> alb : "Pass ACL" [color: #6366f1, desc: "検査を通過した正常なリクエストのみをVPC内のALBへルーティング"]
}

step "キャッシュヒットによる高速応答" {
  desc "Order APIがRedisを参照し、キャッシュヒットした場合はDBへアクセスせず即座にレスポンスを返します。"
  focus alb, api, redis
  state redis [status: active, badge: "CACHE HIT"]
  animate alb --> api : "Forward" [color: #3b82f6, desc: "ALBがターゲットグループ内のECS Fargateタスクへリクエストを振り分け"]
  animate api --> redis : "GET product:101" [color: #ef4444, desc: "ElastiCache (Redis) からインメモリで商品データを高速取得"]
}

step "注文トランザクションの書き込みとDB同期" {
  desc "注文確定リクエスト（POST）はPrimary DBへ書き込まれ、Standby DBへレプリケーションされます。"
  focus api, db_pri, db_sby
  state redis [status: normal, badge: ""]
  state db_pri [status: active, badge: "COMMIT"]
  animate api --> db_pri : "INSERT INTO orders" [color: #10b981, desc: "Primary DB (AZ-a) に対して注文トランザクションを書き込みコミット"]
  animate db_pri -.-> db_sby : "Replicate WAL" [color: #14b8a6, desc: "別AZのStandby DB (AZ-c) へストレージレベルでWALを同期レプリケーション"]
}

step "Primary DB障害発生と自動フェイルオーバー" {
  desc "Primary DBで障害が発生。ヘルスチェック失敗を検知し、Standby DBをWriterに昇格させて経路を自動切替します。"
  focus api, db_pri, db_sby
  state db_pri [status: error, badge: "DOWN"]
  state db_sby [status: active, badge: "PROMOTED"]
  state e_failover [visible: true]
  animate api -.-> db_sby : "Reconnect Writer" [color: #f59e0b, desc: "クラスターエンドポイントのDNS切替により、昇格したStandby DBへ自動再接続"]
}
`,
  },
  {
    id: 'screen-flow-checkout',
    name: '画面遷移図＋API連携：ログイン〜EC決済フロー',
    category: 'screen',
    description:
      'フロントエンドの画面遷移（ログイン→商品一覧→決済モーダル→完了画面）とバックエンドAPI通信の連動可視化',
    dsl: `dav 1
title "ECアプリ 画面遷移 & バックエンドAPI連携シーケンス"

group frontend "フロントエンド画面遷移 (SPA)" {
  node scr_login "ログイン画面" [icon: screen, sub: "/login | ID・PW入力フォーム"]
  node scr_catalog "商品一覧・カート画面" [icon: screen, sub: "/catalog | カート追加・在庫表示"]
  node mod_pay "決済確認モーダル" [icon: modal, sub: "Modal | クレジットカード確認", visible: false]
  node scr_done "注文完了画面" [icon: screen, sub: "/complete | 注文番号表示", status: muted]
}

group backend "バックエンド & 外部連携" {
  node auth_api "Auth Service" [icon: firewall, sub: "JWT発行 / OAuth"]
  node shop_api "Checkout API" [icon: server, sub: "在庫引当・注文管理"]
  node stripe "Stripe決済GW" [icon: external, sub: "External Payment API"]
}

scr_login --> scr_catalog : "認証成功後遷移"
scr_catalog --> mod_pay : "「購入へ進む」押下"
mod_pay --> scr_done : "決済完了"
scr_login --> auth_api : "POST /auth/login"
scr_catalog --> shop_api : "GET /items"
mod_pay --> shop_api : "POST /checkout"
shop_api --> stripe : "Charge API"

step "ログイン認証とトークン発行" {
  desc "ユーザーがログイン画面で認証情報を送信。Auth Serviceで検証後、JWTを発行して商品一覧画面へ遷移します。"
  focus scr_login, auth_api, scr_catalog
  state scr_login [status: active, badge: "INPUT"]
  animate scr_login --> auth_api : "POST /auth/login" [color: #3b82f6, desc: "入力されたID・パスワードをAuth Serviceへ送信し、認証トークン(JWT)を取得"]
  animate scr_login --> scr_catalog : "Redirect /catalog" [color: #10b981, desc: "認証成功後、SPAルーターにより商品一覧・カート画面へ遷移"]
}

step "商品一覧取得と決済モーダル表示" {
  desc "商品一覧画面で最新在庫をAPIから取得。ユーザーが「購入へ進む」を押すと決済確認モーダルが立ち上がります。"
  focus scr_catalog, shop_api, mod_pay
  state scr_login [status: normal, badge: ""]
  state scr_catalog [status: active]
  state mod_pay [visible: true, status: active, badge: "OPEN"]
  animate scr_catalog --> shop_api : "GET /items (200 OK)" [color: #06b6d4, desc: "Checkout APIから最新の商品カタログおよび在庫ステータスを取得"]
  animate scr_catalog --> mod_pay : "Open Modal" [color: #a855f7, desc: "カート内商品の確認後、画面遷移せずに決済確認モーダルをオーバーレイ表示"]
}

step "決済実行と外部決済GW連携" {
  desc "決済モーダルで「注文確定」を押下。Checkout APIがStripe決済GWと通信して与信枠を確保します。"
  focus mod_pay, shop_api, stripe
  state scr_catalog [status: normal]
  state mod_pay [status: warning, badge: "PROCESSING"]
  state shop_api [status: active]
  animate mod_pay --> shop_api : "POST /checkout" [color: #f59e0b, desc: "決済トークンと注文内容をCheckout APIへ送信し、二重送信防止ロックを開始"]
  animate shop_api --> stripe : "POST /v1/charges" [color: #6366f1, desc: "バックエンドからStripe決済ゲートウェイを呼び出し、カード決済を実行"]
}

step "注文完了画面への遷移" {
  desc "決済承認が完了し、モーダルを閉じて注文完了画面へ遷移します。"
  focus mod_pay, scr_done
  state mod_pay [status: muted, badge: ""]
  state shop_api [status: normal]
  state scr_done [status: active, badge: "COMPLETED"]
  animate mod_pay --> scr_done : "Navigate /complete" [color: #10b981, desc: "決済完了レスポンスを受け取り、モーダルを閉じて注文完了画面へ遷移"]
}
`,
  },
  {
    id: 'event-driven-async',
    name: 'マイクロサービス：非同期イベント駆動パイプライン',
    category: 'infra',
    description:
      'API Gateway・SQSキュー・Lambdaワーカー・S3ストレージによる非同期レポート生成フロー',
    dsl: `dav 1
title "非同期イベント駆動 レポート生成アーキテクチャ"

node user "クライアント画面" [icon: screen, sub: "管理ダッシュボード"]
node apigw "API Gateway" [icon: router, sub: "REST Endpoint"]

group async_core "非同期処理パイプライン" {
  node queue "SQS Queue" [icon: queue, sub: "ReportJobQueue"]
  node worker "Lambda Worker" [icon: function, sub: "PDF Generator"]
  node s3 "S3 Bucket" [icon: storage, sub: "Report Archive"]
}

user <--> apigw : "HTTPS / Polling"
apigw --> queue : "Enqueue Job"
queue --> worker : "Trigger Batch"
worker --> s3 : "PutObject (PDF)"
user -.-> s3 : "Signed URL DL" [id: e_dl, visible: false, color: #10b981]

step "ジョブ登録と即時受付応答 (202 Accepted)" {
  desc "重たいPDF生成処理を同期実行せず、SQSへジョブを投入して即座に 202 Accepted を返却します。"
  focus user, apigw, queue
  state queue [status: active, badge: "QUEUED: 1"]
  animate user --> apigw : "POST /reports" [color: #3b82f6, desc: "管理ダッシュボードから月次レポート生成リクエストをAPI Gatewayへ送信"]
  animate apigw --> queue : "SendMessage" [color: #a855f7, desc: "API GatewayからSQSへジョブメッセージをエンキューし、即座に受付完了を応答"]
}

step "非同期ワーカー起動とPDF生成・保存" {
  desc "SQSをトリガーにLambda Workerが起動し、レポートPDFを生成してS3バケットへ保存します。"
  focus queue, worker, s3
  state queue [status: normal, badge: ""]
  state worker [status: active, badge: "RUNNING"]
  state s3 [status: active, badge: "SAVED"]
  animate queue --> worker : "Invoke Worker" [color: #f59e0b, desc: "SQSイベントソースマッピングによりLambda Workerを非同期起動"]
  animate worker --> s3 : "PutObject report.pdf" [color: #14b8a6, desc: "生成したPDFファイルをS3バケットのアーカイブ領域へアップロード"]
}

step "署名付きURLによる直接ダウンロード" {
  desc "生成完了後、クライアントはS3のPresigned URLから直接PDFをダウンロードします。"
  focus user, s3
  state worker [status: normal, badge: ""]
  state s3 [status: normal, badge: ""]
  state e_dl [visible: true]
  state user [status: active, badge: "DOWNLOADED"]
  animate user -.-> s3 : "GET Presigned URL" [color: #10b981, desc: "APIサーバーを経由せず、S3の署名付きURLからブラウザへ直接PDFをダウンロード"]
}
`,
  },
  {
    id: 'enterprise-zero-trust-10anim',
    name: '大規模構成：ゼロトラスト決済 & AI不正検知基盤 (10アニメーション)',
    category: 'infra',
    description:
      '5グループ・14ノード構成でエッジ防御・OIDC認証・AI不正推論・分散Saga・外部決済まで10段階のアニメーションを再生する大規模サンプル',
    dsl: `dav 1
title "グローバルEC ゼロトラスト決済 & リアルタイム不正検知基盤 (10-Animation Flow)"

group client_edge "Client & Global Edge" [color: #38bdf8] {
  node mobile "Mobile App" [icon: mobile, sub: "iOS / Android (Passkey)"]
  node cdn "CloudFront CDN" [icon: cdn, sub: "Global Edge PoP"]
  node waf "AWS WAF & Shield" [icon: firewall, sub: "Bot Control / Rate ACL"]
}

group zero_trust "Zero-Trust Ingress & Identity" [color: #8b5cf6] {
  node apigw "API Gateway" [icon: router, sub: "mTLS / Token Guard"]
  node idp "Auth0 / OIDC IdP" [icon: user, sub: "FIDO2 / JWT Verify"]
}

group app_mesh "Core Microservices Mesh (EKS)" [color: #3b82f6] {
  node bff "Checkout BFF" [icon: container, sub: "GraphQL Orchestrator"]
  node fraud_ai "Fraud AI Engine" [icon: function, sub: "ML Risk Scoring (gRPC)"]
  node order_svc "Order Service" [icon: server, sub: "Saga Coordinator"]
  node pay_svc "Payment Service" [icon: container, sub: "PCI-DSS Isolated Pod"]
}

group data_platform "Stateful Data & Event Streaming" [color: #10b981] {
  node redis "ElastiCache Redis" [icon: cache, sub: "Idempotency & Cart Lock"]
  node aurora "Aurora PostgreSQL" [icon: database, sub: "Orders Ledger (Multi-AZ)"]
  node kafka "Amazon MSK (Kafka)" [icon: queue, sub: "Order & Audit Event Bus"]
  node s3_audit "Audit S3 Vault" [icon: storage, sub: "WORM Compliance Archive"]
}

group external_net "External Financial Network" [color: #f59e0b] {
  node stripe "Stripe / Card Net" [icon: external, sub: "3DS 2.0 / Acquirer GW"]
}

mobile --> cdn : "HTTPS (TLS 1.3)"
cdn --> waf : "Edge Inspect"
waf --> apigw : "Signed Origin"
apigw <--> idp : "JWKS / OIDC"
apigw --> bff : "GraphQL"
bff <--> redis : "Idempotency"
bff <--> fraud_ai : "Risk Check"
bff --> order_svc : "Start Saga"
order_svc --> aurora : "ACID Write"
order_svc --> pay_svc : "Capture Cmd"
pay_svc <--> stripe : "ISO8583 / REST"
pay_svc --> kafka : "PaymentEvent"
order_svc --> kafka : "OrderEvent"
kafka -.-> s3_audit : "Audit Sink"

step "エンドツーエンド決済・不正検知・オーケストレーション (10アニメーション)" {
  desc "モバイル端末からの決済要求がエッジ防御・ゼロトラスト認証・AI不正検知・分散Saga・外部カード決済・監査証跡保管まで10段階のアニメーションで処理されます。"
  focus mobile, cdn, waf, apigw, idp, bff, redis, fraud_ai, order_svc, aurora, pay_svc, stripe, kafka, s3_audit
  state waf [status: active, badge: "INSPECT"]
  state fraud_ai [status: active, badge: "SCORE: 0.02"]
  state aurora [status: active, badge: "COMMIT"]
  state pay_svc [status: active, badge: "AUTHORIZED"]
  state s3_audit [status: active, badge: "LOCKED"]
  animate mobile --> cdn : "1. POST /checkout" [color: #38bdf8, desc: "モバイルアプリから最寄りのCloudFrontエッジPoPへTLS 1.3で注文確定リクエストを送信"]
  animate cdn --> waf : "2. WAF Inspect" [color: #8b5cf6, desc: "AWS WAFでBotシグネチャ・IPレピュテーション・リクエストレート制限を検査"]
  animate waf --> apigw : "3. Origin mTLS" [color: #6366f1, desc: "検査を通過したリクエストにオリジン検証ヘッダを付与しAPI Gatewayへ転送"]
  animate apigw <--> idp : "4. Verify JWT" [color: #a855f7, desc: "OIDC IdPと連携し、Passkey署名付きJWTの有効期限・スコープ・端末バインディングを検証"]
  animate apigw --> bff : "5. Route BFF" [color: #3b82f6, desc: "認証済みユーザーコンテキストを付与してEKS内のCheckout BFFへルーティング"]
  animate bff <--> redis : "6. Lock Idempotency" [color: #ef4444, desc: "RedisクラスタでIdempotency-Keyを原子的にロックし、ネットワーク再送による二重決済を防止"]
  animate bff <--> fraud_ai : "7. AI Risk Check" [color: #06b6d4, desc: "Fraud AIエンジンへデバイス指紋・購買行動ベクトルを送り、12msで不正リスクスコアを推論"]
  animate bff --> order_svc : "8. Start Order Saga" [color: #10b981, desc: "リスク判定クリア後、Order Serviceを起動して分散トランザクション(Saga)を開始"]
  animate order_svc --> aurora : "9. INSERT Order" [color: #14b8a6, desc: "Aurora PostgreSQLプライマリへ注文レコードとOutboxイベントを単一トランザクションで保存"]
  animate order_svc --> pay_svc : "10. Capture & Audit" [color: #f59e0b, desc: "PCI-DSS分離セグメントのPayment ServiceからStripe与信枠の売上確定と監査イベント発行を実行"]
}

step "不正検知ブロックと補償トランザクション (異常系シナリオ)" {
  desc "AI不正検知または3Dセキュア検証で高リスクと判定された場合、即座にSaga補償処理を実行して注文をロールバックし、WAFブラックリストを更新します。"
  focus bff, fraud_ai, order_svc, aurora, kafka, s3_audit, waf
  state fraud_ai [status: error, badge: "HIGH RISK: 0.96"]
  state pay_svc [status: muted, badge: "SKIPPED"]
  state aurora [status: warning, badge: "ABORTED"]
  state waf [status: warning, badge: "BLOCKLISTED"]
  animate bff <--> fraud_ai : "1. Score 0.96 ( Fraud )" [color: #ef4444, desc: "異常なカード試行パターンを検知し、Fraud AIエンジンが高リスク判定(0.96)を返却"]
  animate bff --> order_svc : "2. Cancel Saga" [color: #f59e0b, desc: "Checkout BFFが決済処理を中断し、Order Serviceへ補償トランザクション(Cancel)を指示"]
  animate order_svc --> aurora : "3. UPDATE REJECTED" [color: #f59e0b, desc: "Aurora内の注文ステータスをREJECTEDへ更新し、仮引当在庫を即時解放"]
  animate order_svc --> kafka : "4. FraudAlertEvent" [color: #a855f7, desc: "セキュリティ監視トピックへ不正試行アラートイベントを非同期配信"]
  animate kafka -.-> s3_audit : "5. Write Forensics" [color: #14b8a6, desc: "改ざん防止(WORM)設定のAudit S3 Vaultへフォレンジック証跡ログを永続化"]
}
`,
  },
];

export const SAMPLES = SAMPLE_TEMPLATES;
export const DEFAULT_SAMPLE: SampleTemplate = SAMPLE_TEMPLATES[0] ?? {
  id: 'default',
  name: 'Default',
  category: 'infra',
  description: '',
  dsl: 'dav 1\n',
};
