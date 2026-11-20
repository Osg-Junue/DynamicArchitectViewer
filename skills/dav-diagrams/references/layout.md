# How diagrams are laid out

`.dav` files have no coordinates. You describe what connects to what, and the layout follows. This guide explains what to write to get the arrangement you want. The [exact rules](https://github.com/Osg-Junue/DynamicArchitectViewer/blob/main/docs/layout.md#exact-rules) are for contributors: writing a diagram needs none of them.

## The short version

- **Step flows decide the column.** `animate` statements in step order drive the left-to-right backbone; return paths and `static` relations do not invert it.
- **Groups decide what stays together.** Nested groups (such as Cloud ⊃ Region ⊃ VPC ⊃ AZ ⊃ Subnet) lay out bottom-up inside their own frames.
- **Declaration order breaks ties**, from top to bottom.
- **Steps never move anything.** A node stays in the same place for the whole diagram, and switching steps never rearranges it.

The same file always produces the same layout.

To keep them short, the examples below omit most `node` declarations and show minimal `step` blocks.

## Columns: follow the arrows

A node sits one column to the right of whatever points at it in the primary flow.

```dav
step "Request" {
  animate a --> b : "call"
  animate b --> c : "query"
}
```

```text
a ─── b ─── c
```

When several paths reach a node, the **longest** one wins:

```dav
step "Request" {
  animate a --> b : "1"
  animate b --> c : "2"
  animate a --> c : "shortcut"
}
```

```text
a ─── b ─── c
 ╲_________╱
```

`c` is in the third column, not the second, because the path through `b` is longer.

In a flat diagram with at most one top-level group (and no multi-tier nested group branching), nodes that share a column align across the whole diagram. A node with no connections goes in the first column (or in an isolated row below connected components).

### Which way should an arrow point?

From the caller to what it calls, as the facts give it: `animate client --> api` says that `client` calls `api`, and puts `client` on the left of `api`. Through a queue, a topic, or a stream, point the way messages travel: from the producer to whatever consumes them. Do not turn an arrow round just to move a node. For a request and its reply, use a single two-way arrow (`animate client <-> api`): the first node named goes on the left, which is the caller. [Cycles](#cycles) explains how return calls are handled automatically.

### Cycles

When `animate` statements follow a loop—such as a response or callback returning to an already-visited node or upstream zone—the layout classifies the returning transition as a `'return'` path from chronological step order, so it does not invert the forward backbone.

When edges still form a cycle within a single zone or a `static`-only diagram, one edge has to point back and is ignored for ranking. Which one depends on where a depth-first search first enters the loop (visiting nodes and edges in declaration order), and the entry node stands on the left:

```dav
node a
node b
step "Ping-pong" {
  static a --> b : "request"
  static b --> a : "response"
}
```

```text
a ⇄ b
```

To swap them in a pure-`static` cycle, declare `b` first. A self-loop (`a --> a`) never changes the column.

To keep any pair in a predictable order, write a single two-way arrow (`a <-> b` or `a <.> b`). A two-way edge counts only in the direction it is written, so it creates no cycle.

`dav check --detail` reports edges ignored during ranking as `back-edge` notes. Where top-level zones are [placed freely](https://github.com/Osg-Junue/DynamicArchitectViewer/blob/main/docs/layout.md#placing-zones-freely), each zone ranks its interior independently, so only cycles inside one zone produce back-edges.

## Rows: use groups and order

Nodes in the same column stack from top to bottom. A node goes near the nodes it connects to, and declaration order settles ties.

```dav
step "Fan out" {
  animate a --> b : "branch 1"
  animate a --> c : "branch 2" [parallel: true]
}
```

```text
a ─┬─ b
   └─ c
```

To swap `b` and `c`, swap the order in which they are declared.

A `group` keeps its members together inside a frame. Blocks that use different columns sit side by side, and blocks that share a column stack.

```dav
group web { node lb }
group data { node db }
step "Read" {
  animate lb --> db : "SQL"
}
```

```text
┌ web ┐    ┌ data ┐
│ lb ─┼────┼─ db  │
└─────┘    └──────┘
```

Nested containers (for example Cloud ⊃ Region ⊃ VPC ⊃ Availability Zones ⊃ Subnets) are laid out **recursively bottom-up**: leaf groups lay out first, and each enclosing container arranges its child groups and direct nodes in flow stages while keeping parallel sibling tiers (such as Multi-AZ boxes) aligned in width and column tracks.

## Recipes

| To get this | Do this |
| :--- | :--- |
| Place the main backbone left to right | Write the normal forward `animate` flow in the earliest steps |
| Keep background / telemetry / replication lines from distorting the backbone | Declare them with `static` (for example `static primary ..> replica` or `static vpc ..> cloudwatch`) |
| Swap two sibling nodes in a column | Swap their `node` declarations |
| Keep related components together | Put them in a `group`, nesting groups to mirror real architectural boundaries |
| Show a gateway or endpoint on a group's border | Declare it inside the group with `[mount: border]`—the layout picks the edge facing its external connections automatically |
| Distinguish logical/HA boundaries (e.g. AZs) from strong boundaries (e.g. VPCs) | Add `[border: dashed]` on the `group` |
| Connect an entire group to observability/security without picking an arbitrary inner node | Use the group ID as an endpoint of `static` (for example `static vpc ..> cloudwatch : "Flow Logs"`) |
| Reveal a node only in a later step without shifting layout | Declare it with `[visible: false]`, then show it via `state` (or use it in that step's `animate` / `static`) |
| Widen the gap between two columns | Use a longer `static` label on a connection between those adjacent columns |

## Things that surprise people

**A hidden node still takes up space.** A node with `visible: false` is laid out like any other, so nothing shifts when a step reveals it.

**Both `animate` and `static` across all steps synthesize the overview graph, with different layout weights.** `animate` statements in early steps establish the primary left-to-right stages; later return paths and cross-cutting `static` links (such as monitoring, secrets, audit logs, and NAT egress return chains) are separated so they do not invert the primary flow.

**Top-level zones in multi-zone diagrams follow flow order, not declaration order.** When a diagram has two or more top-level groups, the layout [places top-level zones freely](https://github.com/Osg-Junue/DynamicArchitectViewer/blob/main/docs/layout.md#placing-zones-freely) into deterministic left-to-right stages and above/below auxiliary bands (for example, placing monitoring or security zones in a band or corner pocket rather than in the middle of the primary path).

**Isolated additions never move connected parts.** Adding a disconnected node or disconnected group places it in a separate row below the connected diagram with `0.0` units of drift on existing elements.

**A self-loop reserves room above its row.** Enough headroom is reserved above self-loop nodes so rails stay clear of the loop curve and its label.

**`mount: border` picks its border side and alignment automatically.** You do not specify left/right/top/bottom: the layout faces the mounted node toward its external connections and aligns it with in-band `animate` neighbors along that edge so straight ingress/egress chains stay straight.

**There is no syntax to pin a node.** This is deliberate. See [Design decisions](https://github.com/Osg-Junue/DynamicArchitectViewer/blob/main/docs/design-decisions.md).

**Lines run level and upright, keep clear of nodes, and avoid hugging borders.** A rail is made of straight stretches with rounded corners. It avoids running through unrelated nodes, zone titles, or tightly alongside group borders, and routes group-endpoint `static` lines straight into the group's outer perimeter without entering the interior. Two stations 12 units or less off level are joined by one straight line.

