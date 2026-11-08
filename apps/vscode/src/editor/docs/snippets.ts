import type { DiagnosticCode } from '../../dsl';
import { COLOR_NAMES, type ColorName } from '../../model/types';

/**
 * Every DSL example shown in the documentation. They are compiled by the real parser when
 * displayed, and `docs.test.ts` keeps them free of diagnostics.
 */

export const OVERVIEW_DSL = `dav 1
title "Order flow"

// Structure: what exists
node client "Browser" [icon: browser]
group backend "Backend" [color: blue] {
  node api "API" [icon: container]
  node db "Orders DB" [icon: database]
}

// Connections
client --> api : "HTTPS"
api --> db : "SQL"

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

export const BASICS_DSL = `dav 1                     // required, always first
title "Diagram title"     // optional, once

node web "Web"            // a label is optional
node db                   // label falls back to the ID

web --> db : "a \\"quoted\\" word"`;

export const GROUPS_DSL = `dav 1

group vpc "VPC" [color: blue] {
  group public "Public subnet" [color: green] {
    node lb "Load balancer" [icon: lb]
  }
  group private "Private subnet" {
    node app "App" [icon: container]
  }
}

lb --> app`;

export const EDGE_STEPS_DSL = `dav 1

node a "Service A"
node b "Service B"
node c "Backup" [icon: database]

a --> b : "request"
b --> a : "callback"
a ..> c : "fallback" [id: e_fallback, visible: false]

step "Opposite edges" {
  desc "Edges in opposite directions run on parallel tracks."
  animate a --> b : "request"
  animate b --> a : "callback"
}

step "Show an edge" {
  desc "state refers to the edge by its id."
  focus a, c
  state e_fallback [visible: true]
}

step "Recolor it" {
  desc "The edge stays visible: state carries over."
  focus a, c
  state e_fallback [color: orange]
}

step "Hide it again" {
  desc "Set visible back to false to remove it."
  state e_fallback [visible: false, color: none]
}`;

export const STEPS_DSL = `dav 1

node a "Web" [icon: browser]
node b "API" [icon: container]
node c "DB" [icon: database]
a --> b
b --> c

step "Call the API" {
  desc "Each step has its own narrative."
  desc "Several desc lines become several lines."
  animate a --> b : "request"
}

step "State carries over" {
  desc "The badge set here stays in later steps."
  state c [badge: "BUSY"]
  animate b --> c : "query"
}

step "Only state, no motion" {
  desc "A step with no animate just holds, then moves on."
  focus c
}`;

export const FOCUS_DSL = `dav 1

node client "Client" [icon: browser]
group core "Core" [color: teal] {
  node api "API" [icon: container]
  node db "DB" [icon: database]
}
node log "Logs" [icon: storage]

client --> api
api --> db
api ..> log

step "Focus a node" {
  desc "Everything not listed is dimmed."
  focus client
}

step "Focus a group" {
  desc "A group brings all of its members."
  focus core
}

step "Implicit focus" {
  desc "state targets and animate endpoints count as focused."
  state log [badge: "FULL"]
  animate client --> api : "ping"
}`;

export const STATE_DSL = `dav 1

node api "API" [icon: container]
node db "Primary" [icon: database, badge: "OK"]
node dr "Standby" [icon: database, visible: false]
api --> db : "write"
api ..> dr : "failover" [id: e_dr, visible: false]

step "Primary degrades" {
  desc "badge and color replace the declared values."
  state db [badge: "SLOW", color: yellow]
}

step "Standby appears" {
  desc "Earlier changes are still in effect."
  state dr [visible: true]
  state e_dr [visible: true, color: orange]
}

step "Primary fails" {
  state db [badge: "DOWN", color: red]
}

step "Recovered" {
  desc "color: none restores the declared color. An empty badge removes it."
  state db [badge: "", color: none]
  state dr [visible: false]
  state e_dr [visible: false]
}`;

export const COLOR_NONE_DSL = `dav 1

group zone "Zone" [color: teal] {
  node a "Blue" [color: blue]
  node b "No color"
}
a --> b [id: link]

step "Override" {
  state zone [color: red]
  state a [color: red]
  state b [color: red]
  state link [color: red]
}

step "Reset" {
  state zone [color: none]
  state a [color: none]
  state b [color: none]
  state link [color: none]
}`;

export const SEQUENTIAL_DSL = `dav 1

node a "Client" [icon: browser]
node b "Gateway" [icon: lb]
node c "Service" [icon: container]
a --> b
b --> c

step "Declaration order" {
  animate a --> b : "1st"
  animate b --> c : "2nd"
  animate b --> a : "3rd"
}`;

export const PARALLEL_DSL = `dav 1

node api "API" [icon: container]
node mail "Mail" [icon: function]
node push "Push" [icon: mobile]
node audit "Audit" [icon: storage]
api --> mail
api --> push
api --> audit

step "Fan out" {
  animate api --> mail : "first phase"
  animate api --> push : "joins it" [parallel: true]
  animate api --> audit : "next phase"
}`;

export const ROUND_TRIP_DSL = `dav 1

node a "Client" [icon: browser]
node b "Server"
node c "Client" [icon: browser]
node d "Server"
a --> b
c <-> d

step "One way vs round trip" {
  animate a --> b : "-->"
  animate c <-> d : "<->" [parallel: true]
}`;

export const CALLOUT_DSL = `dav 1

node a "App" [icon: container]
node b "Cache" [icon: cache]
node c "DB" [icon: database]
a --> b
a --> c

step "Label, desc and color" {
  animate a --> b : "GET key" [color: teal, desc: "The desc attribute adds body text."]
  animate a --> c : "SELECT" [color: purple] {
    desc "Or use a block."
    desc "Each desc becomes a line."
  }
}`;

export const NO_EDGE_DSL = `dav 1

node a "Producer" [icon: function]
node b "Consumer" [icon: function, visible: false]
node c "Dead letter" [icon: queue]
a --> c [id: e_dlq, visible: false]

step "Packet without an edge" {
  desc "No edge is declared from a to b, and b is hidden."
  animate a --> b : "direct"
}

step "Hidden edge" {
  desc "An animated edge is shown for this step only."
  animate a --> c : "failed"
}

step "Back to normal" {
  desc "Neither b nor e_dlq stay on screen."
  focus a
}`;

export function colorLabDsl(color: ColorName): string {
  return `dav 1

group zone "group" [color: ${color}] {
  node a "node" [icon: server, badge: "badge", color: ${color}]
  node b "default" [icon: server]
}
a --> b : "edge" [color: ${color}]

step "animate" {
  animate b --> a : "packet" [color: ${color}]
}`;
}

/** One declaration per card; the shared prelude is compiled but not shown. */
export const NODE_PRELUDE = 'dav 1\n';
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

export const EDGE_PRELUDE = 'dav 1\nnode a "A"\nnode b "B"\n';
export const EDGE_GALLERY: readonly string[] = [
  'a --> b',
  'a ..> b',
  'a <-> b',
  'a <.> b',
  'a --> b : "HTTPS"',
  'a --> b [color: blue]',
];

export const GRAMMAR_EBNF = `Document      ::= Header Statement*
Header        ::= "dav" "1"

Statement     ::= TitleStmt | GroupDecl | NodeDecl | EdgeDecl | StepDecl
TitleStmt     ::= "title" String

GroupDecl     ::= "group" Identifier String? AttrBlock? "{" GroupChild* "}"
GroupChild    ::= GroupDecl | NodeDecl

NodeDecl      ::= "node" Identifier String? AttrBlock?

EdgeDecl      ::= Identifier ArrowOp Identifier (":" String)? AttrBlock?
ArrowOp       ::= "-->" | "..>" | "<->" | "<.>"

StepDecl      ::= "step" String "{" StepStmt* "}"
StepStmt      ::= DescStmt | FocusStmt | StateStmt | AnimateStmt
DescStmt      ::= "desc" String
FocusStmt     ::= "focus" Identifier ("," Identifier)*
StateStmt     ::= "state" Identifier AttrBlock
AnimateStmt   ::= "animate" Identifier AnimateArrow Identifier (":" String)?
                  AttrBlock? ("{" DescStmt* "}")?
AnimateArrow  ::= "-->" | "<->"

AttrBlock     ::= "[" (Attr ("," Attr)* ","?)? "]"
Attr          ::= (Identifier | "desc") ":" Value
Value         ::= String | Identifier | Boolean`;

/** A minimal document that triggers each diagnostic; the message shown is the real one. */
export const DIAGNOSTIC_EXAMPLES: Record<DiagnosticCode, string> = {
  'syntax-error': 'dav 1\nnode = "x"',
  'unexpected-eof': 'dav 1\ngroup g {',
  'missing-header': 'node a',
  'unsupported-version': 'dav 2',
  'duplicate-title': 'dav 1\ntitle "A"\ntitle "B"',
  'duplicate-id': 'dav 1\nnode a\nnode a',
  'duplicate-edge': 'dav 1\nnode a\nnode b\na --> b\na --> b',
  'undefined-reference': 'dav 1\nnode a\na --> b',
  'reference-kind-mismatch': 'dav 1\ngroup g { node a }\na --> g',
  'unknown-attribute': 'dav 1\nnode a [size: "L"]',
  'duplicate-attribute': 'dav 1\nnode a [sub: "x", sub: "y"]',
  'invalid-attribute-value': 'dav 1\nnode a [visible: "yes"]',
  'unknown-icon': 'dav 1\nnode a [icon: databse]',
  'invalid-color': 'dav 1\nnode a [color: #ff0000]',
  'invalid-animate-arrow': 'dav 1\nnode a\nnode b\nstep "S" {\n  animate a ..> b\n}',
  'invalid-escape': 'dav 1\ntitle "a\\q"',
  'attribute-not-applicable': 'dav 1\ngroup g { node a }\nstep "S" {\n  state g [badge: "x"]\n}',
  'empty-state': 'dav 1\nnode a\nstep "S" {\n  state a []\n}',
};

/** All documents animated or rendered by the documentation, for validation. */
export const ALL_EXAMPLE_DOCUMENTS: readonly string[] = [
  OVERVIEW_DSL,
  BASICS_DSL,
  GROUPS_DSL,
  EDGE_STEPS_DSL,
  STEPS_DSL,
  FOCUS_DSL,
  STATE_DSL,
  COLOR_NONE_DSL,
  SEQUENTIAL_DSL,
  PARALLEL_DSL,
  ROUND_TRIP_DSL,
  CALLOUT_DSL,
  NO_EDGE_DSL,
  ...COLOR_NAMES.map(colorLabDsl),
  ...NODE_GALLERY.map((code) => NODE_PRELUDE + code),
  ...EDGE_GALLERY.map((code) => EDGE_PRELUDE + code),
];
