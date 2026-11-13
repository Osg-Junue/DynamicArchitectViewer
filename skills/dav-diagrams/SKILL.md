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
   - which component calls which, and over what (protocol, queue, SQL);
   - the scenarios to show, in order: the normal flow first, then failures or alternatives;
   - for each message in a scenario: what is sent, and a realistic example of it.

   Do not invent components. If a fact is missing and the user cannot be asked, leave it out. When changing an existing `.dav` file, edit it in place and keep its IDs and comments.
2. **Declare the structure:** `node`, `group`, then edges. Write edges in the direction the diagram should read, because they set the columns.
3. **Script the steps,** one scene per `step`. See [Scripting steps](#scripting-steps).
4. **Fill in the detail** until the file meets [What a detailed diagram has](#what-a-detailed-diagram-has).
5. **Validate, format and review.** `<skill-dir>` is the directory that contains this file:

   ```bash
   node <skill-dir>/scripts/dav-check.mjs --write --detail path/to/diagram.dav
   ```

   It uses the same parser and formatter as the VS Code extension. `--write` formats the file. `--detail` also reports where the diagram says too little and which texts are too long to be shown in full.

   | Line it prints | Meaning | What to do |
   | :--- | :--- | :--- |
   | `file:line:column: error code: message` | The file does not compile | Fix it |
   | `file:line:column: warning code: message` | Part of the file is being ignored | Fix it |
   | `file: hint code: message` | Detail is missing, or a text is cut off | Do what the message says |
   | `file: ok (...)` | Nothing left | Done |

   | Exit code | Meaning |
   | :--- | :--- |
   | `0` | Nothing was reported |
   | `1` | At least one error, warning or hint |
   | `2` | Bad arguments or an unreadable file |

   Run it again after every fix, until it exits with `0`. Leave out `--detail` only when the user asked for a minimal diagram.
6. **Report.** Give the path, and tell the user to open the file in VS Code with the [DynamicArchitectViewer extension](https://marketplace.visualstudio.com/items?itemName=osg-junue.dynamic-architect-viewer) and press `Ctrl+Shift+V` (`⌘⇧V` on macOS). The checker does not render, so never claim to have seen the result. If Node.js is unavailable, compare the file against [the specification](references/specification.md) and the lists below by hand, and say that it was not validated.

Write titles, labels and descriptions in the user's language. IDs must stay ASCII.

## What a detailed diagram has

| Part | It has |
| :--- | :--- |
| Node | A short label, an `icon` that matches its kind, and a `sub` with its technology or role: `[icon: database, sub: "PostgreSQL"]` |
| Group | One per boundary that matters: a network, a team, a trust zone, a deployment. A `color` when zones should be told apart |
| Edge | A label that says what travels or how the two are related: `"HTTPS"`, `"SQL"`, `"Publishes"` |
| Diagram | 3 to 8 steps: the normal flow, then each failure or alternative as its own steps |
| Step | A title that names the scene, and a `desc` of one or two sentences that says what happens and why |
| Packet (`animate`) | A concrete label (`"POST /orders"`, `"OrderPaid event"`, `"SELECT stock"`), a `desc` that says what the message does or decides, and an `icon` for what it carries |
| Code | A `code` block on the packets whose content matters: the request, the query, the event, the response. At least one in the diagram; one or two per step is typical |
| State | A `badge` for a status that changes (`"PENDING"`, `"503"`, `"DOWN"`), with a `color`, and removed again when it no longer holds |

Keep the example values consistent: the order that is created as `ord_104` in step 1 is still `ord_104` in step 3.

### Text that fits

Nothing wraps except `desc`. A longer text is cut off with `…`, and `--detail` reports it.

| Text | Fits about (Latin letters) | Fits about (Japanese) |
| :--- | :--- | :--- |
| Node label | 18 | 11 |
| Node `sub` | 22 | 13 |
| `badge` | 15 | 9 |
| Edge label | 25 | 15 |
| `animate` label | 38 | 23 |
| `animate` `desc` | 150, in up to four lines | 85 |
| `code` | 10 lines of 55 characters | 10 lines of 30 |

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
  state db [badge: "PENDING"]
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
  state db [badge: "PAID", color: green]
  state primary [badge: "", color: none]
  animate api --> db : "UPDATE order" [desc: "The order moves from PENDING to PAID"]
  animate api --> browser : "201 Created" [color: green, desc: "The customer sees the confirmation page"] {
    code json "{ \"orderId\": \"ord_104\", \"status\": \"PAID\" }"
  }
}
````

What to notice:

- The backup provider and its edge are declared with `visible: false` and shown by `state` in the step that needs them.
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

The `:` before an edge or `animate` label is required. Attribute blocks are `[key: value, key: value]`. `code` is contextual inside `animate { ... }`, so `node code` remains a valid ID.

| Arrow | Line | Direction | In `animate` |
| :--- | :--- | :--- | :--- |
| `-->` | Solid | One way | One way |
| `..>` | Dashed | One way | Not allowed |
| `<->` | Solid | Both | There and back |
| `<.>` | Dashed | Both | Not allowed |

### Colors

`red`, `orange`, `yellow`, `green`, `teal`, `blue`, `purple`, `pink`, `gray`

Hex codes are rejected. `color: none` is valid only in `state`, where it returns to the declared color.

### Icons

Without `icon`, a node uses `server`.

`server`, `container`, `function`, `runtime`, `database`, `cache`, `queue`, `storage`, `lb`, `firewall`, `cdn`, `cloud`, `building`, `router`, `hub`, `wifi`, `external`, `auth`, `ai`, `api`, `mail`, `monitor`, `schedule`, `search`, `logic`, `webhook`, `payment`, `key`, `screen`, `modal`, `browser`, `desktop`, `mobile`, `terminal`, `device`, `printer`, `chat`, `sheet`, `file`, `user`, `users`, `bot`

There is no icon for a product. Pick the kind, and name the product in `sub`: `[icon: database, sub: "PostgreSQL"]`, `[icon: queue, sub: "Kafka"]`.

## Getting the layout you want

- **Edges set the column.** A node sits to the right of whatever points at it, and the longest path wins.
- **Groups keep nodes together.** Declaration order breaks ties from top to bottom, so swap two declarations to swap two nodes in a column.
- **In a cycle, the node declared first goes on the left.** For a request and response pair, declare the caller first.
- **`animate` and `step` never affect layout.** A hidden node keeps its place, so nothing moves when it appears.
- There is no syntax for positions. Do not try to add any.

[The layout guide](references/layout.md) has recipes for moving a node.

## Scripting steps

| Statement | Lasts for | Use it to |
| :--- | :--- | :--- |
| `desc` | This step | Explain what happens, in one or two sentences |
| `focus` | This step | Dim everything except the listed nodes and groups |
| `state` | **This step and all later ones** | Change a badge, color or visibility |
| `animate` | This step | Move a packet between two nodes |

- **Keep each step to one idea,** usually two to five packets. The player numbers steps, so titles do not need numbers.
- **Order packets deliberately.** Each `animate` is one phase, played in order. `[parallel: true]` joins the preceding one, for work that really is concurrent.
- **Run packets along declared edges.** A packet without an edge has no line to follow, and `--detail` reports it. For replies, make the edge `<->` or declare a separate reverse edge, and send a reply back through every node the request came through. Two edges in opposite directions do not need an `id`, but a second edge in the same direction does.
- **Use `<->` in `animate` for a call and its answer,** when the answer needs no words of its own. Use two packets when the answer matters, such as an error.
- **Clean up `state`.** Badges and colors carry over. To end one, write `badge: ""` or `color: none`, or a badge from step 2 will still be showing in step 8.
- **Let `animate` and `state` set the emphasis.** Their targets are emphasized automatically, so add `focus` only for nodes that have neither. Any of the three dims the other nodes and hides the edges that do not join two emphasized nodes, so `focus` on both ends of an edge is also how to keep that edge on screen.
- **Reveal things that appear later.** Declare them with `visible: false`, then use `state` with `visible: true`. To target an edge from `state`, the edge needs `[id: name]`.
- **Use self-loops for internal work,** such as retries or state transitions: `order --> order : "Retry"`, then `animate order --> order`. Self-loops cannot use `<->` or `<.>`.

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

// 2. One line, as a string. Escape the double quotes.
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

Keep it to the lines that matter, at most 10 lines of 55 characters. Never put real secrets, tokens or personal data in it: use obvious placeholders such as `tok_test_123`.

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
| `animate a --> b` with no label or `desc` | `animate a --> b : "What" [desc: "Why"]` | hint `animate-without-desc` |
| `animate api --> app` when only `app --> gw` and `gw --> api` exist | Send the reply the way it really goes: `animate api --> gw`, then `animate gw --> app`, over `<->` edges | hint `animate-without-edge` |
| `node db "PostgreSQL primary database server"` | `node db "Orders DB" [sub: "PostgreSQL"]` | hint `text-cut` |

## More detail

Read these only when needed:

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
