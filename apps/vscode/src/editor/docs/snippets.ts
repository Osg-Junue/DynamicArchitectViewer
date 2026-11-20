import type { DiagnosticCode } from '../../dsl';
import { COLOR_NAMES, type ColorName } from '../../model/types';

/**
 * Every DSL v2 example shown in the documentation. They are compiled by the real parser when
 * displayed, and `docs.test.ts` keeps them free of diagnostics.
 */

export const OVERVIEW_DSL = `title "Order flow"

// Structure: what exists
node client "Browser" [icon: browser]
group backend "Backend" [color: blue] {
  node api "API" [icon: container]
  node db "Orders DB" [icon: database]
}

// Scenario: what happens, step by step
step "Place an order" {
  desc "The browser sends the order to the API."
  animate client --> api : "POST /orders"
}

step "Save it" {
  desc "The API writes the order and marks the DB."
  state db [badge: "WRITE", color: green]
  animate api --> db : "INSERT"
}`;

export const BASICS_DSL = `title "Diagram title"     // optional, once

node web "Web"            // a label is optional
node db                   // label falls back to the ID

step "Connect" {
  static web --> db : "a \\"quoted\\" word"
}`;

export const GROUPS_DSL = `group vpc "VPC" [color: blue] {
  group public "Public subnet" [color: green] {
    node lb "Load balancer" [icon: lb]
  }
  group private "Private subnet" {
    node app "App" [icon: container]
  }
}

step "Route traffic" {
  animate lb --> app : "HTTP"
}`;

export const EDGE_STEPS_DSL = `node a "Service A"
node b "Service B"
node c "Backup" [icon: database]

step "Opposite directions" {
  desc "Connections in opposite directions share one merged overview rail."
  animate a --> b : "request"
  animate b --> a : "callback"
}

step "Static fallback link" {
  desc "static draws a non-moving relationship for this step only."
  static a ..> c : "fallback" [color: orange]
}`;

export const STEPS_DSL = `node a "Web" [icon: browser]
node b "API" [icon: container]
node c "DB" [icon: database]

step "Call the API" {
  desc "Each step has its own narrative."
  desc "Several desc lines become several lines."
  animate a --> b : "request"
}

step "Step-local state" {
  desc "A state override applies to this step only."
  state c [badge: "BUSY"]
  animate b --> c : "query"
}

step "No motion" {
  desc "A step with no animate has no packets."
  focus c
}`;

export const SELF_LOOP_DSL = `node client "Client" [icon: browser]
node worker "Worker" [icon: function]
node queue "Queue" [icon: queue]

step "Retry until it succeeds" {
  animate client --> worker : "job"
  animate worker --> worker : "retry"
  animate worker --> queue : "done"
}`;

export const FOCUS_DSL = `node client "Client" [icon: browser]
group core "Core" [color: teal] {
  node api "API" [icon: container]
  node db "DB" [icon: database]
}
node log "Logs" [icon: monitor]

step "Focus a node" {
  desc "Everything not listed is dimmed."
  focus client
}

step "Focus a group" {
  desc "A group brings all of its members."
  focus core
  static api --> db : "SQL"
}

step "Implicit focus" {
  desc "state targets, static endpoints and animate endpoints count as focused."
  state log [badge: "FULL"]
  static api ..> log : "logs"
  animate client --> api : "ping"
}`;

export const STATE_DSL = `node api "API" [icon: container]
node db "Primary" [icon: database, badge: "OK"]
node dr "Standby" [icon: database, visible: false]

step "Primary degrades" {
  desc "badge and color replace the declared values for this step only."
  state db [badge: "SLOW", color: yellow]
  animate api --> db : "write"
}

step "Standby appears" {
  desc "Earlier step overrides do not carry over; each step is self-contained."
  state dr [visible: true, color: orange]
  animate api ..> dr : "failover" [color: orange]
}

step "Primary fails" {
  state db [badge: "DOWN", color: red]
}

step "Clear declared badge" {
  desc "color: none restores the declared color. An empty badge removes it for this step."
  state db [badge: "", color: none]
}`;

export const COLOR_NONE_DSL = `group zone "Zone" [color: teal] {
  node a "Blue" [color: blue]
  node b "No color"
}

step "Override" {
  state zone [color: red]
  state a [color: red]
  state b [color: red]
  static a --> b [color: red]
}

step "Reset" {
  state zone [color: none]
  state a [color: none]
  state b [color: none]
  static a --> b
}`;

export const SEQUENTIAL_DSL = `node a "Client" [icon: browser]
node b "Gateway" [icon: lb]
node c "Service" [icon: container]

step "Declaration order" {
  animate a --> b : "1st"
  animate b --> c : "2nd"
  animate b --> a : "3rd"
}`;

export const PARALLEL_DSL = `node api "API" [icon: container]
node mail "Mail" [icon: mail]
node push "Push" [icon: mobile]
node audit "Audit" [icon: storage]

step "Fan out" {
  animate api --> mail : "first phase"
  animate api --> push : "joins it" [parallel: true]
  animate api --> audit : "next phase"
}`;

export const ROUND_TRIP_DSL = `node a "Client" [icon: browser]
node b "Server"
node c "Client" [icon: browser]
node d "Server"

step "One way vs round trip" {
  animate a --> b : "-->"
  animate c <-> d : "<->" [parallel: true]
}`;

export const PACKET_ICON_DSL = `node client "Client" [icon: browser]
node idp "IdP" [icon: auth]
node api "API" [icon: api]
node queue "Queue" [icon: queue]

step "Packets show what they carry" {
  animate client <-> idp : "Token" [icon: key]
  animate client --> api : "Upload" [icon: file]
  animate api ..> queue : "Event" [icon: mail]
}`;

export const CALLOUT_DSL = `node a "App" [icon: container]
node b "Cache" [icon: cache]
node c "DB" [icon: database]

step "Label, desc and color" {
  animate a --> b : "GET key" [color: teal, desc: "The desc attribute adds body text."]
  animate a --> c : "SELECT" [color: purple] {
    desc "Or use a block."
    desc "Each desc becomes a line."
  }
}`;

export const CODE_DSL = `node app "App" [icon: container]
node api "Orders API" [icon: api]

step "Code in a callout" {
  animate app --> api : "POST /orders" {
    desc "The request body"
    code json "Order Request" \`\`\`
      {
        "orderId": "ord_01",
        "amount": 14800
      }
    \`\`\`
  }
}`;

export const NO_EDGE_DSL = `node a "Producer" [icon: function]
node b "Consumer" [icon: function, visible: false]
node c "Dead letter" [icon: queue]

step "Reveal hidden node" {
  desc "Hidden nodes appear automatically when animated."
  animate a --> b : "direct"
}

step "Dashed fallback" {
  desc "animate accepts dashed arrows directly."
  animate a ..> c : "failed"
}

step "Back to normal" {
  desc "Neither b nor the dashed highlight stay on screen."
  focus a
}`;

export function colorLabDsl(color: ColorName): string {
  return `group zone "group" [color: ${color}] {
  node a "node" [icon: server, badge: "badge", color: ${color}]
  node b "default" [icon: server]
}

step "animate" {
  static a ..> b : "static" [color: ${color}]
  animate a --> b : "packet" [color: ${color}]
}`;
}

/** One declaration per card; the shared prelude is compiled but not shown. */
export const NODE_PRELUDE = 'step "Preview" {}\n';
export const NODE_GALLERY: readonly string[] = [
  'node api',
  'node api "Orders API"',
  'node api "API" [icon: container]',
  'node api "API" [sub: "ECS x3"]',
  'node api "API" [badge: "v2"]',
  'node api "API" [color: green]',
  'node ui "Checkout" [icon: screen]',
  'node api "API" [icon: function, sub: "Lambda", badge: "NEW", color: purple]',
];

export const EDGE_PRELUDE = 'node a "A"\nnode b "B"\nstep "Preview" {\n  ';
export const EDGE_SUFFIX = '\n}';
export const EDGE_GALLERY: readonly string[] = [
  'static a --> b',
  'static a ..> b',
  'static a <-> b',
  'static a <.> b',
  'static a --> b : "HTTPS"',
  'static a --> b [color: blue]',
  'static a --> b\n  static a --> a : "retry"',
];

export const GRAMMAR_EBNF = `Document      ::= Statement*
Statement     ::= TitleStmt | GroupDecl | NodeDecl | StepDecl
TitleStmt     ::= "title" String

GroupDecl     ::= "group" Identifier String? AttrBlock? "{" GroupChild* "}"
GroupChild    ::= GroupDecl | NodeDecl

NodeDecl      ::= "node" Identifier String? AttrBlock?

StepDecl      ::= "step" String "{" StepStmt* "}"
StepStmt      ::= DescStmt | FocusStmt | StateStmt | AnimateStmt | StaticStmt
DescStmt      ::= "desc" String
FocusStmt     ::= "focus" Identifier ("," Identifier)*
StateStmt     ::= "state" Identifier AttrBlock
AnimateStmt   ::= "animate" Identifier ArrowOp Identifier (":" String)?
                  AttrBlock? AnimateBody?
StaticStmt    ::= "static" Identifier ArrowOp Identifier (":" String)? AttrBlock?
ArrowOp       ::= "-->" | "..>" | "<->" | "<.>"
AnimateBody   ::= "{" (DescStmt | CodeStmt)* "}"
CodeStmt      ::= "code" CodeLang? (String CodeFence | CodeFence | String)
CodeLang      ::= Identifier

AttrBlock     ::= "[" (Attr ("," Attr)* ","?)? "]"
Attr          ::= (Identifier | "desc") ":" Value
Value         ::= String | Number | Color | Identifier | Boolean`;

/** A minimal document that triggers each diagnostic; the message shown is the real one. */
export const DIAGNOSTIC_EXAMPLES: Record<DiagnosticCode, string> = {
  'syntax-error': 'node = "x"\nstep "S" {}',
  'unexpected-eof': 'group g {',
  'missing-step': 'node a "A"',
  'duplicate-title': 'title "A"\ntitle "B"\nstep "S" {}',
  'duplicate-id': 'node a\nnode a\nstep "S" {}',
  'undefined-reference': 'node a\nstep "S" {\n  animate a --> b\n}',
  'reference-kind-mismatch': 'group g { node a }\nstep "S" {\n  animate a --> g\n}',
  'unknown-attribute': 'node a [size: "L"]\nstep "S" {}',
  'duplicate-attribute': 'node a [sub: "x", sub: "y"]\nstep "S" {}',
  'invalid-attribute-value': 'node a [visible: "yes"]\nstep "S" {}',
  'unknown-icon': 'node a [icon: databse]\nstep "S" {}',
  'invalid-color': 'node a [color: #ff0000]\nstep "S" {}',
  'invalid-self-arrow': 'node a\nstep "S" {\n  animate a <-> a\n}',
  'invalid-escape': 'title "a\\q"\nstep "S" {}',
  'attribute-not-applicable': 'group g { node a }\nstep "S" {\n  state g [badge: "x"]\n}',
  'empty-state': 'node a\nstep "S" {\n  state a []\n}',
  'duplicate-code':
    'node a\nnode b\nstep "S" {\n  animate a --> b [code: "x"] {\n    code "y"\n  }\n}',
};

/** All documents animated or rendered by the documentation, for validation. */
export const ALL_EXAMPLE_DOCUMENTS: readonly string[] = [
  OVERVIEW_DSL,
  BASICS_DSL,
  GROUPS_DSL,
  EDGE_STEPS_DSL,
  SELF_LOOP_DSL,
  STEPS_DSL,
  FOCUS_DSL,
  STATE_DSL,
  COLOR_NONE_DSL,
  SEQUENTIAL_DSL,
  PARALLEL_DSL,
  ROUND_TRIP_DSL,
  PACKET_ICON_DSL,
  CALLOUT_DSL,
  CODE_DSL,
  NO_EDGE_DSL,
  ...COLOR_NAMES.map(colorLabDsl),
  ...NODE_GALLERY.map((code) => NODE_PRELUDE + code),
  ...EDGE_GALLERY.map((code) => EDGE_PRELUDE + code + EDGE_SUFFIX),
];
