---
name: dav-diagrams
description: Create, edit and validate DynamicArchitectViewer .dav files, a text format for architecture, data-flow, sequence, failover and screen-flow diagrams that play step by step. Use when a task involves writing or changing a .dav file, or when the user asks for an animated or step-by-step diagram of a system, request flow or screen flow.
license: MIT
compatibility: The bundled checker needs Node.js 18 or later.
---

# DynamicArchitectViewer diagrams

A `.dav` file (v2) holds a diagram and its timeline as text. There is no file header and no manual coordinates: `group` hierarchy and `step` flow order decide the layout automatically.

Follow the workflow in order. Do not skip step 5: the checker is the only way to know that the file works.

## Workflow

1. **Collect the facts first.** Read the code, configuration or documents the diagram describes. Before writing any `.dav`, list:
   - the components, each with its technology or role;
   - the zones they fall into: the boundaries that matter, such as networks, trust zones, teams or deployments;
   - which component calls which, and over what (protocol, queue, SQL);
   - the scenarios to show, in order: the normal flow first, then failures or alternatives;
   - for each message in a scenario: what is sent, and a realistic example of it.

   Do not invent components. If a fact is missing and the user cannot be asked, leave it out. When changing an existing `.dav` file, edit it in place and keep its IDs and comments.

   **Count them.** About 50 nodes or more, or 4 zones or more with connections between them, make a large diagram: read [references/large-diagrams.md](references/large-diagrams.md) before step 2.
2. **Declare the structure:** `title`, `group` and `node`. There are no top-level edges in `.dav` v2; all connections belong inside `step` blocks (`animate` for moving traffic, `static` for non-moving background relationships). Write the file with your file tools, not through a shell heredoc, which takes the quotes and backticks of a `.dav` file for its own.
3. **Script the steps,** one scene per `step` (at least one `step` is required). See [Scripting steps](#scripting-steps).
4. **Fill in the detail** until the file meets [What a detailed diagram has](#what-a-detailed-diagram-has).
5. **Validate, format and review.** `<skill-dir>` is the directory that contains this file:

   ```bash
   node <skill-dir>/scripts/dav-check.mjs --write --detail path/to/diagram.dav
   ```

   It uses the same parser and formatter as the VS Code extension. `--write` formats the file in place, so read it again before your next edit. `--detail` also reports where the diagram says too little and which texts are too long to be shown in full, and describes the layout.

   Fix every `error`, `warning` and `hint` line, and run it again after every fix, until it exits with `0`. `layout` and `note` lines describe the layout and do not fail the check: act on a note if its reason applies. In a large diagram, add `--map`, which says where each zone and node ended. `ok (...)` says that the checker found nothing to fix; it does not check all that [What a detailed diagram has](#what-a-detailed-diagram-has) asks for. The checker never sees the code, so it does not say that the diagram is true: that comes from step 1. [references/checker.md](references/checker.md) explains every line and code. Leave out `--detail` only when the user asked for a minimal diagram.
6. **Report.** Give the path, and tell the user to open the file in VS Code with the [DynamicArchitectViewer extension](https://marketplace.visualstudio.com/items?itemName=osg-junue.dynamic-architect-viewer) and press `Ctrl+Shift+V` (`⌘⇧V` on macOS). The checker describes the layout but does not render it, so never claim to have seen the result. When the user wants an SVG or an HTML file of the diagram, for a README or to send to someone, use the `dav-cli` skill. If Node.js is unavailable, compare the file against [the specification](references/specification.md) and the lists below by hand, and say that it was not validated.

Write titles, labels and descriptions in the user's language. IDs must stay ASCII.

## What a detailed diagram has

| Part | It has |
| :--- | :--- |
| Node | A short label, an `icon` that matches its kind, and a `sub` with its technology or role: `[icon: database, sub: "PostgreSQL"]` |
| Group | One per boundary that matters: a network, a team, a trust zone, a deployment. A `color` when zones should be told apart |
| Diagram | The normal flow first, then each failure or alternative, each scenario a run of steps of its own. A scenario usually takes 2 to 4 steps, and a diagram of one or two scenarios 3 to 8 |
| Step | A title that names the scene, and a `desc` of one or two sentences that says what happens and why |
| Packet (`animate`) | A concrete label (`"POST /orders"`, `"OrderPaid event"`, `"SELECT stock"`), a `desc` that says what the message does or decides, and an `icon` where what it carries has a shape of its own, such as a file, a payment or a key |
| Background link (`static`) | Non-moving relationships relevant to the step (replication, monitoring, standby links) with a short label |
| Code | A `code` block on the packets whose content matters: the request, the query, the event, the response. At least one in a diagram of three packets or more; one or two per step is typical |
| State | A `badge` for a status that holds during that step (`"PENDING"`, `"503"`, `"DOWN"`), with a `color` when it is good or bad news |

There is no icon for a product. Pick the kind, and name the product in `sub`: `[icon: database, sub: "PostgreSQL"]`, `[icon: queue, sub: "Kafka"]`. The checker suggests the nearest spelling, not the nearest kind: for `db` it suggests `lb`.

Keep the example values consistent: the order that is created as `ord_104` in step 1 is still `ord_104` in step 3.

### Text that fits

Nothing wraps except `desc`. A longer text is cut off with `…`, and `--detail` reports it for the texts of this table. It says nothing of a step's title, the diagram's title, or the language and title of code, which share the first line of the code: keep them short. Letters differ in width: a text full of capitals or of `m` and `w` fits fewer characters than the table says, and one full of `i` and `l` more.

| Text | Fits about (Latin letters) | Fits about (Japanese) |
| :--- | :--- | :--- |
| Node label | 20 | 12 |
| Node `sub` | 26 | 15 |
| `badge` | 16 | 10 |
| `static` label | 28 | 16 |
| `animate` label | 44 | 27 |
| `animate` `desc` | 170, in up to four lines | 95 |
| `code` | 10 lines of 55 characters | 10 lines of 35 |

A zone's name is as wide as its zone. Only a zone one column wide, or one without nodes, is narrow enough to cut a name of usual length: keep single-column zone labels short or place details in node `sub` or step `desc`.

A step's own `desc` is shown in the playback bar under the step's title: two lines of it, and the whole text on hover. Keep it to one or two sentences.

## Reference example

Every part of this example is there for a reason. Copy its level of detail, not its content.

````dav
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
  static api --> db : "Pending order"
  animate primary --> api : "503 Unavailable" [color: red, desc: "The provider answers with an outage, so nothing was charged"]
  animate api <.> backup : "Charge 4200" [icon: payment, color: orange, desc: "The same idempotency key makes the retry safe"] {
    code json "Response" ```
      { "chargeId": "ch_552", "status": "authorized" }
    ```
  }
}

step "Confirm the order" {
  desc "The order is saved as paid, and the customer gets the answer."
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

- There is no `dav` header and no top-level edges: the overview synthesizes all connections from `animate` and `static` across every step.
- Steps are self-contained: `state` applies to its own step only, so the `503` badge from step 2 disappears automatically in step 3 without cleanup boilerplate.
- `api <.> backup` uses a dashed round-trip arrow directly in `animate` for the failover call and its response.
- `static api --> db : "Pending order"` shows a non-moving relationship relevant to step 2 without sending a packet along it.

## Language specification

These are the rules of the `.dav` language, the text of [references/specification.md](references/specification.md) without its examples. They are exact: write only what they allow, and read here rather than guess.

<!-- The language specification, written from docs/specification.md by the skill build. Do not edit it here. -->

### Lexical structure

A file is UTF-8 text. Lines end with `\n` or `\r\n`. A `\r` on its own does not end a line: it counts as whitespace, so a comment runs on past it.

| Token | Definition |
| :--- | :--- |
| Whitespace | Spaces, tabs and line breaks, and the other characters that Unicode counts as whitespace, such as the no-break space and the ideographic space U+3000. The zero-width space U+200B and U+FEFF are not whitespace: between tokens they are a `syntax-error`. A byte order mark at the very start of a file is dropped when the file is read. Whitespace separates tokens and is otherwise ignored, so a statement may run over several lines. The formatter writes one statement to a line |
| Comment | `//` to the end of the line. A comment may stand wherever whitespace may |
| Keyword | `title`, `group`, `node`, `step`, `desc`, `focus`, `state`, `animate`, `static`, `true`, `false`. Keywords are lowercase and reserved: none of them can be an identifier |
| Identifier | `[A-Za-z_][A-Za-z0-9_]*`, other than a keyword. Identifiers are case-sensitive: `Api` and `api` are two identifiers, and `Node` is an identifier, not a keyword. `code` is a keyword only at the start of a statement in an `animate` body, so `node code` declares a node named `code` |
| Number | An optional `-`, digits, and optionally `.` and more digits. Read in attribute values only so that a number where another type is expected reports `invalid-attribute-value` |
| String | Text between double quotes, which cannot hold a line feed: one in it is a `syntax-error`, though in a file with `\n` line endings one right after a `\` is an `invalid-escape` instead. The escapes are `\"`, `\\`, `\n` (a line break) and `\t` (a tab). A description and the text of code show a line break as one; a text drawn on one line, such as a label, a `sub`, a badge or the title of code, does not break at it, and how it shows there is not defined: leave it out of such texts. Any other sequence that starts with `\` reports `invalid-escape` and is kept as written. A string that is not read, such as the value of an attribute that is ignored, is not checked |
| Code fence | Text between two runs of three backticks, ```` ``` ... ``` ````, on one line or over several. Its text is taken as written, without escapes, from just after the opening backticks: in ```` ```json ````, `json` is the first line of the code, not its language. The text cannot contain three backticks in a row, nor end with a backtick |
| Arrow | `-->`, `..>`, `<->`, `<.>` |
| Hex color | `#` followed by letters and digits, such as `#ff0000`. It is read only so that it can be reported: no attribute takes it |
| Punctuation | `{`, `}`, `[`, `]`, `,`, `:` |

### Grammar

```ebnf
Document     ::= Statement*
Statement    ::= Title | Group | Node | Step

Title        ::= "title" String
Group        ::= "group" Identifier String? Attributes? "{" (Group | Node)* "}"
Node         ::= "node" Identifier String? Attributes?

Step         ::= "step" String "{" (Desc | Focus | State | Animate | Static)* "}"
Desc         ::= "desc" String
Focus        ::= "focus" Identifier ("," Identifier)*
State        ::= "state" Identifier Attributes
Animate      ::= "animate" Identifier Arrow Identifier (":" String)? Attributes? AnimateBody?
Static       ::= "static" Identifier Arrow Identifier (":" String)? Attributes?
AnimateBody  ::= "{" (Desc | Code)* "}"
Code         ::= "code" CodeLang? (String CodeFence | CodeFence | String)
CodeLang     ::= Identifier

Attributes   ::= "[" (Attribute ("," Attribute)* ","?)? "]"
Attribute    ::= (Identifier | "desc") ":" Value
Value        ::= String | Number | HexColor | Identifier | "true" | "false"
```

Anything else is a `syntax-error`, or an `unexpected-eof` when the file ends before a statement or a block is complete. Three consequences that are easy to miss:

- **A statement takes at most one attribute block.** `[desc: "...", parallel: true]` is right; `[desc: "..."] [parallel: true]` is a syntax error. A comma after the last attribute is allowed.
- **The label of an `animate` or a `static` follows a colon.** `animate a --> b : "Label"` and `static a ..> b : "Label"`; without the `:`, the string is a syntax error. That of a `node` or a `group` takes none: `node a "Label"`, where `node a : "Label"` is a syntax error.
- **A `code` string takes no title.** The title string is followed by a code fence: `code json "Title" "{ ... }"` is a syntax error, and its message says so.

The grammar is looser than the language in a few places, so that a mistake gets a message of its own: a two-way arrow on a self-loop, or a number or a hex color as a value. The semantics below say which of these are errors.

### Semantics

#### The file

- **No header statement.** A `.dav` file starts directly with comments, whitespace, or statements (`title`, `group`, `node`, `step`).
- **`title` is optional.** It names the diagram. Given more than once, it reports `duplicate-title`, and the last one is used.
- **At least one `step` is required.** `.dav` v2 is exclusively for animated diagrams. A file without a `step` reports `missing-step`.
- **The top-level statements can come in any order,** and a reference may come before the declaration it names.

#### Identifiers and references

Nodes and groups share one namespace, and each identifier can be declared once. Declarations count in the order of the file, whatever their kind, and declaring a taken identifier again reports `duplicate-id`. A node or a group so declared is left out, and the members of a group left out belong to the group around it.

| What refers | What it may name |
| :--- | :--- |
| Each end of an `animate` | A node |
| Each end of a `static` | A node or a group |
| Each name in `focus` | A node or a group |
| The target of `state` | A node or a group |

A name that is declared as nothing reports `undefined-reference`, and one of another kind reports `reference-kind-mismatch`. An `animate` or `static` with such an end is ignored.

#### Attributes

Each attribute has a type:

| Type | Written as |
| :--- | :--- |
| string | A string: `"..."` |
| boolean | `true` or `false` |
| color | A color name, in any case: `red`, `orange`, `yellow`, `green`, `teal`, `blue`, `purple`, `pink`, `gray`. In `state` only, also `none`. A color is drawn in a shade that suits the light or dark theme |
| icon | An icon name, in any case. See [`node`](#node) |
| border | `solid` or `dashed`, in any case |
| mount | `border`, in any case |

Attribute names are lowercase, as the tables give them: `Icon` is an unknown attribute. Color and icon names are written without quotes: `color: "red"` reports `invalid-attribute-value`. No attribute takes a number. An attribute that the statement does not take reports `unknown-attribute` and is ignored. One that it takes, given twice in one block, reports `duplicate-attribute`, and the last one that is not ignored is used. A value of the wrong type, or not one of the allowed names, reports `invalid-attribute-value`, `invalid-color` or `unknown-icon`, and the attribute is ignored. A color or an icon written within two letters of a name, or one letter for a name of three letters or fewer, gets that name as a suggestion; `none` is never suggested, and a hex color gets no suggestion.

#### `group`

A group is a zone: a frame drawn round its members. It contains only groups and nodes, and groups can nest. A group has no visibility of its own: its frame is drawn in every step, also while every node in it is hidden. Its label is the string after its identifier, or the identifier when there is none; `""` gives an empty label.

| Attribute | Type | Default | Effect |
| :--- | :--- | :--- | :--- |
| `color` | color | none | Color of the zone |
| `border` | border | `solid` | Border stroke style (`solid` or `dashed`, e.g. for Availability Zones) |

#### `node`

A node belongs to the group it is declared in, or to none at the top level. Its label is the string after its identifier, or the identifier when there is none; `""` gives an empty label.

| Attribute | Type | Default | Effect |
| :--- | :--- | :--- | :--- |
| `icon` | icon | `server` | The symbol of the node |
| `sub` | string | none | A second line under the label |
| `badge` | string | none | A badge above the node |
| `visible` | boolean | `true` | Whether the node is shown in the overview and in a step unless `state`, `animate` or `static` includes it |
| `color` | color | none | Color of the ring, the icon and the badge |
| `mount` | mount | none | `border` mounts a grouped node onto its parent group's boundary on the side facing its external connections (ignored with `attribute-not-applicable` on top-level nodes) |

The 51 icons:

- **Infrastructure and logic (37):** `server`, `container`, `function`, `runtime`, `database`, `cache`, `queue`, `storage`, `lb`, `firewall`, `cdn`, `cloud`, `building`, `router`, `hub`, `wifi`, `external`, `auth`, `ai`, `api`, `mail`, `monitor`, `schedule`, `search`, `logic`, `webhook`, `payment`, `key`, `dns`, `shield`, `stream`, `event`, `nat`, `registry`, `warehouse`, `vault`, `audit`
- **Screens, actors and documents (14):** `screen`, `modal`, `browser`, `desktop`, `mobile`, `terminal`, `device`, `printer`, `chat`, `sheet`, `file`, `user`, `users`, `bot`

#### Overview

Before step 1 comes the overview: the structural map of the system with nothing dimmed, nothing moving, and no edge labels.

- **Nodes and groups:** Every group and every node whose declared `visible` is `true` is shown with its declared attributes. Nodes with `visible: false` reserve their space in the layout so nothing moves when a step reveals them, and are omitted from the overview until a step shows them.
- **Aggregated connections:** Overview lines are synthesized automatically from the `animate` and `static` statements across all steps whose both endpoints are visible in the overview.
  - All statements joining the same unordered pair of endpoints `{a, b}` (or self-loop `{a, a}`) collapse into a single rail.
  - **Arrowheads:** If both directions between `a` and `b` appear (either as `a --> b` and `b --> a` across statements, or as `<->` / `<.>`), the overview rail carries arrowheads at both ends. Otherwise it carries an arrowhead only at the target.
  - **Line style:** Solid if any `animate` or `static` on the pair uses a solid arrow (`-->` or `<->`); dashed if all use dashed arrows (`..>` or `<.>`).
  - **Labels:** Overview rails carry no text labels. Specific request, event, and relation names belong to each step.

#### `step`

The steps play in the order they are written, numbered from 1. The viewer opens on step 1 without playing it: its first phase repeats until the steps are played.

A step's string is its title. Its `desc` statements are its description, joined with line breaks when there are several. The viewer's playback bar shows two lines of it, and the whole text on hover; an exported picture shows two lines, the lines after the second running on at the end of it.

**Every statement inside a `step` applies to that step only.** `desc`, `focus`, `state`, `animate`, and `static` do not carry over to later steps.

##### `state`

`state` overrides attributes of a node or a group for its step only.

| Attribute | Type | On a node | On a group |
| :--- | :--- | :--- | :--- |
| `badge` | string | The badge for this step. `""` removes a declared badge for this step | Not applicable |
| `visible` | boolean | Shows or hides the node in this step | Not applicable |
| `color` | color, or `none` | The color for this step. `none` clears a declared color for this step | The color for this step. `none` clears a declared color for this step |

- **Step-local only.** In step *k*, only the `state` statements inside step *k* apply on top of the node's or group's declared attributes. When multiple `state` statements in the same step target the same attribute, the last one wins.
- **A state shows from the start of its step,** before the first packet of that step moves.
- An attribute that does not apply to its kind of target reports `attribute-not-applicable` and changes nothing on the target, though `visible: false` still keeps the `state` from emphasizing it, as below. An empty block, `state a []`, reports `empty-state`.

##### What a step shows

A step emphasizes the nodes and groups named in its `focus`, the targets of its `state` statements (except `visible: false`), both nodes of each `animate`, and both endpoints of each `static`.

- **When a step emphasizes anything, the rest is dimmed.** A node is dimmed unless it, or a group around it, is emphasized. A group is dimmed unless it, a group around it, or something inside it is emphasized.
- **A node is shown** when it is visible (as declared or overridden by `state` in this step), and also when an `animate` or `static` in this step uses it as an endpoint.
- **Connections drawn in the step:** A step draws every connection declared by its own `animate` and `static` statements, plus any overview connection whose two endpoints are both visible and undimmed in that step. A step that emphasizes nothing dims nothing and draws all overview connections between visible nodes.

##### `animate`

`animate` declares a connection in the diagram and moves a packet along it during the step.

| Arrow | Line | Packet behavior |
| :--- | :--- | :--- |
| `-->` | Solid | Goes from the first node to the second |
| `..>` | Dashed | Goes from the first node to the second |
| `<->` | Solid | Goes to the second node, rests there a moment, and comes back: about twice as long as a one-way packet on the same way |
| `<.>` | Dashed | Goes to the second node, rests there a moment, and comes back: about twice as long as a one-way packet on the same way |

| Attribute | Type | Default | Effect |
| :--- | :--- | :--- | :--- |
| `icon` | icon | none | Draws the packet as a chip that shows what it carries, instead of a dot |
| `color` | color | the accent color | Color of the packet and of the line it runs on |
| `parallel` | boolean | `false` | Plays in the same phase as the `animate` before it |
| `desc` | string | none | Text of the packet's callout |
| `code` | string | none | A code snippet in the callout. See [`code`](#code) |

- **The label** after `:` names what the packet carries, and is shown with it.
- **The rail** follows the layout's routed path between the two endpoints; in the step, its line takes the arrow style (`-->`/`<->` solid, `..>`/`<.>` dashed) of the `animate`.
- **On a self-loop,** `animate a --> a` and `animate a ..> a` go round the loop at the upper right of the node once. A two-way arrow (`<->` or `<.>`) on a self-loop reports `invalid-self-arrow`.
- **Phases.** The `animate` statements of a step play one after another, each in a phase of its own. `parallel: true` puts an `animate` in the phase of the one before it, so that they leave together; on the first `animate` of a step it has no effect. A packet takes longer the longer its way on screen is and the more packets share its phase, and a phase lasts until its last packet arrives, with a short pause after it. A packet, its callout and the color it gives its line last for its phase; when packets of one phase run on the same pair, the line takes the color of the first. When a step has more than one phase, each packet is numbered by its phase, with a letter for each of several in one phase: `1`, `2a`, `2b`. The number shows on its callout and at a stop halfway along its way.
- **Still pictures.** Where nothing moves, in a still export of a step or in the viewer with motion stopped, no packet and no callout is drawn: the lines the step's packets run on are lit, each in the color of the first packet on it. In a stopped viewer, picking a node shows, stopped on their way and with their callouts, the packets of a phase in which it sends a packet, or, if it sends none, in which it receives one: the first such phase, or, while one of them is shown after a pick, however it was picked, the next one, and after the last one the still picture again. A reader who asks for reduced motion gets a viewer that is always stopped.
- **Its description** is the `desc` attribute followed by the `desc` statements of its body, joined with line breaks. In a description, the whitespace at the start and the end of each line is dropped, so it cannot be indented, and whitespace in a row shows as one space, though the viewer's playback bar counts only spaces and tabs as whitespace here; a packet's callout, and a step's description in an exported picture, leave out empty lines. A packet's callout shows up to four lines; the lines after the fourth run on at the end of it. A packet with no label, `desc` or `code` has no callout.

##### `static`

`static` declares a connection that exists during its step without moving a packet along it—such as background monitoring, asynchronous replication, or an idle dependency relevant to the scene.

| Arrow | Line | Arrowheads |
| :--- | :--- | :--- |
| `-->` | Solid | At the second endpoint |
| `..>` | Dashed | At the second endpoint |
| `<->` | Solid | At both endpoints |
| `<.>` | Dashed | At both endpoints |

| Attribute | Type | Default | Effect |
| :--- | :--- | :--- | :--- |
| `color` | color | default edge color | Color of the line during this step |

- **The label** after `:` is drawn on the line during this step only. It is not shown in the overview.
- **On a self-loop,** `static a --> a` and `static a ..> a` draw a static loop at the upper right of the node. A two-way arrow (`<->` or `<.>`) on a self-loop reports `invalid-self-arrow`.
- **Both endpoints** are visible and emphasized during this step, just as for `animate`.

##### `code`

`code` gives an example of what the packet carries, drawn in a frame in the packet's callout, with the language and the title above it. It is written in the body of `animate`, or as its `code` attribute:

| Form | Language | Title |
| :--- | :--- | :--- |
| ```` code json "Title" ``` ... ``` ```` | Optional | Optional |
| `code json "..."` | Optional | None: `code json "Title" "..."` is a syntax error |
| `[code: "..."]` | None | None |

- **The language** is any identifier. It names the code above it; every language is colored alike.
- **The text is drawn tidied,** whatever its form: line breaks, a `\r` on its own included, become `\n`, each tab becomes two spaces, whitespace at the end of a line is removed, the blank lines at the start and at the end are removed, and so is the indentation that all its lines that are not blank share, counted in spaces. Otherwise, the text of a code fence is taken as written, and that of a string with its escapes, `\n` for a line break.
- **Empty code,** of whitespace only, draws no frame.
- **One per `animate`.** The attribute and each `code` statement count; two `code` attributes in one block are a `duplicate-attribute` instead. Each one after the first reports `duplicate-code`, and the last one that is not empty is used.

### Formatting

The formatter writes a file in its canonical form, without changing what it means. VS Code formats a `.dav` file on request, and `dav format` and `dav check --write` do the same.

- One space between tokens: `animate a --> b : "Label" [key: value, key: value]` and `static a ..> b : "Label" [color: yellow]`, and no comma after the last attribute.
- Two spaces of indentation for each level of `{ }`. An empty `group` or `step` body is written `{}`, and an empty `animate` body is dropped.
- Comments are kept. A comment after a statement stays on its line; one after a `{` goes to the next line. Two blank lines or more become one, and the blank lines at the start and the end of the file and of a block are removed.
- A file with any `\r\n` line ending gets `\r\n` on every line; any other file gets `\n`. The file ends with one line ending, and a file of whitespace only becomes empty.
- The text of a code fence is tidied: a `\r` on its own becomes a line break, tabs become two spaces, and whitespace at the end of a line and the indentation that all its lines that are not blank share, counted in spaces, are removed. It goes on lines of its own, two spaces deeper than its `code`, with the closing backticks on a line of their own, so a one-line fence with one line of code in it becomes three lines. A `code` string stays on one line.
- A statement with a comment among its own words is kept as written, but indented to its depth and without spaces at the ends of its lines. For a `group`, a `step` or an `animate`, a comment before its `{` keeps its body as written too, and the lines of a code fence in it keep their own indentation. A `code` statement with a comment among its words is kept as written up to its code fence, which is laid out as above. A file with a `syntax-error`, an `unexpected-eof`, or a string that runs over a line break is not changed.

### Diagnostics

A diagnostic does not stop the rest of the file from being read, and the table says what becomes of what is in error where it matters. After a `syntax-error`, the diagnostics that follow it can come from it: fix the first one, and read the file again. A file with an error is not valid, and how it is drawn is not defined beyond that; `dav export` exports nothing from it.

| Code | Severity | Reported when |
| :--- | :--- | :--- |
| `missing-step` | Error | The file declares no `step` |
| `duplicate-title` | Warning | `title` appears more than once. The last one is used |
| `duplicate-id` | Error | An identifier (`node` or `group`) is declared more than once. A node or a group declared later is left out |
| `undefined-reference` | Error | `focus`, `state`, `animate`, or `static` names an identifier that is not declared |
| `reference-kind-mismatch` | Error | A name is of the wrong kind, such as a group as an end of an `animate` |
| `unknown-attribute` | Warning | The statement does not take the attribute. It is ignored |
| `duplicate-attribute` | Warning | An attribute that the statement takes appears twice in one block. The last one that is not ignored is used |
| `duplicate-code` | Warning | An `animate` has more than one `code`. The last one that is not empty is used |
| `invalid-attribute-value` | Error | The value has the wrong type. The attribute is ignored |
| `attribute-not-applicable` | Warning | A `state` attribute does not apply to its kind of target, or `mount: border` is used on a top-level node. It changes nothing on the target, though `visible: false` on `state` still keeps the `state` from emphasizing it |
| `empty-state` | Warning | A `state` has an empty attribute block |
| `unknown-icon` | Error | The icon is not one of the 51. A name within reach is suggested, as [Attributes](#attributes) says |
| `invalid-color` | Error | The color is not one of the nine names, or `none` outside `state`, or a hex color. A name within reach is suggested, as [Attributes](#attributes) says |
| `invalid-self-arrow` | Error | An `animate` or `static` from a node to itself uses `<->` or `<.>` |
| `invalid-escape` | Error | A string contains an escape other than `\"`, `\\`, `\n` and `\t` |
| `unexpected-eof` | Error | The file ends before a statement or a `{ }` or `[ ]` block is complete, outside a string and a code fence, and no `syntax-error` came before |
| `syntax-error` | Error | Anything else the grammar does not allow, such as a `dav` header, top-level edge syntax, a string or a code fence that the file ends inside. For a `code` string given a title on the same line, the message says that only a code fence takes one |

<!-- End of the language specification. -->

## Getting the layout you want

- **Backbone flows left to right.** Write the normal forward sequence in the earliest steps: the layout infers primary flow order from `animate` statements in step order and separates cross-cutting `static` zones into bands automatically.
- **No layout workarounds.** Do not reverse arrows, invent `<->` edges, or reorder declarations to push nodes around. Return paths (responses, retries, callbacks) are automatically recognized as returns and will not distort the left-to-right backbone.
- **Groups keep nodes together.** Nest groups to represent real architectural boundaries (cloud, VPC, subnets, services).
- There is no syntax for positions. Do not try to add any.

When it matters which node is where, run the checker with `--map`. `--detail` describes the layout in numbers. [references/checker.md](references/checker.md) explains both, and [the layout guide](references/layout.md) has more.

## Scripting steps

- **Keep each step to one idea,** usually two to five packets. Start a new step where the outcome changes. The player numbers steps, so titles do not need numbers.
- **Steps are self-contained.** Every `desc`, `focus`, `state`, `animate` and `static` applies to that step alone. Repeat a `state` in any step where that status still holds; no manual reset is needed when it no longer holds.
- **Order packets deliberately.** Each `animate` is one phase, played in order. `[parallel: true]` joins the preceding one for concurrent work.
- **Use `static` for background links.** Replication, logging, monitoring, or standby connections that should appear without moving a packet belong in `static`.
- **Use `<->` or `<.>` in `animate` for a call and its answer** when one label and `desc` can say both; use two packets when the answer needs words of its own, such as an error.
- **Use self-loops (`-->` or `..>`) for internal work,** such as retries or state transitions: `animate order --> order : "Retry"`. Self-loops cannot use `<->` or `<.>`.

### Writing `desc`

A packet's label says **what** is sent. Its `desc` says what that **does**: the decision, the check, the effect. Do not repeat the label.

| Label | Weak `desc` | Good `desc` |
| :--- | :--- | :--- |
| `"POST /orders"` | `"Sends a POST request"` | `"The customer submits the cart with an idempotency key"` |
| `"SELECT stock"` | `"Queries the database"` | `"Stock is checked before the card is charged"` |
| `"OrderPaid event"` | `"Publishes an event"` | `"Shipping and mail react to this event on their own"` |

### Writing `code`

A `code` block shows an example of what the packet carries. Give it to the packets a reader would want to see inside, one to a packet. Write it between two lines of three backticks, as in the reference example. Keep it to at most 10 lines of 55 characters (35 Japanese). Never put real secrets, tokens or personal data in it.

## Common mistakes

| Wrong | Right | Diagnostic |
| :--- | :--- | :--- |
| `dav 1` at the top of the file | Omit the header; start with `title`, `group`, `node` or `step` | `syntax-error` |
| Top-level `a --> b : "HTTPS"` | Declare inside a `step` as `animate` or `static` | `syntax-error` |
| File with no `step` | Add at least one `step "..." { ... }` | `missing-step` |
| `animate a --> my_group` | Point at a node inside the group | `reference-kind-mismatch` |
| `[color: #ff0000]` | `[color: red]` | `invalid-color` |
| `[icon: postgres]` | `[icon: database, sub: "PostgreSQL"]` | `unknown-icon` |
| `node step "Step"` | `node step_1 "Step"` | `syntax-error` |
| Two `code` entries on one `animate` | Combine into a single `code` block | `duplicate-code` |
| `animate a --> b : "x" [desc: "y"] [parallel: true]` | One block: `[desc: "y", parallel: true]` | `syntax-error` |
| `animate a --> b` with no label or `desc` | `animate a --> b : "What" [desc: "Why"]` | hint `animate-without-desc` |
| `node db "PostgreSQL primary database server"` | `node db "Orders DB" [sub: "PostgreSQL"]` | hint `text-cut` |

## More detail

Read these only when needed:

- [references/large-diagrams.md](references/large-diagrams.md): before writing a diagram of about 50 nodes or more, or of 4 zones or more with connections between them
- [references/checker.md](references/checker.md): when the checker prints a line or a code you do not know, and to read the layout lines and the map
- [references/specification.md](references/specification.md): the specification above, with its examples, its design goals and v2 compatibility notes
- [references/layout.md](references/layout.md): layout principles and recipes
- `assets/examples/`: complete diagrams
  - `01-infra-ha-failover.dav`: infrastructure and failover
  - `02-screen-flow-checkout.dav`: screen flow
  - `03-event-driven-async.dav`: event-driven system
  - `04-enterprise-zero-trust-payment.dav`: large architecture with nested groups
  - `05-sequence-payment-retry.dav`: sequence-style flow with retries
  - `06-lan-office-network.dav`: network diagram
  - `07-dynamic-architect-viewer.dav`: software pipeline with export and import
