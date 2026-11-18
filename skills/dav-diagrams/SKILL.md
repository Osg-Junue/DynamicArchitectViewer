---
name: dav-diagrams
description: Create, edit and validate DynamicArchitectViewer .dav files, a text format for architecture, data-flow, sequence, failover and screen-flow diagrams that play step by step. Use when a task involves writing or changing a .dav file, or when the user asks for an animated or step-by-step diagram of a system, request flow or screen flow.
license: MIT
compatibility: The bundled checker needs Node.js 18 or later.
---

# DynamicArchitectViewer diagrams

A `.dav` file holds a diagram and its timeline as text. There are no coordinates: edges and groups decide the layout, and `step` blocks animate the diagram without moving anything.

Follow the workflow in order. Do not skip step 5: the checker is the only way to know that the file works.

## Workflow

1. **Collect the facts first.** Read the code, configuration or documents the diagram describes. Before writing any `.dav`, list:
   - the components, each with its technology or role;
   - the zones they fall into: the boundaries that matter, such as networks, trust zones, teams or deployments;
   - which component calls which, and over what (protocol, queue, SQL);
   - the scenarios to show, in order: the normal flow first, then failures or alternatives;
   - for each message in a scenario: what is sent, and a realistic example of it.

   Do not invent components. If a fact is missing and the user cannot be asked, leave it out. A relation that a component's description gives to many others but no connection names, such as the metrics of all services, is no edge: show what it does with a `state`, or say it in a `desc`. A reply on a connection, such as an answer, an acknowledgement or the rows a query returns, is not another connection: where a scene shows the reply, write that edge as `<->`, even if the facts name only the call. Where no scene shows a reply, the edge stays one-way, unless it is a call back against the reading direction, as [Getting the layout you want](#getting-the-layout-you-want) says. When changing an existing `.dav` file, edit it in place and keep its IDs and comments.

   **Count them.** About 50 nodes or more, or 4 zones or more with edges between them, make a large diagram: read [references/large-diagrams.md](references/large-diagrams.md) before step 2.
2. **Declare the structure:** `node`, `group`, then edges. Write each edge as the facts give it, from the caller: edges set the columns, so a caller stands to the left of what it calls, and [Getting the layout you want](#getting-the-layout-you-want) says what to do with a call that runs back. Messages through a queue, a topic or a stream are asynchronous, so its edges are dashed: from a producer, `order ..> order_events : "Publishes"`, and from it to whatever takes its messages, a consumer or a store, pushed or pulled, `jobs ..> worker`. Where a consumer belongs on the left of the queue, such as a service that subscribes to a topic in a data zone further right, write one two-way edge that names the consumer first: `shipping <.> order_events : "Subscription"`. Declare an edge for every way a packet will go, a self-loop (`api --> api`) for a node that retries or changes state on its own included. Write the file with your file tools, not through a shell heredoc, which takes the quotes and backticks of a `.dav` file for its own.
3. **Script the steps,** one scene per `step`. See [Scripting steps](#scripting-steps).
4. **Fill in the detail** until the file meets [What a detailed diagram has](#what-a-detailed-diagram-has).
5. **Validate, format and review.** `<skill-dir>` is the directory that contains this file:

   ```bash
   node <skill-dir>/scripts/dav-check.mjs --write --detail path/to/diagram.dav
   ```

   It uses the same parser and formatter as the VS Code extension. `--write` formats the file in place, so read it again before your next edit. `--detail` also reports where the diagram says too little and which texts are too long to be shown in full, and describes the layout.

   Fix every `error`, `warning` and `hint` line, and run it again after every fix, until it exits with `0`. `layout` and `note` lines describe the layout and do not fail the check: act on a note if its reason applies. In a large diagram, add `--map`, which says where each zone and node ended, and expect two notes that are to be left: `stacked-zone` for peers gathered in one zone, such as people or outside services, and `left-links` for edges written as you mean. Stop when `--map` shows the zones in the order you mean and no note names something written other than you mean: a few links that point left and some crossings are the price of placing zones freely, and turning edges to trade one for the other is no progress. `ok (...)` says that the checker found nothing to fix; it does not check all that [What a detailed diagram has](#what-a-detailed-diagram-has) asks for. The checker never sees the code, so it does not say that the diagram is true: that comes from step 1. [references/checker.md](references/checker.md) explains every line and code. Leave out `--detail` only when the user asked for a minimal diagram.
6. **Report.** Give the path, and tell the user to open the file in VS Code with the [DynamicArchitectViewer extension](https://marketplace.visualstudio.com/items?itemName=osg-junue.dynamic-architect-viewer) and press `Ctrl+Shift+V` (`⌘⇧V` on macOS). The checker describes the layout but does not render it, so never claim to have seen the result. When the user wants an SVG or an HTML file of the diagram, for a README or to send to someone, use the `dav-cli` skill. If Node.js is unavailable, compare the file against [the specification](references/specification.md) and the lists below by hand, and say that it was not validated.

**A large diagram,** as step 1 counts it, needs more than this page says: read [references/large-diagrams.md](references/large-diagrams.md) before writing it. It says what the layout does and does not do, which zones to make, and how to write the diagram in rounds, the structure first and the steps after.

Write titles, labels and descriptions in the user's language. IDs must stay ASCII.

## What a detailed diagram has

| Part | It has |
| :--- | :--- |
| Node | A short label, an `icon` that matches its kind, and a `sub` with its technology or role: `[icon: database, sub: "PostgreSQL"]` |
| Group | One per boundary that matters: a network, a team, a trust zone, a deployment. A `color` when zones should be told apart |
| Edge | A label that says what travels or how the two are related: `"HTTPS"`, `"SQL"`, `"Publishes"`. Dashed (`..>`, `<.>`) for a secondary, asynchronous or standby path, which the label names |
| Diagram | The normal flow, then each failure or alternative, each scenario a run of steps of its own. A scenario usually takes 2 to 4 steps, and a diagram of one or two scenarios 3 to 8. More scenarios take more steps: the checker sets no limit |
| Step | A title that names the scene, and a `desc` of one or two sentences that says what happens and why |
| Packet (`animate`) | A concrete label (`"POST /orders"`, `"OrderPaid event"`, `"SELECT stock"`), a `desc` that says what the message does or decides, and an `icon` where what it carries has a shape of its own, such as a file, a payment or a key |
| Code | A `code` block on the packets whose content matters: the request, the query, the event, the response. At least one in a diagram of three packets or more; one or two per step is typical |
| State | A `badge` for a status that changes (`"PENDING"`, `"503"`, `"DOWN"`), with a `color` when it is good or bad news, and removed again when it no longer holds |

There is no icon for a product. Pick the kind, and name the product in `sub`: `[icon: database, sub: "PostgreSQL"]`, `[icon: queue, sub: "Kafka"]`. The checker suggests the nearest spelling, not the nearest kind: for `db` it suggests `lb`.

Keep the example values consistent: the order that is created as `ord_104` in step 1 is still `ord_104` in step 3.

### Text that fits

Nothing wraps except `desc`. A longer text is cut off with `…`, and `--detail` reports it for the texts of this table. It says nothing of a step's title, the diagram's title, or the language and title of code, which share the first line of the code: keep them short. Letters differ in width: a text full of capitals or of `m` and `w` fits fewer characters than the table says, and one full of `i` and `l` more.

| Text | Fits about (Latin letters) | Fits about (Japanese) |
| :--- | :--- | :--- |
| Node label | 20 | 12 |
| Node `sub` | 26 | 15 |
| `badge` | 16 | 10 |
| Edge label | 28 | 16 |
| `animate` label | 44 | 27 |
| `animate` `desc` | 170, in up to four lines | 95 |
| `code` | 10 lines of 55 characters | 10 lines of 35 |

A zone's name is as wide as its zone. Only a zone one column wide, or one without nodes, is narrow enough to cut a name of usual length: it has room for at least 9 Japanese characters or about 16 Latin letters, and a zone two columns wide for about 25 Japanese characters or 45 Latin letters. The checker reports a cut label, `sub` or badge of a node, label of an edge, and label, `desc` or `code` of a packet, but not a zone's name, so once the structure is settled, find the zones of one column, those at the top level in the line of zones of `--detail`, such as `"External" 1 x 5`, and the nested ones in the lines of `--map` that place a zone `inside` another in one `column`, such as `inside it, zone "Gateways" (gw): column 2, row 1`, and the zones without nodes, and keep each of their names to 9 Japanese characters or about 16 Latin letters. No other name needs counting. When an official name is longer than its place, keep a short label and give the full name in the `desc` of a step or a packet, or for a node in `sub`, such as `node bank "取引銀行API" [icon: api, sub: "インターネットバンキングAPI"]`.

The column to read depends on the characters, not on the language of the diagram: SQL, JSON and HTTP are Latin letters in a Japanese diagram too, so a line of `code` fits about 55 there as well.

A step's own `desc` is shown in the playback bar under the step's title: two lines of it, and the whole text on hover. Keep it to one or two sentences.

## Reference example

Every part of this example is there for a reason. Copy its level of detail, not its content.

````dav
dav 1
title "Checkout with payment failover"

node browser "Browser" [icon: browser, sub: "Customer"]

group backend "Backend" [color: blue] {
  node api "Order API" [icon: api, sub: "Node.js"]
  node db "Orders DB" [icon: database, sub: "PostgreSQL"]
}

group payments "Payment providers" [color: purple] {
  node primary "Primary PSP" [icon: payment, sub: "Card network A"]
  node backup "Backup PSP" [icon: payment, sub: "Card network B", visible: false]
}

browser <-> api : "HTTPS"
api --> db : "SQL"
api <-> primary : "Charge API"
api <.> backup : "Failover" [id: e_backup, visible: false, color: orange]

step "Place an order" {
  desc "The API stores the order as pending, then asks the primary provider to charge the card."
  animate browser --> api : "POST /orders" [icon: file, desc: "The customer submits the cart with an idempotency key"] {
    code http "Request" ```
      POST /orders
      Idempotency-Key: 7f3c-91ab

      { "cartId": "cart_88", "amount": 4200 }
    ```
  }
  animate api --> db : "INSERT order" [desc: "The order is saved before any money moves"] {
    code sql ```
      INSERT INTO orders (id, amount, status)
      VALUES ('ord_104', 4200, 'PENDING');
    ```
  }
  animate api --> primary : "Charge 4200" [icon: payment, desc: "The API asks the primary provider to charge the card"]
}

step "Fail over to the backup" {
  desc "The primary provider is down, so the API retries the same charge with the backup."
  state db [badge: "PENDING"]
  state primary [badge: "503", color: red]
  state backup [visible: true]
  state e_backup [visible: true]
  animate primary --> api : "503 Unavailable" [color: red, desc: "The provider answers with an outage, so nothing was charged"]
  animate api <-> backup : "Charge 4200" [icon: payment, color: orange, desc: "The same idempotency key makes the retry safe"] {
    code json "Response" ```
      { "chargeId": "ch_552", "status": "authorized" }
    ```
  }
}

step "Confirm the order" {
  desc "The order is saved as paid, and the customer gets the answer."
  state primary [badge: "", color: none]
  animate api --> db : "UPDATE order" [desc: "The order moves from PENDING to PAID"]
  animate api --> browser : "201 Created" [color: green, desc: "The customer sees the confirmation page"] {
    code json ```
      { "orderId": "ord_104", "status": "PAID" }
    ```
  }
}

step "The order is paid" {
  desc "The order is paid once, by the backup provider."
  state db [badge: "PAID", color: green]
}
````

What to notice:

- The backup provider and its edge are declared with `visible: false` and shown by `state` in the step that needs them.
- `PENDING` is set in step 2, after the step whose packet writes the order, and `PAID` in a short last step of its own: a `state` shows from the start of its step.
- The `503` badge set in step 2 is removed in step 3 with `badge: ""` and `color: none`.
- `api <-> backup` is one packet that goes there and back: a request with its response.
- The reply `primary --> api` runs along the `<->` edge, so no second edge is needed.

## Language specification

These are the rules of the `.dav` language, the text of [references/specification.md](references/specification.md) without its examples. They are exact: write only what they allow, and read here rather than guess.

<!-- The language specification, written from docs/specification.md by the skill build. Do not edit it here. -->

### Lexical structure

A file is UTF-8 text. Lines end with `\n` or `\r\n`. A `\r` on its own does not end a line: it counts as whitespace, so a comment runs on past it.

| Token | Definition |
| :--- | :--- |
| Whitespace | Spaces, tabs and line breaks, and the other characters that Unicode counts as whitespace, such as the no-break space and the ideographic space U+3000. The zero-width space U+200B and U+FEFF are not whitespace: between tokens they are a `syntax-error`. A byte order mark at the very start of a file is dropped when the file is read. Whitespace separates tokens and is otherwise ignored, so a statement may run over several lines. The formatter writes one statement to a line |
| Comment | `//` to the end of the line. A comment may stand wherever whitespace may |
| Keyword | `dav`, `title`, `group`, `node`, `step`, `desc`, `focus`, `state`, `animate`, `true`, `false`. Keywords are lowercase and reserved: none of them can be an identifier |
| Identifier | `[A-Za-z_][A-Za-z0-9_]*`, other than a keyword. Identifiers are case-sensitive: `Api` and `api` are two identifiers, and `Node` is an identifier, not a keyword. `code` is a keyword only at the start of a statement in an `animate` body, so `node code` declares a node named `code` |
| Number | An optional `-`, digits, and optionally `.` and more digits. Only the header uses a number |
| String | Text between double quotes, which cannot hold a line feed: one in it is a `syntax-error`, though in a file with `\n` line endings one right after a `\` is an `invalid-escape` instead. The escapes are `\"`, `\\`, `\n` (a line break) and `\t` (a tab). A description and the text of code show a line break as one; a text drawn on one line, such as a label, a `sub`, a badge or the title of code, does not break at it, and how it shows there is not defined: leave it out of such texts. Any other sequence that starts with `\` reports `invalid-escape` and is kept as written. A string that is not read, such as the value of an attribute that is ignored, is not checked |
| Code fence | Text between two runs of three backticks, ```` ``` ... ``` ````, on one line or over several. Its text is taken as written, without escapes, from just after the opening backticks: in ```` ```json ````, `json` is the first line of the code, not its language. The text cannot contain three backticks in a row, nor end with a backtick |
| Arrow | `-->`, `..>`, `<->`, `<.>` |
| Hex color | `#` followed by letters and digits, such as `#ff0000`. It is read only so that it can be reported: no attribute takes it |
| Punctuation | `{`, `}`, `[`, `]`, `,`, `:` |

### Grammar

```ebnf
Document     ::= Header? Statement*
Header       ::= "dav" Number
Statement    ::= Title | Group | Node | Edge | Step

Title        ::= "title" String
Group        ::= "group" Identifier String? Attributes? "{" (Group | Node)* "}"
Node         ::= "node" Identifier String? Attributes?
Edge         ::= Identifier Arrow Identifier (":" String)? Attributes?

Step         ::= "step" String "{" (Desc | Focus | State | Animate)* "}"
Desc         ::= "desc" String
Focus        ::= "focus" Identifier ("," Identifier)*
State        ::= "state" Identifier Attributes
Animate      ::= "animate" Identifier Arrow Identifier (":" String)? Attributes? AnimateBody?
AnimateBody  ::= "{" (Desc | Code)* "}"
Code         ::= "code" CodeLang? (String CodeFence | CodeFence | String)
CodeLang     ::= Identifier | "dav"

Attributes   ::= "[" (Attribute ("," Attribute)* ","?)? "]"
Attribute    ::= (Identifier | "desc") ":" Value
Value        ::= String | Number | HexColor | Identifier | "true" | "false"
```

Anything else is a `syntax-error`, or an `unexpected-eof` when the file ends before a statement or a block is complete. Three consequences that are easy to miss:

- **A statement takes at most one attribute block.** `[desc: "...", parallel: true]` is right; `[desc: "..."] [parallel: true]` is a syntax error. A comma after the last attribute is allowed.
- **The label of an edge or an `animate` follows a colon.** `a --> b : "Label"` and `animate a --> b : "Label"`; without the `:`, the string is a syntax error. That of a `node` or a `group` takes none: `node a "Label"`, where `node a : "Label"` is a syntax error.
- **A `code` string takes no title.** The title string is followed by a code fence: `code json "Title" "{ ... }"` is a syntax error, and its message says so.

The grammar is looser than the language in a few places, so that a mistake gets a message of its own: a missing header, a dashed arrow in `animate`, a two-way arrow on a self-loop, a number or a hex color as a value. The semantics below say which of these are errors.

### Semantics

#### The file

- **The header comes first.** The first statement must be `dav 1`. Only whitespace and comments may come before it. Without a header, the file reports `missing-header`. The version is compared as written: anything but `1`, `1.0` and `01` included, reports `unsupported-version`.
- **`title` is optional.** It names the diagram. Given more than once, it reports `duplicate-title`, and the last one is used.
- **The other statements can come in any order,** and a reference may come before the declaration it names.

#### Identifiers and references

Nodes, groups and the edges that are given an `id` share one namespace, and each identifier can be declared once. Declarations count in the order of the file, whatever their kind, and declaring a taken identifier again reports `duplicate-id`. A node or a group so declared is left out, and the members of a group left out belong to the group around it; an edge so declared is still drawn. An edge written `[id: x]` before `node x` therefore leaves the node out. An edge without an `id` is known by its two ends, and nothing can refer to it.

| What refers | What it may name |
| :--- | :--- |
| Each end of an edge | A node |
| Each end of an `animate` | A node |
| Each name in `focus` | A node or a group |
| The target of `state` | A node, a group, or an edge with an `id` |

A name that is declared as nothing reports `undefined-reference`, and one of another kind reports `reference-kind-mismatch`. An edge with such an end is not drawn, and an `animate` with one moves no packet.

#### Attributes

Each attribute has a type:

| Type | Written as |
| :--- | :--- |
| string | A string: `"..."` |
| boolean | `true` or `false` |
| color | A color name, in any case: `red`, `orange`, `yellow`, `green`, `teal`, `blue`, `purple`, `pink`, `gray`. In `state` only, also `none`. A color is drawn in a shade that suits the light or dark theme |
| icon | An icon name, in any case. See [`node`](#node) |
| identifier | An identifier |

Attribute names are lowercase, as the tables give them: `Icon` is an unknown attribute. Color and icon names are written without quotes: `color: "red"` reports `invalid-attribute-value`. No attribute takes a number. An attribute that the statement does not take reports `unknown-attribute` and is ignored. One that it takes, given twice in one block, reports `duplicate-attribute`, and the last one that is not ignored is used. A value of the wrong type, or not one of the allowed names, reports `invalid-attribute-value`, `invalid-color` or `unknown-icon`, and the attribute is ignored. A color or an icon written within two letters of a name, or one letter for a name of three letters or fewer, gets that name as a suggestion; `none` is never suggested, and a hex color gets no suggestion.

#### `group`

A group is a zone: a frame drawn round its members. It contains only groups and nodes, and groups can nest. A group has no visibility of its own: its frame is drawn in every step, also while every node in it is hidden. Its label is the string after its identifier, or the identifier when there is none; `""` gives an empty label.

| Attribute | Type | Default | Effect |
| :--- | :--- | :--- | :--- |
| `color` | color | none | Color of the zone |

#### `node`

A node belongs to the group it is declared in, or to none at the top level. Its label is the string after its identifier, or the identifier when there is none; `""` gives an empty label.

| Attribute | Type | Default | Effect |
| :--- | :--- | :--- | :--- |
| `icon` | icon | `server` | The symbol of the node |
| `sub` | string | none | A second line under the label |
| `badge` | string | none | A badge above the node |
| `visible` | boolean | `true` | Whether the node is shown before any `state` changes it |
| `color` | color | none | Color of the ring, the icon and the badge |

The 42 icons:

- **Infrastructure and logic (28):** `server`, `container`, `function`, `runtime`, `database`, `cache`, `queue`, `storage`, `lb`, `firewall`, `cdn`, `cloud`, `building`, `router`, `hub`, `wifi`, `external`, `auth`, `ai`, `api`, `mail`, `monitor`, `schedule`, `search`, `logic`, `webhook`, `payment`, `key`
- **Screens, actors and documents (14):** `screen`, `modal`, `browser`, `desktop`, `mobile`, `terminal`, `device`, `printer`, `chat`, `sheet`, `file`, `user`, `users`, `bot`

#### Edges

An edge joins two nodes. Its arrow sets its line and its arrowheads:

| Arrow | Line | Arrowheads |
| :--- | :--- | :--- |
| `-->` | Solid | At the second node |
| `..>` | Dashed | At the second node |
| `<->` | Solid | At both nodes |
| `<.>` | Dashed | At both nodes |

| Attribute | Type | Default | Effect |
| :--- | :--- | :--- | :--- |
| `id` | identifier | none | A name for the edge, which `state` needs to refer to it |
| `visible` | boolean | `true` | Whether the edge is shown before any `state` changes it |
| `color` | color | none | Color of the line |

- **The label** after `:` is drawn on the line.
- **A self-loop** joins a node to itself, `a --> a`, and is drawn as a loop at the top right of the node. It takes only a one-way arrow, `-->` or `..>`: a two-way arrow reports `invalid-self-arrow`.
- **Two edges between the same nodes in the same direction** need an `id` on all but one. A second edge from `a` to `b` without an `id` reports `duplicate-edge`, whatever the line of either, and is still drawn. An edge from `b` to `a` is another pair, and a two-way edge counts in the direction it is written: `a <-> b` and `a --> b` are a duplicate, `b <-> a` and `a --> b` are not.

#### `step`

The steps play in the order they are written, numbered from 1. The viewer opens on step 1 without playing it: its first phase repeats until the steps are played. Before step 1 comes the overview: the diagram as declared, with nothing dimmed and nothing moving. A file without steps shows the overview only.

A step's string is its title. Its `desc` statements are its description, joined with line breaks when there are several. The viewer's playback bar shows two lines of it, and the whole text on hover; an exported picture shows two lines, the lines after the second running on at the end of it. `desc`, `focus` and `animate` last for their step only; `state` lasts.

##### `state`

`state` changes a node, a group or an edge with an `id`, from the start of its step and in every later step.

| Attribute | Type | On a node | On a group | On an edge |
| :--- | :--- | :--- | :--- | :--- |
| `badge` | string | The badge. `""` removes it, the declared badge included | Not applicable | Not applicable |
| `visible` | boolean | Shows or hides the node | Not applicable | Shows or hides the edge |
| `color` | color, or `none` | The color. `none` returns to the declared color | The color. `none` returns to the declared color | The color. `none` returns to the declared color |

- **States accumulate.** To show step *k*, the `state` statements of steps 1 to *k* apply in the order they are written. For each target and attribute, the last value given wins.
- **A state shows from the start of its step,** before the first packet of that step moves. A status that a packet brings about is therefore set in the next step.
- An attribute that does not apply to its kind of target reports `attribute-not-applicable` and changes nothing on the target, though `visible: false` still keeps the `state` from emphasizing it, as below. An empty block, `state a []`, reports `empty-state`.

##### What a step shows

A step emphasizes the nodes and groups named in its `focus`, the targets of its `state` statements, both nodes of an edge whose state it sets, and both nodes of each `animate`. A `state` with `visible: false` emphasizes nothing.

- **When a step emphasizes anything, the rest is dimmed.** A node is dimmed unless it, or a group around it, is emphasized. A group is dimmed unless it, a group around it, or something inside it is emphasized.
- **Such a step draws only the edges it is about:** the edges its packets run on, the edges its `state` statements target, and the edges whose two nodes are both undimmed. A step that emphasizes nothing dims nothing and draws every edge that is shown.
- **A node is shown** when it is visible, as declared or as a `state` set it, and also, in its step only, when a packet of that step starts or ends at it.
- **An edge is shown** when it is visible, or when a packet of the step runs on it, and only while both of its nodes are shown.

##### `animate`

`animate` moves a packet from its first node to its second, along an edge where there is one.

| Arrow | The packet |
| :--- | :--- |
| `-->` | Goes from the first node to the second |
| `<->` | Goes to the second node, rests there a moment, and comes back: about twice as long as a one-way packet on the same way |
| `..>`, `<.>` | Not allowed: `invalid-animate-arrow` |

| Attribute | Type | Default | Effect |
| :--- | :--- | :--- | :--- |
| `icon` | icon | none | Draws the packet as a chip that shows what it carries, instead of a dot |
| `color` | color | the accent color | Color of the packet and of the line it runs on |
| `parallel` | boolean | `false` | Plays in the same phase as the `animate` before it |
| `desc` | string | none | Text of the packet's callout |
| `code` | string | none | A code snippet in the callout. See [`code`](#code) |

- **The label** after `:` names what the packet carries, and is shown with it.
- **The packet follows an edge** between its two nodes, solid or dashed alike: one from its first node to its second, or a two-way edge written either way round. A one-way edge written the other way round is not followed. Of several such edges, it takes the first declared of those visible at that step, as declared or as its states set them, or the first declared when none is. With no such edge, it travels between the two nodes on a way of its own, along which no line is drawn; `dav check --detail` reports it as `animate-without-edge` in a file without errors and warnings.
- **On a self-loop,** `animate a --> a` goes round the loop once. A two-way arrow on a self-loop reports `invalid-self-arrow`.
- **Phases.** The `animate` statements of a step play one after another, each in a phase of its own. `parallel: true` puts an `animate` in the phase of the one before it, so that they leave together; on the first `animate` of a step it has no effect. A packet takes longer the longer its way on screen is and the more packets share its phase, and a phase lasts until its last packet arrives, with a short pause after it. A packet, its callout and the color it gives its line last for its phase; when packets of one phase run on the same edge, the line takes the color of the first. When a step has more than one phase, each packet is numbered by its phase, with a letter for each of several in one phase: `1`, `2a`, `2b`. The number shows on its callout and at a stop halfway along its way.
- **Still pictures.** Where nothing moves, in a still export of a step or in the viewer with motion stopped, no packet and no callout is drawn: the lines the step's packets run on are lit, each in the color of the first packet on it. In a stopped viewer, picking a node shows, stopped on their way and with their callouts, the packets of a phase in which it sends a packet, or, if it sends none, in which it receives one: the first such phase, or, while one of them is shown after a pick, however it was picked, the next one, and after the last one the still picture again. A reader who asks for reduced motion gets a viewer that is always stopped.
- **Its description** is the `desc` attribute followed by the `desc` statements of its body, joined with line breaks. In a description, the whitespace at the start and the end of each line is dropped, so it cannot be indented, and whitespace in a row shows as one space, though the viewer's playback bar counts only spaces and tabs as whitespace here; a packet's callout, and a step's description in an exported picture, leave out empty lines. A packet's callout shows up to four lines; the lines after the fourth run on at the end of it. A packet with no label, `desc` or `code` has no callout.

##### `code`

`code` gives an example of what the packet carries, drawn in a frame in the packet's callout, with the language and the title above it. It is written in the body of `animate`, or as its `code` attribute:

| Form | Language | Title |
| :--- | :--- | :--- |
| ```` code json "Title" ``` ... ``` ```` | Optional | Optional |
| `code json "..."` | Optional | None: `code json "Title" "..."` is a syntax error |
| `[code: "..."]` | None | None |

- **The language** is any identifier, or `dav`. It names the code above it; every language is colored alike.
- **The text is drawn tidied,** whatever its form: line breaks, a `\r` on its own included, become `\n`, each tab becomes two spaces, whitespace at the end of a line is removed, the blank lines at the start and at the end are removed, and so is the indentation that all its lines that are not blank share, counted in spaces. Otherwise, the text of a code fence is taken as written, and that of a string with its escapes, `\n` for a line break.
- **Empty code,** of whitespace only, draws no frame.
- **One per `animate`.** The attribute and each `code` statement count; two `code` attributes in one block are a `duplicate-attribute` instead. Each one after the first reports `duplicate-code`, and the last one that is not empty is used.

### Formatting

The formatter writes a file in its canonical form, without changing what it means. VS Code formats a `.dav` file on request, and `dav format` and `dav check --write` do the same.

- One space between tokens: `a --> b : "Label" [key: value, key: value]`, and no comma after the last attribute.
- Two spaces of indentation for each level of `{ }`. An empty `group` or `step` body is written `{}`, and an empty `animate` body is dropped.
- Comments are kept. A comment after a statement stays on its line; one after a `{` goes to the next line. Two blank lines or more become one, and the blank lines at the start and the end of the file and of a block are removed.
- A file with any `\r\n` line ending gets `\r\n` on every line; any other file gets `\n`. The file ends with one line ending, and a file of whitespace only becomes empty.
- The text of a code fence is tidied: a `\r` on its own becomes a line break, tabs become two spaces, and whitespace at the end of a line and the indentation that all its lines that are not blank share, counted in spaces, are removed. It goes on lines of its own, two spaces deeper than its `code`, with the closing backticks on a line of their own, so a one-line fence with one line of code in it becomes three lines. A `code` string stays on one line.
- A statement with a comment among its own words is kept as written, but indented to its depth and without spaces at the ends of its lines. For a `group`, a `step` or an `animate`, a comment before its `{` keeps its body as written too, and the lines of a code fence in it keep their own indentation. A `code` statement with a comment among its words is kept as written up to its code fence, which is laid out as above. A file with a `syntax-error`, an `unexpected-eof`, or a string that runs over a line break is not changed.

### Diagnostics

A diagnostic does not stop the rest of the file from being read, and the table says what becomes of what is in error where it matters. After a `syntax-error`, the diagnostics that follow it can come from it: fix the first one, and read the file again. A file with an error is not valid, and how it is drawn is not defined beyond that; `dav export` exports nothing from it.

| Code | Severity | Reported when |
| :--- | :--- | :--- |
| `missing-header` | Error | The file does not start with `dav`. A `dav` without a number, such as `dav "1"`, is a `syntax-error` instead |
| `unsupported-version` | Error | The version is not written `1`, such as `1.0` or `2` |
| `duplicate-title` | Warning | `title` appears more than once. The last one is used |
| `duplicate-id` | Error | An identifier is declared more than once. A node or a group declared later is left out; an edge is still drawn |
| `duplicate-edge` | Error | A second edge joins the same nodes in the same direction without an `id`. It is still drawn |
| `undefined-reference` | Error | An edge, `focus`, `state` or `animate` names an identifier that is not declared |
| `reference-kind-mismatch` | Error | A name is of the wrong kind, such as a group as the end of an edge or of an `animate` |
| `unknown-attribute` | Warning | The statement does not take the attribute. It is ignored |
| `duplicate-attribute` | Warning | An attribute that the statement takes appears twice in one block. The last one that is not ignored is used |
| `duplicate-code` | Warning | An `animate` has more than one `code`. The last one that is not empty is used |
| `invalid-attribute-value` | Error | The value has the wrong type. The attribute is ignored |
| `attribute-not-applicable` | Warning | A `state` attribute does not apply to its kind of target. It changes nothing on the target, though `visible: false` still keeps the `state` from emphasizing it |
| `empty-state` | Warning | A `state` has an empty attribute block |
| `unknown-icon` | Error | The icon is not one of the 42. A name within reach is suggested, as [Attributes](#attributes) says |
| `invalid-color` | Error | The color is not one of the nine names, or `none` outside `state`, or a hex color. A name within reach is suggested, as [Attributes](#attributes) says |
| `invalid-animate-arrow` | Error | `animate` uses a dashed arrow |
| `invalid-self-arrow` | Error | An edge from a node to itself uses `<->` or `<.>`, or an `animate` from a node to itself uses `<->` |
| `invalid-escape` | Error | A string contains an escape other than `\"`, `\\`, `\n` and `\t` |
| `unexpected-eof` | Error | The file ends before a statement or a `{ }` or `[ ]` block is complete, outside a string and a code fence, and no `syntax-error` came before |
| `syntax-error` | Error | Anything else the grammar does not allow, such as a string or a code fence that the file ends inside. For a `code` string given a title on the same line, the message says that only a code fence takes one |

<!-- End of the language specification. -->

## Getting the layout you want

- **Edges set the column.** A node sits to the right of whatever points at it, and the longest path wins. Where the zones are placed freely, this holds inside each zone, except that a node linked outside its zone may stand further right, still left of the nodes it points at in its zone, where the search scores that better; a link between zones sets no column.
- **Groups keep nodes together.** In a column, a node goes near the nodes it links to, and declaration order settles only what is left, from top to bottom, so swapping two declarations may change nothing. Where the zones are placed freely, a zone may also be drawn upside down, and a swap reruns the search, which can move other zones too.
- **The zones of a large diagram follow their links, not the order of their declarations,** and only zones nested in one zone are sure to stand together. The search that places them starts from the order of the declarations and prefers links that point right, so moving a declaration or turning an edge between zones can move zones too, but not into an order you choose. `--detail` says `zones placed freely` when this happens, and names each link between zones that points left in a note `left-links`. No way of writing an edge decides which of two such zones stands on the left. Inside one zone, edges set the columns again: nesting two zones in one zone that is a real boundary makes the links between them point right, though it can cost crossings and move other zones, so compare `--map` before and after, and where it does not help, leave the order as it came. [references/large-diagrams.md](references/large-diagrams.md) says how to choose the zones.
- **In a cycle, the node reached first goes on the left.** Columns come from a search that goes depth first: from the first node declared, along its edges in the order they are written, then again from the next node declared that it has not reached. A loop is entered at the first of its nodes the search reaches, and the edge that closes it does not count. `--detail` names an edge left out in a note `back-edge`: the loop as the search went round it, where it came into the loop, the columns of the edge's two ends, and the node to declare another node of the loop before, to start the loop there. It says nothing where that loop has two nodes and the one declared first stands on the left. Where the zones are placed freely, only a loop inside one zone leaves an edge out.
- **A one-way edge that points back pulls its target to the right of its source,** in shared columns or inside one zone, unless the search reached the source through that target, and in shared columns the target's zone stretches with it. A command sent back to a device, a webhook that an outside service calls back with, an engineer who opens a console that belongs on their left, or a subscription to a topic that stands further right, is such an edge. Write it as one two-way edge that names first the node that belongs on the left: a two-way edge counts only in the direction it is written, and a packet can run along it either way. Between zones placed freely, how an edge is written only weighs on the search, as said above.
- **A two-way edge names first the node that belongs on the left.** For a request and its response, that is the caller: `api <-> db`. For a call against the reading direction, it is the node called: `gw <-> svc`, where `svc` sends commands to `gw`. A two-way edge is drawn with an arrowhead at each end, so where it names the node called first, say in its label who calls: `oncall <-> pagerduty : "Pages (from PagerDuty)"`. A job that reads a store is the caller too: `etl --> db`, or `db <-> etl` where the database belongs on the left. Never turn a one-way edge round for the layout: its arrow would then say that the other node calls.
- **A call and its answer are one two-way edge, not two one-way edges.** Two edges in opposite directions make a loop, and the layout leaves one of them out. When the two directions carry different things, name both in the label: `hvac <-> gw : "Status / setpoints"`.
- **`animate` and `step` never affect layout.** A hidden node keeps its place, so nothing moves when it appears, and writing steps never moves what the structure has settled.
- There is no syntax for positions. Do not try to add any.

When it matters which node is where, because the user asks how the diagram looks or wants one thing left of, right of or above another, run the checker with `--map`. `--detail` describes the layout in numbers. [references/checker.md](references/checker.md) explains both, and [the layout guide](references/layout.md) has recipes for moving a node.

## Scripting steps

The specification says what `desc`, `focus`, `state` and `animate` do, and how long each lasts. This is how to use them well.

- **Keep each step to one idea,** usually two to five packets. Start a new step where the outcome changes: the request and the failure it meets are one scene, the reaction to it (a retry, a rollback, a fallback) is the next. A request or a reply that passes through several nodes may take a step past five packets; do not cut a path in two to stay under a count. The player numbers steps, so titles do not need numbers.
- **Mark a step that shows another outcome.** A failure or an alternative that replaces part of the normal flow does not come after the last step in time: it starts again where it parts from that flow. Say so in the title and the `desc` (`"Payment fails: the card is declined"`, `"The same order again, up to the charge"`), set each badge, color and visibility back to what it was at that point, and keep the same example values. Otherwise the steps read as one timeline, in which a paid order becomes pending again. A scene that follows on in time is no other outcome: it goes on from where the last one ended. In the first step after it that belongs to another scenario, clear the badges and colors it set, and hide again what it showed.
- **Order packets deliberately.** Each `animate` is one phase, played in order. `[parallel: true]` joins the preceding one, for work that really is concurrent.
- **Run packets along declared edges.** A packet without an edge has no line to follow, and `--detail` reports it with the hops to send instead or the edges to make two-way. For replies, make the edge `<->`, and send a reply back through every node the request came through. Leave out a reply that tells nothing new, such as a plain success at the end of a long path.
- **Use `<->` in `animate` for a call and its answer,** when one label and `desc` can say both; its `code` may show the answer. Use two packets when the answer needs words of its own, such as an error.
- **Clean up `state`.** Badges and colors carry over. To end one, write `badge: ""` or `color: none` in the first step where it no longer holds, or a badge from step 2 will still be showing in step 8. Where one scenario ends and another begins, clear the last one's badges and colors, and hide again what it showed, in the first step of the next. A `state` emphasizes its target, so a node whose badge you clear is lit in that step as well.
- **Show a status where it holds.** A `state` shows from the start of its step, before its first packet moves: a step shows what holds while it plays. To show a status that a packet of a step brings about, such as a job paused by a request, set it in the next step, which then shows the outcome. Where a scenario ends on such a status, such as an order paid at last, give it a short last step with that `state` and a `desc`: otherwise it is never seen, because the scenario ends before it shows and the next one starts by clearing it.
- **Let `animate` and `state` set the emphasis.** Their targets are emphasized automatically, so add `focus` only for nodes that have neither. Any of them, except a `state` that hides its target, dims the rest of the diagram and draws only the edges the step is about, as the specification says under What a step shows, so `focus` on both ends of an edge is also how to keep that edge on screen.
- **Reveal things that appear later.** Declare them with `visible: false`, then use `state` with `visible: true`. To target an edge from `state`, the edge needs `[id: name]`.
- **Use self-loops for internal work,** such as retries or state transitions: `order --> order : "Retry"`, then `animate order --> order`. A self-loop connects no other component, so it adds nothing to the facts: declare one where a step animates that work, and for an action whose target the facts do not name, such as logging an error, rather than inventing a store. One self-loop carries packets of any label; a second one on the same node needs an `id`, like any second edge in the same direction. Self-loops cannot use `<->` or `<.>`.

### Writing `desc`

A packet's label says **what** is sent. Its `desc` says what that **does**: the decision, the check, the effect. Do not repeat the label.

| Label | Weak `desc` | Good `desc` |
| :--- | :--- | :--- |
| `"POST /orders"` | `"Sends a POST request"` | `"The customer submits the cart with an idempotency key"` |
| `"SELECT stock"` | `"Queries the database"` | `"Stock is checked before the card is charged"` |
| `"OrderPaid event"` | `"Publishes an event"` | `"Shipping and mail react to this event on their own"` |

### Writing `code`

A `code` block shows an example of what the packet carries. Give it to the packets a reader would want to see inside, one to a packet. Write it between two lines of three backticks, as in the reference example: that form alone takes a title as well as a language, and the formatter lays it out. The specification gives the shorter forms.

| The packet is | Show | Language |
| :--- | :--- | :--- |
| An HTTP request | The method and path, one or two headers that matter, the body | `http` |
| An HTTP response or a JSON message | The status and the two to five fields that matter | `json` |
| A query or a write | The statement with realistic values | `sql` |
| An event or queue message | The event name and its key fields | `json` |
| A command, a config or a log line | The line itself | `sh`, `yaml`, `text` |

Keep it to the lines that matter, at most 10 lines of 55 characters, or 35 Japanese ones. Break a longer line where it reads naturally: after a comma in JSON, before a clause in SQL. Never put real secrets, tokens or personal data in it: use obvious placeholders such as `tok_test_123`.

## Common mistakes

| Wrong | Right | Diagnostic |
| :--- | :--- | :--- |
| `state a --> b [...]` | Give the edge an `id`, then `state e_id [...]` | `syntax-error` |
| `a --> my_group` | Point at a node inside the group | `reference-kind-mismatch` |
| `[color: #ff0000]` | `[color: red]` | `invalid-color` |
| `[icon: postgres]` | `[icon: database, sub: "PostgreSQL"]` | `unknown-icon` |
| `node step "Step"` | `node step_1 "Step"` | `syntax-error` |
| Two `code` entries on one `animate` | Combine into a single `code` block | `duplicate-code` |
| `code json "{ "id": 1 }"` | Escape the quotes, or use the backtick form | `syntax-error` |
| `code json "Title" "{ ... }"` | Only the backtick form takes a title | `syntax-error` |
| `animate a --> b : "x" [desc: "y"] [parallel: true]` | One block: `[desc: "y", parallel: true]` | `syntax-error` |
| `gw --> gw : "Buffer"` and `gw --> gw : "Install"` | One self-loop carries both packets; a second needs `[id: ...]` | `duplicate-edge` |
| `animate a --> b` with no label or `desc` | `animate a --> b : "What" [desc: "Why"]` | hint `animate-without-desc` |
| `animate api --> app` when only `app --> gw` and `gw --> api` exist | Send the reply the way it really goes: `animate api --> gw`, then `animate gw --> app`, over `<->` edges | hint `animate-without-edge` |
| `node db "PostgreSQL primary database server"` | `node db "Orders DB" [sub: "PostgreSQL"]` | hint `text-cut` |

## More detail

Read these only when needed:

- [references/large-diagrams.md](references/large-diagrams.md): before writing a diagram of about 50 nodes or more, or of 4 zones or more with edges between them
- [references/checker.md](references/checker.md): when the checker prints a line or a code you do not know, and to read the layout lines and the map
- [references/specification.md](references/specification.md): the specification above, with its examples, its design goals and what may change in `dav 1`
- [references/layout.md](references/layout.md): recipes and the exact placement rules
- `assets/examples/`: complete diagrams
  - `01-infra-ha-failover.dav`: infrastructure and failover
  - `02-screen-flow-checkout.dav`: screen flow
  - `03-event-driven-async.dav`: event-driven system
  - `04-enterprise-zero-trust-payment.dav`: large architecture with nested groups
  - `05-sequence-payment-retry.dav`: sequence-style flow with retries
  - `06-lan-office-network.dav`: network diagram
  - `07-dynamic-architect-viewer.dav`: software pipeline with export and import
