---
name: dav-diagrams
description: Create, edit and validate DynamicArchitectViewer .dav files, a text format for architecture, data-flow, sequence, failover and screen-flow diagrams that play step by step. Use when a task involves a .dav file or DynamicArchitectViewer, or when the user asks for an animated or step-by-step diagram of a system, request flow or screen flow.
license: MIT
compatibility: The bundled checker needs Node.js 18 or later.
---

# DynamicArchitectViewer diagrams

A `.dav` file holds a diagram and its timeline as text. There are no coordinates: edges and groups decide the layout, and `step` blocks animate the diagram without moving anything.

## Workflow

1. **Ground the diagram.** Read the code, configuration or documents it describes, and do not invent components. When changing an existing `.dav` file, edit it in place and keep its IDs and comments.
2. **Declare the structure:** `node`, `group`, then edges. Write edges in the direction the diagram should read, because they set the columns.
3. **Script the steps,** one scene per `step`. See [Scripting steps](#scripting-steps).
4. **Validate and format.** `<skill-dir>` is the directory that contains this file:

   ```bash
   node <skill-dir>/scripts/dav-check.mjs --write path/to/diagram.dav
   ```

   It uses the same parser and formatter as the VS Code extension, and prints `file:line:column: severity code: message`.

   | Exit code | Meaning |
   | :--- | :--- |
   | `0` | No diagnostics |
   | `1` | At least one error or warning |
   | `2` | Bad arguments or an unreadable file |

   Fix every error **and warning**, then run it again until it exits with `0`. A warning means that part of the file is being ignored. Without `--write`, the file is only checked.

5. **Report.** Give the path, and tell the user to open the file in VS Code with the [DynamicArchitectViewer extension](https://marketplace.visualstudio.com/items?itemName=osg-junue.dynamic-architect-viewer) and press `Ctrl+Shift+V` (`⌘⇧V` on macOS). The checker does not render, so never claim to have seen the result. If Node.js is unavailable, compare the file against [the specification](references/specification.md) by hand, and say that it was not validated.

Write titles, labels and descriptions in the user's language. IDs must stay ASCII.

## Reference example

```dav
dav 1
title "Checkout with payment failover"

node browser "Browser" [icon: browser, sub: "Customer"]

group backend "Backend" [color: blue] {
  node api "Order API" [icon: api]
  node db "Orders DB" [icon: database, sub: "PostgreSQL"]
}

group payments "Payment providers" [color: purple] {
  node primary "Primary PSP" [icon: payment]
  node backup "Backup PSP" [icon: payment, visible: false]
}

browser <-> api : "HTTPS"
api --> db : "SQL"
api --> primary : "Charge"
api ..> backup : "Failover" [id: e_backup, visible: false, color: orange]

step "Place an order" {
  desc "The API stores the order, then charges the primary provider."
  state db [badge: "PENDING"]
  animate browser --> api : "POST /orders" [icon: file, desc: "The customer submits the order"]
  animate api --> db : "Insert" [desc: "The order is stored as pending"]
  animate api --> primary : "Charge" [icon: payment]
}

step "Fail over to the backup" {
  desc "The primary provider is down, so the API retries with the backup."
  state primary [badge: "503", color: red]
  state backup [visible: true]
  state e_backup [visible: true]
  animate api --> backup : "Charge" [icon: payment, color: orange]
}

step "Confirm the order" {
  desc "The order is saved as paid, and the customer gets a response."
  state db [badge: "PAID", color: green]
  state primary [badge: "", color: none]
  animate backup --> api : "Authorized" [color: green]
  animate api --> db : "Update"
  animate api <-> browser : "201 Created" [parallel: true]
}
```

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
| Animate | `animate a --> b : "Label" [...]` | `icon`, `color`, `parallel`, `desc` |

The `:` before an edge or `animate` label is required. Attribute blocks are `[key: value, key: value]`.

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

- **Clean up `state`.** Badges and colors carry over. To end one, write `badge: ""` or `color: none`, or a badge from step 2 will still be showing in step 8.
- **Let `animate` and `state` set the emphasis.** Their targets are emphasized automatically, so add `focus` only for nodes that have neither. Any of the three dims the rest of the diagram.
- **Reveal things that appear later.** Declare them with `visible: false`, then use `state` with `visible: true`. To target an edge from `state`, the edge needs `[id: name]`.
- **Run packets along declared edges.** A packet can travel without an edge, but the diagram reads better when the rail exists. For replies, use a `<->` edge or a separate reverse edge. Two edges in opposite directions do not need an `id`, but a second edge in the same direction does.
- **Order phases deliberately.** Each `animate` is one phase, played in order. `[parallel: true]` joins the preceding one, for work that really is concurrent.
- **Show what is moving.** Give a packet an `icon`, such as `key` for a token, `file` for a document or `mail` for an event.
- **Keep each step to one idea,** usually one to five phases. The player numbers steps, so titles do not need numbers.
- **Use self-loops for internal work,** such as retries or state transitions: `order --> order : "Retry"`, then `animate order --> order`. Self-loops cannot use `<->` or `<.>`.

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
