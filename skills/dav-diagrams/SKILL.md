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

   Do not invent components. If a fact is missing and the user cannot be asked, leave it out. A reply on a connection is not another connection: where a scene shows the reply, write that edge as `<->`, even if the facts name only the call. Where no scene shows a reply, the edge stays one-way. When changing an existing `.dav` file, edit it in place and keep its IDs and comments.

   **Count them.** About 50 nodes or more, or 4 zones or more with edges between them, make a large diagram: read [references/large-diagrams.md](references/large-diagrams.md) before step 2.
2. **Declare the structure:** `node`, `group`, then edges. Write each edge as the facts give it, from the caller: edges set the columns, so a caller stands to the left of what it calls, and [Getting the layout you want](#getting-the-layout-you-want) says what to do with a call that runs back. Declare an edge for every way a packet will go, a self-loop (`api --> api`) for a node that retries or changes state on its own included. Write the file with your file tools, not through a shell heredoc, which takes the quotes and backticks of a `.dav` file for its own.
3. **Script the steps,** one scene per `step`. See [Scripting steps](#scripting-steps).
4. **Fill in the detail** until the file meets [What a detailed diagram has](#what-a-detailed-diagram-has).
5. **Validate, format and review.** `<skill-dir>` is the directory that contains this file:

   ```bash
   node <skill-dir>/scripts/dav-check.mjs --write --detail path/to/diagram.dav
   ```

   It uses the same parser and formatter as the VS Code extension. `--write` formats the file. `--detail` also reports where the diagram says too little and which texts are too long to be shown in full, and describes the layout.

   Fix every `error`, `warning` and `hint` line, and run it again after every fix, until it exits with `0`. `layout` and `note` lines describe the layout and do not fail the check: act on a note if its reason applies. In a large diagram, add `--map`, which says where each zone and node ended, and expect two notes that are to be left: `stacked-zone` for peers gathered in one zone, such as people or outside services, and `left-links` for edges written as you mean. Stop when `--map` shows the zones in the order you mean and no note names something written other than you mean: a few links that point left and some crossings are the price of placing zones freely, and turning edges to trade one for the other is no progress. `ok (...)` says that nothing is left to fix in the file. The checker never sees the code, so it does not say that the diagram is true: that comes from step 1. [references/checker.md](references/checker.md) explains every line and code. Leave out `--detail` only when the user asked for a minimal diagram.
6. **Report.** Give the path, and tell the user to open the file in VS Code with the [DynamicArchitectViewer extension](https://marketplace.visualstudio.com/items?itemName=osg-junue.dynamic-architect-viewer) and press `Ctrl+Shift+V` (`⌘⇧V` on macOS). The checker describes the layout but does not render it, so never claim to have seen the result. When the user wants an SVG or an HTML file of the diagram, for a README or to send to someone, use the `dav-cli` skill. If Node.js is unavailable, compare the file against [the specification](references/specification.md) and the lists below by hand, and say that it was not validated.

**A large diagram,** as step 1 counts it, needs more than this page says: read [references/large-diagrams.md](references/large-diagrams.md) before writing it. It says what the layout does and does not do, which zones to make, and how to write the diagram in rounds, the structure first and the steps after.

Write titles, labels and descriptions in the user's language. IDs must stay ASCII.

## What a detailed diagram has

| Part | It has |
| :--- | :--- |
| Node | A short label, an `icon` that matches its kind, and a `sub` with its technology or role: `[icon: database, sub: "PostgreSQL"]` |
| Group | One per boundary that matters: a network, a team, a trust zone, a deployment. A `color` when zones should be told apart |
| Edge | A label that says what travels or how the two are related: `"HTTPS"`, `"SQL"`, `"Publishes"` |
| Diagram | The normal flow, then each failure or alternative, each scenario a run of steps of its own. A scenario usually takes 2 to 4 steps, and a diagram of one or two scenarios 3 to 8. More scenarios take more steps: the checker sets no limit |
| Step | A title that names the scene, and a `desc` of one or two sentences that says what happens and why |
| Packet (`animate`) | A concrete label (`"POST /orders"`, `"OrderPaid event"`, `"SELECT stock"`), a `desc` that says what the message does or decides, and an `icon` for what it carries |
| Code | A `code` block on the packets whose content matters: the request, the query, the event, the response. At least one in the diagram; one or two per step is typical |
| State | A `badge` for a status that changes (`"PENDING"`, `"503"`, `"DOWN"`), with a `color`, and removed again when it no longer holds |

Keep the example values consistent: the order that is created as `ord_104` in step 1 is still `ord_104` in step 3.

### Text that fits

Nothing wraps except `desc`. A longer text is cut off with `…`, and `--detail` reports it. Letters differ in width: a text full of capitals or of `m` and `w` fits fewer characters than the table says, and one full of `i` and `l` more.

| Text | Fits about (Latin letters) | Fits about (Japanese) |
| :--- | :--- | :--- |
| Node label | 20 | 12 |
| Node `sub` | 26 | 15 |
| `badge` | 16 | 10 |
| Edge label | 28 | 16 |
| `animate` label | 44 | 27 |
| `animate` `desc` | 170, in up to four lines | 95 |
| `code` | 10 lines of 55 characters | 10 lines of 35 |

A zone's name is as wide as its zone. Only a zone one column wide is narrow enough to cut a name of usual length: it has room for about 20 Latin letters or 11 Japanese characters, and a zone two columns wide for about 50 or 25. The checker reports every other text that is cut off, but not a zone's name, so once the structure is settled, find the zones of one column in the line of zones of `--detail`, such as `"External" 1 x 5`, and shorten each of their names that is longer. No other name needs counting. When an official name is longer than its place, keep a short label and give the full name in `sub` or in a `desc`, such as `node bank "取引銀行API" [icon: api, sub: "インターネットバンキングAPI"]`.

The column to read depends on the characters, not on the language of the diagram: SQL, JSON and HTTP are Latin letters in a Japanese diagram too, so a line of `code` fits about 55 there as well.

A step's own `desc` is shown above the diagram and has no such limit; keep it to one or two sentences anyway.

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
    code json "{ \"orderId\": \"ord_104\", \"status\": \"PAID\" }"
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

## Language rules

- The first statement must be `dav 1`. `title "..."` is optional and may appear once.
- IDs match `[A-Za-z_][A-Za-z0-9_]*` and share one namespace across nodes, groups and edge `id`s. Statements after the header can come in any order.
- Strings use double quotes only. The escapes are `\"`, `\\`, `\n` and `\t`. Comments start with `//`.
- `group` may contain only `group` and `node`. Edges and `step` are top-level statements.
- Edges and `animate` connect nodes, never groups.

Reserved words, which cannot be IDs: `dav`, `title`, `group`, `node`, `step`, `desc`, `focus`, `state`, `animate`, `true`, `false`.

| Statement | Form | Attributes |
| :--- | :--- | :--- |
| Group | `group id "Label" [...] { ... }` | `color` |
| Node | `node id "Label" [...]` | `icon`, `sub`, `badge`, `color`, `visible` |
| Edge | `a --> b : "Label" [...]` | `id`, `color`, `visible` |
| State | `state id [...]` | Node: `badge`, `color`, `visible`. Group: `color`. Edge: `color`, `visible` |
| Animate | `animate a --> b : "Label" [...] { ... }` | `icon`, `color`, `parallel`, `desc`, `code` |

The `:` before an edge or `animate` label is required. Attribute blocks are `[key: value, key: value]`, one block to a statement: `[desc: "...", parallel: true]`, never `[desc: "..."] [parallel: true]`. `code` is contextual inside `animate { ... }`, so `node code` remains a valid ID.

| Arrow | Line | Direction | Written in `animate` |
| :--- | :--- | :--- | :--- |
| `-->` | Solid | One way | One way |
| `..>` | Dashed | One way | Not allowed |
| `<->` | Solid | Both | There and back |
| `<.>` | Dashed | Both | Not allowed |

A packet runs along a dashed edge as well, written `-->` or `<->`: in the example above, `animate api <-> backup` runs along `api <.> backup`.

When the two directions of a two-way edge carry different things, name both in its label: `hvac <-> gw : "Status / setpoints"`. Two one-way edges in opposite directions would make a loop, and the layout leaves one of them out.

### Colors

`red`, `orange`, `yellow`, `green`, `teal`, `blue`, `purple`, `pink`, `gray`

Hex codes are rejected. `color: none` is valid only in `state`, where it returns to the declared color.

### Icons

Without `icon`, a node uses `server`.

`server`, `container`, `function`, `runtime`, `database`, `cache`, `queue`, `storage`, `lb`, `firewall`, `cdn`, `cloud`, `building`, `router`, `hub`, `wifi`, `external`, `auth`, `ai`, `api`, `mail`, `monitor`, `schedule`, `search`, `logic`, `webhook`, `payment`, `key`, `screen`, `modal`, `browser`, `desktop`, `mobile`, `terminal`, `device`, `printer`, `chat`, `sheet`, `file`, `user`, `users`, `bot`

There is no icon for a product. Pick the kind, and name the product in `sub`: `[icon: database, sub: "PostgreSQL"]`, `[icon: queue, sub: "Kafka"]`.

## Getting the layout you want

- **Edges set the column.** A node sits to the right of whatever points at it, and the longest path wins. Where the zones are placed freely, this holds inside each zone, and a link between zones sets no column.
- **Groups keep nodes together.** Declaration order breaks ties from top to bottom, so swap two declarations to swap two nodes in a column.
- **The zones of a large diagram follow their links, not the order of their declarations,** and only zones nested in one zone are sure to stand together. The search that places them starts from the order of the declarations and prefers links that point right, so moving a declaration or turning an edge between zones can move zones too, but not into an order you choose. `--detail` says `zones placed freely` when this happens, and names each link between zones that points left in a note `left-links`. [references/large-diagrams.md](references/large-diagrams.md) says how to choose the zones.
- **In a cycle, the node reached first goes on the left.** Columns come from a search that starts at the nodes in the order they are declared and follows edges in the order they are written, and the edge that closes a loop does not count. A loop that nothing else leads into is entered at its node declared first. A loop that another node leads into is entered there, whatever the order of its own nodes: in a large diagram, that is most loops. `--detail` names the edge left out in a note `back-edge`, with the loop, the column its far end took, and the node to declare earlier to start the loop elsewhere. Where the zones are placed freely, only a loop inside one zone leaves an edge out.
- **A one-way edge that points back pulls its target to the right of its source,** and the target's zone with it, unless the search reached the source through that target. A command sent back to a device, an on-call engineer who opens a console on the far left, a webhook that an outside service calls back with, or a subscription to a topic that stands further right, is such an edge. Write it as one two-way edge: a two-way edge counts only in the direction it is written, and a packet can run along it either way.
- **A two-way edge names first the node that belongs on the left.** For a request and its response, that is the caller: `api <-> db`. For a call against the reading direction, it is the node called: `gw <-> svc`, where `svc` sends commands to `gw`. A two-way edge is drawn with an arrowhead at each end, so where only one side calls, say which in its label: `oncall <-> pagerduty : "Pages (from PagerDuty)"`. A job that reads a store is the caller too: `etl --> db`, or `db <-> etl` where the database belongs on the left. Never turn a one-way edge round for the layout: its arrow would then say that the other node calls.
- **`animate` and `step` never affect layout.** A hidden node keeps its place, so nothing moves when it appears, and writing steps never moves what the structure has settled.
- There is no syntax for positions. Do not try to add any.

When it matters which node is where, because the user asks how the diagram looks or wants one thing left of, right of or above another, run the checker with `--map`. `--detail` describes the layout in numbers. [references/checker.md](references/checker.md) explains both, and [the layout guide](references/layout.md) has recipes for moving a node.

## Scripting steps

| Statement | Lasts for | Use it to |
| :--- | :--- | :--- |
| `desc` | This step | Explain what happens, in one or two sentences |
| `focus` | This step | Dim everything except the listed nodes and groups: `focus api, db` |
| `state` | **This step and all later ones,** from the start of the step | Change a badge, color or visibility |
| `animate` | This step | Move a packet between two nodes |

- **Keep each step to one idea,** usually two to five packets. Start a new step where the outcome changes: the request and the failure it meets are one scene, the reaction to it (a retry, a rollback, a fallback) is the next. A request or a reply that passes through several nodes may take a step past five packets; do not cut a path in two to stay under a count. The player numbers steps, so titles do not need numbers.
- **Mark a step that shows another outcome.** A failure or an alternative that replaces part of the normal flow does not come after the last step in time: it starts again where it parts from that flow. Say so in the title and the `desc` (`"Payment fails: the card is declined"`, `"The same order again, up to the charge"`), set each badge and color back to what it was at that point, and keep the same example values. Otherwise the steps read as one timeline, in which a paid order becomes pending again. In the first step after it that belongs to another scenario, clear the badges and colors it set.
- **Order packets deliberately.** Each `animate` is one phase, played in order. `[parallel: true]` joins the preceding one, for work that really is concurrent.
- **Run packets along declared edges.** A packet without an edge has no line to follow, and `--detail` reports it with the hops to send instead or the edges to make two-way. A packet runs either way along a two-way edge, written `-->` or `<->` from either end: `animate gw --> hvac` runs along `hvac <-> gw`. For replies, make the edge `<->` or declare a separate reverse edge, and send a reply back through every node the request came through. Leave out a reply that tells nothing new, such as a plain success at the end of a long path. Two edges in opposite directions do not need an `id`, but a second edge in the same direction does.
- **Use `<->` in `animate` for a call and its answer,** when the answer needs no words of its own. Use two packets when the answer matters, such as an error.
- **Clean up `state`.** Badges and colors carry over. To end one, write `badge: ""` or `color: none` in the first step where it no longer holds, or a badge from step 2 will still be showing in step 8. Where one scenario ends and another begins, clear the last one's badges and colors in the first step of the next.
- **Show a status where it holds.** A `state` shows from the start of its step, before its first packet moves: a step shows what holds while it plays. To show a status that a packet of a step brings about, such as a job paused by a request, set it in the next step, which then shows the outcome. Where a scenario ends on such a status, such as an order paid at last, give it a short last step with that `state` and a `desc`: otherwise it is never seen, because the scenario ends before it shows and the next one starts by clearing it.
- **Let `animate` and `state` set the emphasis.** Their targets are emphasized automatically, so add `focus` only for nodes that have neither. Any of the three dims the other nodes and hides the edges that do not join two emphasized nodes, so `focus` on both ends of an edge is also how to keep that edge on screen.
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

A `code` block shows an example of what the packet carries. Give it to the packets a reader would want to see inside. There are three ways to write it, and one `animate` takes at most one:

````
// 1. Several lines, between two lines of three backticks. Language and title are optional.
animate api --> db : "INSERT order" [desc: "The order is saved before any money moves"] {
  code sql "Write" ```
    INSERT INTO orders (id, amount, status)
    VALUES ('ord_104', 4200, 'PENDING');
  ```
}

// 2. One line, as a string. The language is optional, and it takes no title. Escape the double quotes.
animate api --> browser : "201 Created" {
  code json "{ \"orderId\": \"ord_104\" }"
}

// 3. One line, as an attribute.
animate api --> cache : "GET cart" [code: "GET cart:88"]
````

| The packet is | Show | Language |
| :--- | :--- | :--- |
| An HTTP request | The method and path, one or two headers that matter, the body | `http` |
| An HTTP response or a JSON message | The status and the two to five fields that matter | `json` |
| A query or a write | The statement with realistic values | `sql` |
| An event or queue message | The event name and its key fields | `json` |
| A command, a config or a log line | The line itself | `sh`, `yaml`, `text` |

The language is any word, such as `csv` for the rows of a file: it is shown above the code, and code in every language is colored alike.

Keep it to the lines that matter, at most 10 lines of 55 characters. Break a longer line where it reads naturally: after a comma in JSON, before a clause in SQL. Never put real secrets, tokens or personal data in it: use obvious placeholders such as `tok_test_123`.

## Common mistakes

| Wrong | Right | Diagnostic |
| :--- | :--- | :--- |
| `a --> b "Label"` | `a --> b : "Label"` | `syntax-error` |
| `animate a ..> b` | `animate a --> b` | `invalid-animate-arrow` |
| `state a --> b [...]` | Give the edge an `id`, then `state e_id [...]` | `syntax-error` |
| `focus e_id` | `focus` takes nodes and groups only | `reference-kind-mismatch` |
| `a --> my_group` | Point at a node inside the group | `reference-kind-mismatch` |
| `[color: #ff0000]` | `[color: red]` | `invalid-color` |
| `[icon: postgres]` | `[icon: database, sub: "PostgreSQL"]` | `unknown-icon` |
| `node step "Step"` | `node step_1 "Step"` | `syntax-error` |
| `state group_id [badge: "x"]` | Groups accept only `color` | `attribute-not-applicable` |
| `[color: none]` on a node | Omit `color` | `invalid-color` |
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
- [references/specification.md](references/specification.md): the grammar, every attribute and every diagnostic
- [references/layout.md](references/layout.md): recipes and the exact placement rules
- `assets/examples/`: complete diagrams
  - `01-infra-ha-failover.dav`: infrastructure and failover
  - `02-screen-flow-checkout.dav`: screen flow
  - `03-event-driven-async.dav`: event-driven system
  - `04-enterprise-zero-trust-payment.dav`: large architecture with nested groups
  - `05-sequence-payment-retry.dav`: sequence-style flow with retries
  - `06-lan-office-network.dav`: network diagram
  - `07-dynamic-architect-viewer.dav`: software pipeline with export and import
