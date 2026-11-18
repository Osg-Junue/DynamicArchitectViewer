# Design decisions (`dav 2`)

## Brand & Core Principle

> **Define systems in text that is easy for AI to write and understand; transform them into animations that are easy for humans to read and follow.**

DynamicArchitectViewer is a translator between two audiences:
- **Authoring side (AI agents and engineers):** Writes the true structure of a system (`group`, `node`) and what happens in each step (`step`, `animate`, `static`, `state`). No layout tricks, no hidden workarounds, no spatial debugging.
- **Viewing side (human readers):** Receives a stable architectural map (overview) and step-by-step animated flows where the layout respects the system's mental model.

## Why v1 assumptions were replaced in v2

### No header declaration
In v1, every file began with a mandatory `dav 1` header. Because `.dav` files already identify their format by extension and `2.0.0` replaces v1 cleanly without carrying a dual-version parser, v2 removes the `dav <version>` header so files begin directly with `title`, `group`, `node`, or `step`.

### No top-level edges
In `dav 1`, authors had to declare every connection twice: once as a static top-level edge (`api --> db`), and again inside `step` (`animate api --> db`). Worse, top-level edges pulled double duty as both structural links and layout constraints, forcing authors into tricks such as:
- pre-declaring future failure edges with `[id: e_failover, visible: false]` and toggling them via `state`,
- rewriting one-way callbacks or subscriptions as `<->` with the left-hand node first to avoid backward layout pushes,
- reordering node and edge declarations to control which edge a depth-first search discarded as a cycle back-edge.

In `dav 2`, top-level edges are removed. Connections live inside `step` (`animate` for moving traffic, `static` for non-moving links such as replication or monitoring). The overview synthesizes a single clean connection map from all steps.

### Self-contained steps (no `state` carry-over)
In `dav 1`, `state` accumulated across steps, forcing authors to track prior badges and colors mentally and manually clear them (`badge: ""`, `color: none`) in later steps.

In `dav 2`, every statement inside a `step` (`desc`, `focus`, `state`, `animate`, `static`) applies to that step alone. Reordering, inserting, or deleting a step never leaves stale badges or colors behind.

### Dynamic diagrams only (`step` required)
Static architecture-only `.dav` files (with zero steps) pushed the layout engine to optimize a dense static graph first, at the expense of step playback and authoring simplicity. `dav 2` requires at least one `step` and optimizes for a clear map paired with step-by-step animation.

### Unlabeled overview rails
Edge labels in the overview served two conflicting goals: short protocol labels on a crowded static graph widened column gaps unnecessarily and collided with rails, while `animate` messages described concrete events (`POST /orders`, `503 Unavailable`).

In `dav 2`, the overview renders connection rails only (merged across directions and styled solid vs dashed). Specific labels and descriptions appear during each step.

## Decisions retained from v1

### No manual positions
There is still no syntax to pin coordinates. Hand-placed coordinates turn every system edit into manual layout work and bloat diffs. Instead of forcing authors to fake positions through edge tricks, v2 changes the layout engine to infer backbone direction and layer separation directly from `group` structure and `step` sequence order.

### No branching scenarios
Normal, failure, retry, and recovery paths remain a linear sequence of steps (`step 1`, `step 2`, ...) so the full timeline stays visible at a glance and every step stays self-contained.

### No lifeline sequence view
Participants remain arranged in architectural zones rather than flattened into a single row of lifelines. Time is carried by `step` and `animate` rather than a second vertical axis, preserving structural context while eliminating the spatial/cycle bugs caused by v1's separate edge graph.

### No vendor logos in built-in icons
Icons describe roles (`database`, `queue`, `external`), paired with `sub` for product names (`"Aurora Writer"`, `"Kafka"`).
