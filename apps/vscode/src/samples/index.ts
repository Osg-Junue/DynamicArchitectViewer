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

group edge_net "Edge & Security" @pos(250, 50) @size(210, 380) {
  node cdn "CloudFront CDN" [icon: cdn, sub: "Edge Cache"] @pos(275, 110)
  node waf "AWS WAF" [icon: firewall, sub: "Rate Limit / ACL"] @pos(275, 290)
}

group vpc "Production VPC (ap-northeast-1)" @pos(500, 30) @size(690, 440) {
  node alb "Application LB" [icon: lb, sub: "Ingress HTTPS"] @pos(530, 200)
  node api "Order API" [icon: container, sub: "ECS Fargate x4"] @pos(750, 200)
  node redis "ElastiCache" [icon: cache, sub: "Redis Cluster"] @pos(980, 75)
  node db_pri "Primary DB" [icon: database, sub: "Aurora Writer (AZ-a)"] @pos(980, 200)
  node db_sby "Standby DB" [icon: database, sub: "Aurora Reader (AZ-c)", status: muted, badge: "STANDBY"] @pos(980, 340)
}

node client "Web Browser" [icon: browser, sub: "エンドユーザー"] @pos(30, 200)

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
  animate client --> cdn : "GET /products" [color: #38bdf8]
  animate cdn --> waf : "Inspect Request" [color: #8b5cf6]
  animate waf --> alb : "Pass ACL" [color: #6366f1]
}

step "キャッシュヒットによる高速応答" {
  desc "Order APIがRedisを参照し、キャッシュヒットした場合はDBへアクセスせず即座にレスポンスを返します。"
  focus alb, api, redis
  state redis [status: active, badge: "CACHE HIT"]
  animate alb --> api : "Forward" [color: #3b82f6]
  animate api --> redis : "GET product:101" [color: #ef4444]
}

step "注文トランザクションの書き込みとDB同期" {
  desc "注文確定リクエスト（POST）はPrimary DBへ書き込まれ、Standby DBへレプリケーションされます。"
  focus api, db_pri, db_sby
  state redis [status: normal, badge: ""]
  state db_pri [status: active, badge: "COMMIT"]
  animate api --> db_pri : "INSERT INTO orders" [color: #10b981]
  animate db_pri -.-> db_sby : "Replicate WAL" [color: #14b8a6]
}

step "Primary DB障害発生と自動フェイルオーバー" {
  desc "Primary DBで障害が発生。ヘルスチェック失敗を検知し、Standby DBをWriterに昇格させて経路を自動切替します。"
  focus api, db_pri, db_sby
  state db_pri [status: error, badge: "DOWN"]
  state db_sby [status: active, badge: "PROMOTED"]
  state e_failover [visible: true]
  animate api -.-> db_sby : "Reconnect Writer" [color: #f59e0b]
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

group frontend "フロントエンド画面遷移 (SPA)" @pos(40, 40) @size(890, 240) {
  node scr_login "ログイン画面" [icon: screen, sub: "/login | ID・PW入力フォーム"] @pos(70, 100)
  node scr_catalog "商品一覧・カート画面" [icon: screen, sub: "/catalog | カート追加・在庫表示"] @pos(300, 100)
  node mod_pay "決済確認モーダル" [icon: modal, sub: "Modal | クレジットカード確認", visible: false] @pos(530, 100)
  node scr_done "注文完了画面" [icon: screen, sub: "/complete | 注文番号表示", status: muted] @pos(720, 100)
}

group backend "バックエンド & 外部連携" @pos(140, 330) @size(720, 170) {
  node auth_api "Auth Service" [icon: firewall, sub: "JWT発行 / OAuth"] @pos(180, 390)
  node shop_api "Checkout API" [icon: server, sub: "在庫引当・注文管理"] @pos(420, 390)
  node stripe "Stripe決済GW" [icon: external, sub: "External Payment API"] @pos(650, 390)
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
  animate scr_login --> auth_api : "POST /auth/login" [color: #3b82f6]
  animate scr_login --> scr_catalog : "Redirect /catalog" [color: #10b981]
}

step "商品一覧取得と決済モーダル表示" {
  desc "商品一覧画面で最新在庫をAPIから取得。ユーザーが「購入へ進む」を押すと決済確認モーダルが立ち上がります。"
  focus scr_catalog, shop_api, mod_pay
  state scr_login [status: normal, badge: ""]
  state scr_catalog [status: active]
  state mod_pay [visible: true, status: active, badge: "OPEN"]
  animate scr_catalog --> shop_api : "GET /items (200 OK)" [color: #06b6d4]
  animate scr_catalog --> mod_pay : "Open Modal" [color: #a855f7]
}

step "決済実行と外部決済GW連携" {
  desc "決済モーダルで「注文確定」を押下。Checkout APIがStripe決済GWと通信して与信枠を確保します。"
  focus mod_pay, shop_api, stripe
  state scr_catalog [status: normal]
  state mod_pay [status: warning, badge: "PROCESSING"]
  state shop_api [status: active]
  animate mod_pay --> shop_api : "POST /checkout" [color: #f59e0b]
  animate shop_api --> stripe : "POST /v1/charges" [color: #6366f1]
}

step "注文完了画面への遷移" {
  desc "決済承認が完了し、モーダルを閉じて注文完了画面へ遷移します。"
  focus mod_pay, scr_done
  state mod_pay [status: muted, badge: ""]
  state shop_api [status: normal]
  state scr_done [status: active, badge: "COMPLETED"]
  animate mod_pay --> scr_done : "Navigate /complete" [color: #10b981]
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

node user "クライアント画面" [icon: screen, sub: "管理ダッシュボード"] @pos(40, 190)
node apigw "API Gateway" [icon: router, sub: "REST Endpoint"] @pos(270, 190)

group async_core "非同期処理パイプライン" @pos(480, 50) @size(460, 360) {
  node queue "SQS Queue" [icon: queue, sub: "ReportJobQueue"] @pos(510, 190)
  node worker "Lambda Worker" [icon: function, sub: "PDF Generator"] @pos(730, 120)
  node s3 "S3 Bucket" [icon: storage, sub: "Report Archive"] @pos(730, 270)
}

apigw <--> user : "HTTPS / Polling"
apigw --> queue : "Enqueue Job"
queue --> worker : "Trigger Batch"
worker --> s3 : "PutObject (PDF)"
user -.-> s3 : "Signed URL DL" [id: e_dl, visible: false, color: #10b981]

step "ジョブ登録と即時受付応答 (202 Accepted)" {
  desc "重たいPDF生成処理を同期実行せず、SQSへジョブを投入して即座に 202 Accepted を返却します。"
  focus user, apigw, queue
  state queue [status: active, badge: "QUEUED: 1"]
  animate user --> apigw : "POST /reports" [color: #3b82f6]
  animate apigw --> queue : "SendMessage" [color: #a855f7]
}

step "非同期ワーカー起動とPDF生成・保存" {
  desc "SQSをトリガーにLambda Workerが起動し、レポートPDFを生成してS3バケットへ保存します。"
  focus queue, worker, s3
  state queue [status: normal, badge: ""]
  state worker [status: active, badge: "RUNNING"]
  state s3 [status: active, badge: "SAVED"]
  animate queue --> worker : "Invoke Worker" [color: #f59e0b]
  animate worker --> s3 : "PutObject report.pdf" [color: #14b8a6]
}

step "署名付きURLによる直接ダウンロード" {
  desc "生成完了後、クライアントはS3のPresigned URLから直接PDFをダウンロードします。"
  focus user, s3
  state worker [status: normal, badge: ""]
  state s3 [status: normal, badge: ""]
  state e_dl [visible: true]
  state user [status: active, badge: "DOWNLOADED"]
  animate user -.-> s3 : "GET Presigned URL" [color: #10b981]
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
