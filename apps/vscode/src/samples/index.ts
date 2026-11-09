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
    name: 'Infrastructure: redundant web stack and database failover',
    category: 'infra',
    description:
      'CDN, load balancer, API, Redis cache and primary/standby databases, with normal traffic and a failover',
    dsl: `dav 1
title "AWS multi-AZ web architecture & database failover"

group edge_net "Edge & Security" {
  node cdn "CloudFront CDN" [icon: cdn, sub: "Edge Cache"]
  node waf "AWS WAF" [icon: firewall, sub: "Rate Limit / ACL"]
}

group vpc "Production VPC (us-east-1)" {
  node alb "Application LB" [icon: lb, sub: "Ingress HTTPS"]
  node api "Order API" [icon: container, sub: "ECS Fargate x4"]
  node redis "ElastiCache" [icon: cache, sub: "Redis Cluster"]
  node db_pri "Primary DB" [icon: database, sub: "Aurora Writer (AZ-a)"]
  node db_sby "Standby DB" [icon: database, sub: "Aurora Reader (AZ-c)", badge: "STANDBY"]
}

node client "Web Browser" [icon: browser, sub: "End user"]

client --> cdn : "HTTPS"
cdn --> waf : "Origin Fetch"
waf --> alb : "Verified"
alb --> api : "HTTP/2"
api --> redis : "Cache Lookup"
api --> db_pri : "Read / Write"
db_pri ..> db_sby : "Sync Replication"
api ..> db_sby : "Failover Route" [id: e_failover, visible: false, color: yellow]

step "Edge inspection and routing to the load balancer" {
  desc "CloudFront receives the request, and WAF inspects it before it is forwarded to the load balancer in the VPC."
  focus client, cdn, waf, alb
  animate client --> cdn : "GET /products" [desc: "The browser sends an HTTPS request to a CloudFront edge location"]
  animate cdn --> waf : "Inspect Request" [desc: "On a cache miss, AWS WAF checks ACL and rate-limit rules"]
  animate waf --> alb : "Pass ACL" [desc: "Only requests that pass inspection reach the load balancer"]
}

step "Fast response from the cache" {
  desc "The Order API checks Redis. On a cache hit, it responds without touching the database."
  focus alb, api, redis
  state redis [color: green, badge: "CACHE HIT"]
  animate alb --> api : "Forward" [desc: "The load balancer picks an ECS Fargate task from the target group"]
  animate api --> redis : "GET product:101" [desc: "Product data comes from memory in ElastiCache"]
}

step "Writing the order and replicating it" {
  desc "The order is written to the primary database and replicated to the standby."
  focus api, db_pri, db_sby
  state redis [color: none, badge: ""]
  state db_pri [color: green, badge: "COMMIT"]
  animate api --> db_pri : "INSERT INTO orders" [desc: "The order transaction commits on the primary in AZ-a"]
  animate db_pri --> db_sby : "Replicate WAL" [desc: "The write-ahead log is replicated to the standby in AZ-c"]
}

step "Primary failure and automatic failover" {
  desc "The primary database fails its health checks, so the standby is promoted to writer and traffic moves to it."
  focus api, db_pri, db_sby
  state db_pri [color: red, badge: "DOWN"]
  state db_sby [color: green, badge: "PROMOTED"]
  state e_failover [visible: true]
  animate api --> db_sby : "Reconnect Writer" [color: yellow, desc: "The cluster endpoint now resolves to the promoted standby"]
}
`,
  },
  {
    id: 'screen-flow-checkout',
    name: 'Screen flow with API calls: sign-in to checkout',
    category: 'screen',
    description: 'Screen transitions together with the backend calls behind them',
    dsl: `dav 1
title "Online store: screen flow and backend calls"

group frontend "Screens (SPA)" {
  node scr_login "Sign-in" [icon: screen, sub: "/login | Credentials form"]
  node scr_catalog "Catalog and cart" [icon: screen, sub: "/catalog | Stock and cart"]
  node mod_pay "Payment dialog" [icon: modal, sub: "Modal | Confirm card", visible: false]
  node scr_done "Order complete" [icon: screen, sub: "/complete | Order number"]
}

group backend "Backend and external services" {
  node auth_api "Auth Service" [icon: auth, sub: "JWT / OAuth"]
  node shop_api "Checkout API" [icon: server, sub: "Stock and orders"]
  node stripe "Stripe" [icon: external, sub: "External Payment API"]
}

scr_login --> scr_catalog : "After sign-in"
scr_catalog --> mod_pay : "Click Checkout"
mod_pay --> scr_done : "Paid"
scr_login --> auth_api : "POST /auth/login"
scr_catalog --> shop_api : "GET /items"
mod_pay --> shop_api : "POST /checkout"
shop_api --> stripe : "Charge API"

step "Signing in and getting a token" {
  desc "The user submits credentials. The Auth Service verifies them and issues a JWT, then the app opens the catalog."
  focus scr_login, auth_api, scr_catalog
  state scr_login [badge: "INPUT"]
  animate scr_login --> auth_api : "POST /auth/login" [desc: "The credentials are sent to the Auth Service in exchange for a JWT"]
  animate scr_login --> scr_catalog : "Redirect /catalog" [desc: "After sign-in, the SPA router opens the catalog"]
}

step "Loading products and opening the payment dialog" {
  desc "The catalog loads current stock from the API. Clicking Checkout opens the payment dialog."
  focus scr_catalog, shop_api, mod_pay
  state scr_login [badge: ""]
  state mod_pay [visible: true, badge: "OPEN"]
  animate scr_catalog --> shop_api : "GET /items (200 OK)" [desc: "The Checkout API returns the catalog and stock status"]
  animate scr_catalog --> mod_pay : "Open Modal" [desc: "The payment dialog opens over the catalog, without a page change"]
}

step "Charging the card" {
  desc "The user confirms the order. The Checkout API calls Stripe to authorize the payment."
  focus mod_pay, shop_api, stripe
  state mod_pay [badge: "PROCESSING"]
  animate mod_pay --> shop_api : "POST /checkout" [desc: "The payment token and order are sent, and a lock prevents double submission"]
  animate shop_api --> stripe : "POST /v1/charges" [desc: "The backend calls Stripe to charge the card"]
}

step "Showing the confirmation" {
  desc "The payment is approved, so the dialog closes and the confirmation page opens."
  focus mod_pay, scr_done
  state mod_pay [badge: ""]
  state scr_done [badge: "COMPLETED"]
  animate mod_pay --> scr_done : "Navigate /complete" [desc: "On success, the dialog closes and the confirmation page opens"]
}
`,
  },
  {
    id: 'event-driven-async',
    name: 'Microservices: event-driven async pipeline',
    category: 'infra',
    description: 'A queue, a worker and object storage for slow background jobs',
    dsl: `dav 1
title "Event-driven report generation"

node user "Client" [icon: screen, sub: "Admin dashboard"]
node apigw "API Gateway" [icon: router, sub: "REST Endpoint"]

group async_core "Async pipeline" {
  node queue "SQS Queue" [icon: queue, sub: "ReportJobQueue"]
  node worker "Lambda Worker" [icon: function, sub: "PDF Generator"]
  node s3 "S3 Bucket" [icon: storage, sub: "Report Archive"]
}

user <-> apigw : "HTTPS / Polling"
apigw --> queue : "Enqueue Job"
queue --> worker : "Trigger Batch"
worker --> s3 : "PutObject (PDF)"
user ..> s3 : "Signed URL DL" [id: e_dl, visible: false, color: green]

step "Accepting the job (202 Accepted)" {
  desc "PDF generation is too slow to run in the request, so the job goes to SQS and the API returns 202 Accepted."
  focus user, apigw, queue
  state queue [badge: "QUEUED: 1"]
  animate user --> apigw : "POST /reports" [desc: "The dashboard requests a monthly report"]
  animate apigw --> queue : "SendMessage" [desc: "API Gateway enqueues the job and responds right away"]
}

step "Generating and storing the PDF" {
  desc "SQS triggers the Lambda worker, which generates the PDF and stores it in S3."
  focus queue, worker, s3
  state queue [badge: ""]
  state worker [badge: "RUNNING"]
  state s3 [badge: "SAVED"]
  animate queue --> worker : "Invoke Worker" [desc: "An SQS event source mapping starts the worker"]
  animate worker --> s3 : "PutObject report.pdf" [desc: "The finished PDF is uploaded to the archive bucket"]
}

step "Downloading with a signed URL" {
  desc "When the report is ready, the client downloads it directly from S3 with a presigned URL."
  focus user, s3
  state worker [badge: ""]
  state s3 [badge: ""]
  state e_dl [visible: true]
  state user [badge: "DOWNLOADED"]
  animate user --> s3 : "GET Presigned URL" [desc: "The browser downloads the PDF from S3 without going through the API"]
}
`,
  },
  {
    id: 'enterprise-zero-trust-10anim',
    name: 'Large system: zero-trust payments and AI fraud detection',
    category: 'infra',
    description: 'A long flow across five zones, with a fraud case that rolls back',
    dsl: `dav 1
title "Global commerce: zero-trust payments and real-time fraud detection"

group client_edge "Client & Global Edge" [color: teal] {
  node mobile "Mobile App" [icon: mobile, sub: "iOS / Android (Passkey)"]
  node cdn "CloudFront CDN" [icon: cdn, sub: "Global Edge PoP"]
  node waf "AWS WAF & Shield" [icon: firewall, sub: "Bot Control / Rate ACL"]
}

group zero_trust "Zero-Trust Ingress & Identity" [color: purple] {
  node apigw "API Gateway" [icon: router, sub: "mTLS / Token Guard"]
  node idp "Auth0 / OIDC IdP" [icon: auth, sub: "FIDO2 / JWT Verify"]
}

group app_mesh "Core Microservices Mesh (EKS)" [color: blue] {
  node bff "Checkout BFF" [icon: container, sub: "GraphQL Orchestrator"]
  node fraud_ai "Fraud AI Engine" [icon: ai, sub: "ML Risk Scoring (gRPC)"]
  node order_svc "Order Service" [icon: server, sub: "Saga Coordinator"]
  node pay_svc "Payment Service" [icon: container, sub: "PCI-DSS Isolated Pod"]
}

group data_platform "Stateful Data & Event Streaming" [color: green] {
  node redis "ElastiCache Redis" [icon: cache, sub: "Idempotency & Cart Lock"]
  node aurora "Aurora PostgreSQL" [icon: database, sub: "Orders Ledger (Multi-AZ)"]
  node kafka "Amazon MSK (Kafka)" [icon: queue, sub: "Order & Audit Event Bus"]
  node s3_audit "Audit S3 Vault" [icon: storage, sub: "WORM Compliance Archive"]
}

group external_net "External Financial Network" [color: yellow] {
  node stripe "Stripe / Card Net" [icon: external, sub: "3DS 2.0 / Acquirer GW"]
}

mobile --> cdn : "HTTPS (TLS 1.3)"
cdn --> waf : "Edge Inspect"
waf --> apigw : "Signed Origin"
apigw <-> idp : "JWKS / OIDC"
apigw --> bff : "GraphQL"
bff <-> redis : "Idempotency"
bff <-> fraud_ai : "Risk Check"
bff --> order_svc : "Start Saga"
order_svc --> aurora : "ACID Write"
order_svc --> pay_svc : "Capture Cmd"
pay_svc <-> stripe : "ISO8583 / REST"
pay_svc --> kafka : "PaymentEvent"
order_svc --> kafka : "OrderEvent"
kafka ..> s3_audit : "Audit Sink"

step "End-to-end payment in ten animations" {
  desc "A payment from the mobile app passes through edge protection, zero-trust authentication, AI fraud checks, a distributed saga, and the card network."
  focus mobile, cdn, waf, apigw, idp, bff, redis, fraud_ai, order_svc, aurora, pay_svc, stripe, kafka, s3_audit
  state waf [badge: "INSPECT"]
  state fraud_ai [color: green, badge: "SCORE: 0.02"]
  state aurora [color: green, badge: "COMMIT"]
  state pay_svc [color: green, badge: "AUTHORIZED"]
  state s3_audit [badge: "LOCKED"]
  animate mobile --> cdn : "1. POST /checkout" [desc: "The app sends the order to the nearest CloudFront edge over TLS 1.3"]
  animate cdn --> waf : "2. WAF Inspect" [desc: "AWS WAF checks bot signatures, IP reputation and rate limits"]
  animate waf --> apigw : "3. Origin mTLS" [desc: "Requests that pass get an origin verification header and go to API Gateway"]
  animate apigw <-> idp : "4. Verify JWT" [desc: "The IdP verifies the expiry, scope and device binding of the passkey-signed JWT"]
  animate apigw --> bff : "5. Route BFF" [desc: "The authenticated user context is attached and the request reaches the Checkout BFF"]
  animate bff <-> redis : "6. Lock Idempotency" [desc: "Redis atomically locks the idempotency key, preventing a double charge on retries"]
  animate bff <-> fraud_ai : "7. AI Risk Check" [desc: "The fraud engine scores device fingerprint and purchase behavior in 12 ms"]
  animate bff --> order_svc : "8. Start Order Saga" [desc: "With the risk check passed, the Order Service starts the distributed transaction"]
  animate order_svc --> aurora : "9. INSERT Order" [desc: "The order and its outbox event are saved in a single transaction"]
  animate order_svc --> pay_svc : "10. Capture & Audit" [desc: "The isolated Payment Service captures the charge and emits the audit event"]
}

step "Blocking fraud with a compensating transaction" {
  desc "When a payment is judged high risk, the saga compensates at once: the order is rolled back and the WAF blocklist is updated."
  focus bff, fraud_ai, order_svc, aurora, kafka, s3_audit, waf
  state fraud_ai [color: red, badge: "HIGH RISK: 0.96"]
  state pay_svc [color: gray, badge: "SKIPPED"]
  state aurora [color: yellow, badge: "ABORTED"]
  state waf [color: red, badge: "BLOCKLISTED"]
  animate bff <-> fraud_ai : "1. Score 0.96 ( Fraud )" [color: red, desc: "The engine detects an abnormal card pattern and returns a high risk score"]
  animate bff --> order_svc : "2. Cancel Saga" [color: red, desc: "The BFF stops the payment and tells the Order Service to compensate"]
  animate order_svc --> aurora : "3. UPDATE REJECTED" [color: red, desc: "The order is marked REJECTED and reserved stock is released"]
  animate order_svc --> kafka : "4. FraudAlertEvent" [color: red, desc: "A fraud alert is published to the security monitoring topic"]
  animate kafka --> s3_audit : "5. Write Forensics" [color: red, desc: "Forensic logs are stored in the write-once audit vault"]
}
`,
  },
  {
    id: 'sequence-payment-retry',
    name: 'Sequence: payment retries and async delivery',
    category: 'infra',
    description:
      'Rate limiting, retries with backoff, and a dead letter queue, with icons on packets',
    dsl: `dav 1
title "Order payment sequence: rate limiting, retries and async delivery"

node client "Web Client" [icon: browser, sub: "Customer"]

group edge_layer "Edge" [color: teal] {
  node gw "API Gateway" [icon: router, sub: "Auth and rate limits"]
}

group core "Orders and payments" [color: blue] {
  node order "Order Service" [icon: container, sub: "Saga Orchestrator"]
  node payment "Payment Service" [icon: function, sub: "Runs payments"]
  node stock "Inventory" [icon: database, sub: "Stock reservation"]
  node psp "Payment provider" [icon: external, sub: "PSP API"]
}

group async "Async processing" [color: purple] {
  node queue "Event Queue" [icon: queue, sub: "OrderEvents"]
  node worker "Fulfillment Worker" [icon: server, sub: "Shipping"]
  node dlq "Dead Letter Queue" [icon: storage, sub: "Needs review", visible: false]
}

client --> gw : "POST /orders"
gw --> client : "Response"
gw --> gw : "Rate check"
gw --> order : "CreateOrder"
order --> gw : "Result"
order --> order : "Transition"
order --> stock : "Reserve"
stock --> order : "Reserved"
order --> payment : "Charge"
payment --> order : "Charged"
payment --> payment : "Backoff"
payment --> psp : "Authorize"
psp --> payment : "Result"
order ..> queue : "OrderConfirmed"
queue --> worker : "Deliver"
worker --> worker : "Retry"
worker ..> dlq : "Quarantine" [id: e_dlq, visible: false, color: red]

step "Accepting the order and limiting the rate" {
  desc "The gateway checks its rate limit counter, then forwards the order to the Order Service."
  state gw [badge: "98 req/s"]
  animate client --> gw : "POST /orders" [icon: file, desc: "The customer submits an order"]
  animate gw --> gw : "Rate Check" [color: teal, desc: "The token bucket decides whether to allow the request"]
  animate gw --> order : "CreateOrder" [icon: file, desc: "The authenticated order is forwarded"]
}

step "Creating the order and reserving stock" {
  desc "The Order Service moves the order to PENDING and reserves stock."
  state gw [badge: ""]
  state order [badge: "PENDING", color: yellow]
  animate order --> order : "→ PENDING" [color: yellow, desc: "The saga starts and the order becomes PENDING"]
  animate order --> stock : "Reserve" [icon: database, desc: "Stock is reserved for each item"]
  animate stock --> order : "Reserved" [color: green, desc: "Every item was reserved"]
}

step "A temporary payment failure" {
  desc "The payment provider returns 503. The Payment Service does not give up, and switches to retrying."
  state stock [badge: "HOLD", color: green]
  state psp [badge: "503", color: red]
  animate order --> payment : "Charge" [icon: payment, desc: "With stock reserved, payment is requested"]
  animate payment --> psp : "Authorize" [icon: payment, desc: "The provider is asked to authorize the charge"]
  animate psp --> payment : "503" [color: red, desc: "The provider is temporarily unavailable"]
}

step "Backoff and first retry" {
  desc "After one second, the request is sent again with the same idempotency key. The outage continues."
  state payment [badge: "RETRY 1", color: orange]
  animate payment --> payment : "Wait 1s" [color: orange, desc: "Waits before the first retry"]
  animate payment --> psp : "Retry #1" [icon: payment, desc: "Sent again with the same idempotency key"]
  animate psp --> payment : "503" [color: red, desc: "The outage continues"]
}

step "Backoff and second retry" {
  desc "The wait doubles to two seconds, and this time the payment succeeds."
  state payment [badge: "RETRY 2"]
  state psp [badge: "200", color: green]
  animate payment --> payment : "Wait 2s" [color: orange, desc: "Doubles the wait before retrying"]
  animate payment --> psp : "Retry #2" [icon: payment, desc: "Sent again with the same idempotency key"]
  animate psp --> payment : "200 OK" [color: green, desc: "The charge is authorized"]
}

step "Confirming the order and responding" {
  desc "The order is confirmed. The customer's response and the event are sent at the same time."
  state psp [badge: "", color: none]
  state payment [badge: "PAID", color: green]
  state order [badge: "CONFIRMED", color: green]
  animate payment --> order : "Charged" [color: green, desc: "Reports that payment is complete"]
  animate order --> order : "→ CONFIRMED" [color: green, desc: "The order becomes CONFIRMED"]
  animate order --> gw : "201 Created" [desc: "Returns the created order"]
  animate order --> queue : "OrderConfirmed" [icon: mail, parallel: true, color: purple, desc: "Publishes an event for fulfillment"]
  animate gw --> client : "201 Created" [desc: "Tells the customer the order is complete"]
}

step "Asynchronous fulfillment" {
  desc "The worker receives the event from the queue, and retries on its own if the warehouse API fails."
  state queue [badge: "1 msg"]
  state worker [badge: "RUNNING", color: orange]
  animate queue --> worker : "Deliver" [icon: mail, color: purple, desc: "The event is delivered to the worker"]
  animate worker --> worker : "Attempt 1..3" [color: orange, desc: "Calls the warehouse API up to three times"]
}

step "Giving up and quarantining" {
  desc "An event that fails all three attempts goes to the dead letter queue, so it does not block the queue."
  state queue [badge: ""]
  state worker [badge: "FAILED", color: red]
  state dlq [visible: true, badge: "1 msg", color: red]
  state e_dlq [visible: true]
  animate worker --> dlq : "Quarantine" [icon: mail, color: red, desc: "The failed event is set aside for review"]
}
`,
  },
  {
    id: 'lan-office-network',
    name: 'Office LAN: site-to-site VPN and link failover',
    category: 'infra',
    description: 'Switches, Wi-Fi, a printer and a file server, with a VPN and failover to LTE',
    dsl: `dav 1
title "Office LAN: site-to-site VPN and link failover"

group office "Head office LAN (192.168.10.0/24)" {
  node pc "Desktop PC" [icon: desktop, sub: "Wired / VLAN 10"]
  node tablet "Tablet" [icon: mobile, sub: "Office Wi-Fi"]
  node ap "Access point" [icon: wifi, sub: "SSID: corp-wifi"]
  node floor "Floor switch" [icon: hub, sub: "PoE 24-port"]
  node printer "Printer" [icon: printer, sub: "192.168.10.50"]
  node core "Core switch" [icon: hub, sub: "VLAN 10 / 20"]
  node nas "File server" [icon: storage, sub: "NAS / RAID 6"]
  node utm "UTM" [icon: firewall, sub: "192.168.10.1"]
}

node wan "Internet VPN" [icon: cloud, sub: "IPsec"]
node lte "LTE router" [icon: router, sub: "Backup link", visible: false]
node dc "Data center" [icon: building, sub: "Off-site backup"]

group branch "Branch office (192.168.20.0/24)" {
  node branch_gw "Branch router" [icon: router, sub: "VPN endpoint"]
  node branch_pc "Branch PC" [icon: desktop, sub: "Wired"]
}

pc <-> floor : "1GbE"
tablet <.> ap : "Wi-Fi 6"
ap <-> floor : "PoE"
floor <-> printer : "IPP"
floor <-> core : "Uplink"
core <-> nas : "10GbE"
core <-> utm : "Default GW"
utm <-> wan : "Fiber" [id: e_main]
utm <.> lte : "Failover" [id: e_lte_up, visible: false, color: yellow]
lte <.> wan : "Mobile link" [id: e_lte_wan, visible: false, color: yellow]
wan --> dc : "Backup"
wan <-> branch_gw : "IPsec"
branch_gw <-> branch_pc : "LAN"

step "Printing from a wired PC" {
  desc "Traffic on one floor stays inside the floor switch, and never reaches the core switch or the UTM."
  focus pc, floor, printer
  state printer [color: green, badge: "PRINT"]
  animate pc --> floor : "Print Job" [desc: "The PC sends the print data to the floor switch"]
  animate floor --> printer : "IPP" [desc: "The switch reads the destination MAC address and forwards to the printer's port only"]
}

step "Opening the file server over Wi-Fi" {
  desc "The tablet reaches the file server through the access point, the floor switch and the core switch."
  focus tablet, ap, floor, core, nas
  state printer [color: none, badge: ""]
  state nas [color: green, badge: "SMB"]
  animate tablet --> ap : "WPA3" [desc: "The tablet joins the office SSID over encrypted Wi-Fi"]
  animate ap --> floor : "Bridge" [desc: "Wireless frames are bridged to the wired LAN"]
  animate floor --> core : "VLAN 10" [desc: "Tagged frames are forwarded to the core switch"]
  animate core <-> nas : "SMB Read" [desc: "The core routes between VLANs and reads from the file server"]
}

step "Reaching the file server from the branch" {
  desc "A PC at the branch uses the file server on the head office LAN through the site-to-site VPN."
  focus branch_pc, branch_gw, wan, utm, core, nas
  animate branch_pc --> branch_gw : "SMB" [desc: "Traffic for the head office goes to the branch router"]
  animate branch_gw --> wan : "ESP" [desc: "IPsec encrypts it and sends it over the internet"]
  animate wan --> utm : "ESP" [desc: "The UTM at the head office ends the tunnel and decrypts"]
  animate utm --> core : "Inspected" [desc: "Only traffic allowed by policy enters the LAN"]
  animate core <-> nas : "SMB Read" [desc: "The file server's response returns the same way"]
}

step "Nightly backup to the data center" {
  desc "At night, changes on the file server are copied to the data center over the VPN."
  focus nas, core, utm, wan, dc
  state nas [color: blue, badge: "BACKUP"]
  state dc [color: blue, badge: "SYNC"]
  animate nas --> core : "Snapshot" [desc: "Sends the day's incremental snapshot"]
  animate core --> utm : "Backup VLAN" [desc: "Forwards to the UTM on the backup VLAN"]
  animate utm --> wan : "ESP" [desc: "Encrypts and sends toward the data center"]
  animate wan --> dc : "Replicate" [desc: "Copies to off-site storage"]
}

step "The fiber link fails and the VPN drops" {
  desc "The UTM detects the failure. Traffic to the branch and data center stops, while the office LAN keeps working."
  focus utm, wan, branch_gw, dc
  state nas [color: none, badge: ""]
  state dc [color: red, badge: "UNREACHABLE"]
  state e_main [color: red]
  state utm [color: red, badge: "WAN DOWN"]
  state branch_gw [color: red, badge: "VPN DOWN"]
  animate utm --> wan : "Keepalive" [color: red, desc: "Keepalive replies stop, so the UTM declares the link down"]
}

step "Automatic failover to LTE" {
  desc "The UTM routes through the LTE router and rebuilds the VPN. Backups stay paused because the bandwidth is low."
  focus utm, lte, wan, branch_gw
  state lte [visible: true, color: yellow, badge: "ACTIVE"]
  state e_lte_up [visible: true]
  state e_lte_wan [visible: true]
  state utm [color: yellow, badge: "FAILOVER"]
  state branch_gw [color: green, badge: "VPN UP"]
  animate utm --> lte : "Route Change" [color: yellow, desc: "The default route moves to the LTE router"]
  animate lte --> wan : "IKE" [color: yellow, desc: "The VPN is negotiated again over the mobile link"]
  animate wan --> branch_gw : "Tunnel Up" [color: yellow, desc: "The tunnel to the branch router is back"]
}

step "The fiber link recovers" {
  desc "With the main link back, the route returns to it and LTE goes back on standby. Paused backups resume."
  focus utm, wan, branch_gw, dc
  state lte [visible: false, color: none, badge: ""]
  state e_lte_up [visible: false]
  state e_lte_wan [visible: false]
  state e_main [color: none]
  state utm [color: green, badge: "NORMAL"]
  state branch_gw [color: none, badge: ""]
  state dc [color: none, badge: ""]
  animate utm --> wan : "Failback" [color: green, desc: "Confirms the main link and moves the route back"]
  animate wan --> branch_gw : "Tunnel Up" [desc: "The tunnel returns to the fiber link"]
  animate wan --> dc : "Resume" [desc: "The paused incremental backup resumes", parallel: true]
}
`,
  },
  {
    id: 'dynamic-architect-viewer',
    name: 'Software pipeline: DSL parsing, live preview and HTML export',
    category: 'infra',
    description:
      'How this extension turns a .dav file into a live preview and a standalone HTML file',
    dsl: `dav 1
title "DynamicArchitectViewer: DSL parsing, auto layout, live preview and HTML export"

group vscode_host "VS Code Extension Host" [color: teal] {
  node editor ".dav Editor" [icon: file, sub: "TextDocument / Diagnostics"]
  node ext "Extension Host" [icon: runtime, sub: "extension/extension.ts"]
}

group core_pipeline "DSL & Layout" [color: blue] {
  node dsl "DSL Parser" [icon: logic, sub: "dsl/ (Lezer LR / SourceMap)"]
  node layout "Auto Layout" [icon: sheet, sub: "layout/ (computeLayout)"]
}

group scene_runtime "Scene & Runtime" [color: purple] {
  node scene "Scene Builder" [icon: function, sub: "scene/ (resolveView / buildScene)"]
  node player "SVG Player" [icon: monitor, sub: "runtime/player.ts"]
}

group outputs "Preview & HTML Output" [color: green] {
  node webview "Preview Webview" [icon: screen, sub: "editor/App.ts"]
  node exporter "HTML Exporter" [icon: storage, sub: "exporter/ (SHA-256 CSP)"]
  node html_out "Standalone HTML" [icon: browser, sub: "#dav-data + player.js", visible: false]
}

editor <-> ext : "Edit / Diagnostics"
ext <-> dsl : "parse / format"
dsl --> dsl : "Lezer LR Parse"
dsl --> layout : "DavDocument"
layout --> layout : "Crossing Reduction"
layout --> scene : "Layout (Rect)"
scene --> player : "VElement (Virtual SVG)"
player --> player : "Phase Playback"
player <-> webview : "Render / Cursor Sync"
player --> exporter : "player.js / CSS"
exporter --> html_out : "exportHtml" [id: e_export, visible: false, color: green]
html_out ..> exporter : "importContent" [id: e_import, visible: false, color: teal]

step "Editing a .dav file and running language diagnostics" {
  desc "When the .dav file changes in the editor, the extension host parses the syntax tree with Lezer and updates diagnostics, Quick Fixes, completions and outline symbols."
  state editor [badge: "EDITING", color: teal]
  state dsl [badge: "PARSE", color: blue]
  animate editor --> ext : "onDidChangeTextDocument" [icon: file, desc: "The editor notifies the extension host that the document text changed"]
  animate ext --> dsl : "parse(text)" [icon: file, desc: "The extension host passes the .dav source to the DSL module"]
  animate dsl --> dsl : "analyze (AST)" [color: blue, desc: "The Lezer grammar builds the syntax tree and produces DavDocument, Diagnostics and SourceMap"]
  animate dsl --> ext : "Diagnostics / Completions" [color: teal, desc: "Diagnostics, Quick Fix suggestions and completion items are returned"]
  animate ext --> editor : "set(uri, diagnostics)" [color: teal, desc: "Squiggles, Quick Fixes and document symbols are updated in the editor"]
}

step "Computing the layout and reducing edge crossings" {
  desc "computeLayout assigns columns from the longest edge paths, places groups and rows, and runs up to 16 barycenter passes to minimize crossings."
  state editor [badge: "", color: none]
  state dsl [badge: "VALID", color: green]
  state layout [badge: "RANK & ORDER", color: blue]
  animate dsl --> layout : "DavDocument" [icon: sheet, desc: "The validated nodes, groups and edges are passed to the layout engine"]
  animate layout --> layout : "Barycenter (up to 16x)" [color: blue, desc: "Columns come from longest paths, then rows are reordered to reduce edge crossings"]
}

step "Resolving the step scene and rendering the live preview" {
  desc "resolveView computes cumulative step state, Bezier rails and callout boxes, then buildScene creates the virtual SVG tree that Player mounts in the webview."
  state dsl [badge: "", color: none]
  state layout [badge: "", color: none]
  state scene [badge: "RESOLVED", color: purple]
  state player [badge: "MOUNTED", color: purple]
  state webview [badge: "LIVE PREVIEW", color: green]
  animate layout --> scene : "Layout (Rect)" [icon: sheet, desc: "Deterministic node and group rectangles are passed to the scene module"]
  animate scene --> player : "resolveView → buildScene" [icon: function, color: purple, desc: "Cumulative state, rail geometry and callouts become a virtual SVG tree (VElement)"]
  animate player --> webview : "createElementNS (SVG)" [icon: monitor, color: green, desc: "Player renders the SVG into the preview webview via DOM APIs without innerHTML"]
}

step "Playing step animations and syncing the cursor" {
  desc "During playback, Player animates packets phase by phase while syncing cursor highlights and double-click jumps with the editor."
  state scene [badge: "", color: none]
  state player [badge: "PLAYING", color: green]
  state webview [badge: "SYNCED", color: teal]
  animate webview <-> player : "play() / goTo(step)" [color: green, desc: "Moving the editor cursor jumps to the matching step and highlights the active element"]
  animate player --> player : "Phase / Parallel" [color: purple, desc: "Animations run in phase order, with parallel: true joining the preceding phase"]
  animate player --> webview : "dblclick [data-id]" [icon: search, color: teal, desc: "Double-clicking a node looks up its SourceMap span and posts revealRange to the editor"]
}

step "Exporting a standalone HTML file" {
  desc "exportHtml embeds the parsed document, layout, used icons and runtime player into a single HTML file locked down by a SHA-256 Content Security Policy."
  state player [badge: "", color: none]
  state webview [badge: "", color: none]
  state exporter [badge: "BUNDLE", color: green]
  state html_out [visible: true, badge: "EXPORTED", color: green]
  state e_export [visible: true]
  animate player --> exporter : "player.js / CSS" [icon: file, desc: "The prebuilt player runtime and stylesheet are supplied for inlining"]
  animate exporter --> html_out : "exportHtml(dsl)" [icon: key, color: green, desc: "Writes a self-contained HTML file with escaped #dav-data JSON and SHA-256 CSP hashes"]
}

step "Re-importing the .dav source from exported HTML" {
  desc "importContent reads the #dav-data JSON block without executing the HTML page and restores the original .dav text."
  state html_out [badge: "READ", color: teal]
  state exporter [badge: "EXTRACTED", color: teal]
  state e_import [visible: true]
  animate html_out --> exporter : "importContent(html)" [icon: file, color: teal, desc: "Extracts payload.dsl from the embedded #dav-data script element without evaluating scripts"]
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
