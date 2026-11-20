# How diagrams are laid out

`.dav` files have no coordinates. You describe what connects to what, and the layout follows. This guide explains what to write to get the arrangement you want. The [exact rules](#exact-rules) are for contributors: writing a diagram needs none of them.

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

`dav check --detail` reports edges ignored during ranking as `back-edge` notes. Where top-level zones are [placed freely](#placing-zones-freely), each zone ranks its interior independently, so only cycles inside one zone produce back-edges.

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

**Top-level zones in multi-zone diagrams follow flow order, not declaration order.** When a diagram has two or more top-level groups, the layout [places top-level zones freely](#placing-zones-freely) into deterministic left-to-right stages and above/below auxiliary bands (for example, placing monitoring or security zones in a band or corner pocket rather than in the middle of the primary path).

**Isolated additions never move connected parts.** Adding a disconnected node or disconnected group places it in a separate row below the connected diagram with `0.0` units of drift on existing elements.

**A self-loop reserves room above its row.** Enough headroom is reserved above self-loop nodes so rails stay clear of the loop curve and its label.

**`mount: border` picks its border side and alignment automatically.** You do not specify left/right/top/bottom: the layout faces the mounted node toward its external connections and aligns it with in-band `animate` neighbors along that edge so straight ingress/egress chains stay straight.

**There is no syntax to pin a node.** This is deliberate. See [Design decisions](design-decisions.md).

**Lines run level and upright, keep clear of nodes, and avoid hugging borders.** A rail is made of straight stretches with rounded corners. It avoids running through unrelated nodes, zone titles, or tightly alongside group borders, and routes group-endpoint `static` lines straight into the group's outer perimeter without entering the interior. Two stations 12 units or less off level are joined by one straight line.

## Exact rules

This section is for changing the layout code in [`layout/`](../apps/vscode/src/layout/index.ts). For the full v2 module and constant reference, see [`docs/v2/layout-algorithm.md`](v2/layout-algorithm.md). Rail routing lives downstream in `scene/route.ts` and `scene/rails.ts`, and is described under [Routing rails](#routing-rails).

### Inputs and outputs

| | |
| :--- | :--- |
| Uses | `node` and `group` declarations (including `mount` and nesting), `label` widths for group minimum header widths, and all `animate` / `static` statements across `steps` (chronological step order, arrow directionality, `static` label widths, and self-loops) |
| Ignores | Pure annotation steps (`desc`, `focus`, `state`), animation descriptions/code blocks, node `sub`/`badge`, and display-only styling (`color`, `border`, `icon`) |
| Returns | A plain, JSON-serializable rectangle for each node and group (`Layout`) |
| Exported HTML | Embeds the `Layout` computed at export, so later layout rule changes do not alter already-exported files |

### Stages

1. Analyze chronological step flow (`layout/flow.ts`): classify each synthesized connection as `'primary'`, `'return'`, or `'static'`, detect egress return chains (`egressReturnPairs`), and compute acyclic macro `zoneStage` and `auxiliaryZones`.
2. Choose the macro regime (`layout/index.ts`):
   - **`<= 1` top-level group:** `computeSingleGroupLayout` (`layout/columns.ts`), delegating to `computeSingleTopRecursiveLayout` (`layout/nestedZone.ts`) when `hasRecursiveNesting(doc)` holds (depth `>= 2` below the top-level group with at least one branching container).
   - **`>= 2` top-level groups:** deterministic stage+band macro solver (`layout/zonePlace.ts`) with bottom-up recursive blocks (`layout/nestedZone.ts`) for nested containers.
3. Run intra-zone refinement (`layout/zoneRefine.ts`), geometric finishing (`layout/zoneFinish.ts`), and post-placement single-node straightening (`layout/straightenNodes.ts`).
4. Apply boundary mounts (`layout/borderMount.ts`) for any node declared with `[mount: border]`.

### Columns

- Inside a column layout (`layout/ranks.ts`, `layout/columns.ts`), rank is the longest path over `forwardEdges` (`primary` edges plus non-excluded, non-cycle-closing `static` edges; Rules S1–S3 exclude `static` links that connect already-linked primary backbone nodes or form NAT/egress return chains). Remaining cycles break via iterative DFS in declaration order. A two-way edge counts once from its first endpoint to its second; self-loops are ignored.
- The gap between columns is `max(congestionGap, needed - 132) + 16 * edges`, where `edges` counts group frame boundaries between adjacent columns. `congestionGap` starts at 36 and widens by 14 per crossing link beyond 2 (up to 148) under long-span or degree `>= 4` hub congestion. `needed` is `min(180, label width) + 32` for the widest `static` label between adjacent columns (`|rf - rt| === 1`).
- The left and top margins are `40 + depth * 16`.

### Rows

Each column-laid-out group places column blocks and child groups:

- Blocks with no columns in common sit side by side; overlapping blocks stack with `CLUSTER_GAP = 28`.
- A node is `176 × 118` (`NODE_SIZE`) with `ROW_GAP = 14` between rows (widened up to `34` under cross-corridor hub traffic). Its station center is `50` below its top (`STATION_CENTER`).
- A node with self-loops reserves `30 + (loops - 1) * 18` above it.
- A group frame wraps its members with `GROUP_PADDING = 16`, a top header (`groupHeaderHeight`: 18 for 1 line, or 2-line wrapped height when needed), and a minimum frame width (`zoneMinWidth`) so headers fit within two wrapped lines without truncation. An empty group reserves `160 × 40`.

### Order improvement

| | |
| :--- | :--- |
| Iterations | Up to 16 alternating left/right barycenter sweeps, stopping after 4 without improvement |
| Column order | Odd passes average left neighbors' Y; even passes average right neighbors' Y. Ties keep previous position, then declaration order |
| Block order | Average Y of external connections, or own nodes if none |
| Accepted when | Fewer crossings, or equal crossings with shorter total vertical rail length |
| Skipped when | No non-self-loop edges, or more than 500 edges |

Crossings are counted on straight lines between station centers (`countCrossings`); edges sharing a station do not count.

### Recursive nested containers

For groups that contain nested child groups (`layout/nestedZone.ts: buildRecursiveZoneBlock`):

- Leaf groups lay out via `buildSingleZoneBlock` (`computeColumnLayout` + header width guarantee), except edge-less auxiliary peer bags (`>= 4` nodes) which pack into a compact 2D grid (`min(4, ceil(n / 2))` columns); single-child wrappers wrap their child directly.
- Composite containers run scoped flow analysis (`analyzeScopeFlow`) over their direct children and lay them out with tighter `NESTED_SPACING` (`stageGap: 48`, `rowGap: 24`, `horizontalClearance: 36`, `verticalClearance: 22`, `auxGap: 32`).
- **Same-step parallel fan-out merging:** Peer sibling groups (leaf or composite, `>= 2` nodes with matching child-group count) fed in the same step by a shared upstream distributor and linked by `static` replication or bidirectional peer edges merge into one vertical stage column with synchronized flip polarity.
- **Sibling symmetry & grid alignment:** `detectIsomorphicSiblings` matches parallel same-stage siblings with identical internal signatures (never locking upstream/downstream pipeline stages together) to synchronize flips and equalize widths; `alignStackedSiblingColumns` aligns outer widths and internal subnet-column tracks across structurally similar composite siblings stacked in the same column; ties in a column break by earliest active step before declaration order.
- **Secondary feeder stacking, sidecar folding, wide 2-stage stacking & corner-pocket auxiliaries:** A wide later-step secondary feeder (`col 0`, comparable height `b1.height <= b0.height * 2.5`) stacks beneath an earlier-step primary ingress container (`col 1`); a dead-end multi-node internal sidecar sink in the rightmost column folds into `auxiliary` when upstream stages have external egress and inline width would form a wide ribbon (`estW >= 1000`, `estW / estH >= 2.4`); wide two-stage containers with dual external ingress stack vertically; auxiliary child zones inside nested containers try tucking into unused vertical pockets above or below shorter outer primary columns before falling back to a full-width top/bottom band.

### Placing zones freely

When a diagram has at least `MIN_ZONES = 2` top-level groups (`hasZonesToPlace(doc)`), `layout/zonePlace.ts: searchZonePlacement` runs a **100% deterministic** stage+band macro solver (with no PRNG and no simulated annealing):

1. Isolated top-level blocks (`deg === 0` across top-level zones) are partitioned out so connected solving runs strictly over `connectedSubdoc(doc)`, guaranteeing `0.0`-px drift when isolated blocks change.
2. Connected zones are built bottom-up (`buildRecursiveZoneBlock` for nested containers, `buildSingleZoneBlock` for flat zones) and classified by `shouldPreserveFlow` into either single-row left-to-right stages or a wrapped 2D `MacroGrid` (`prepareMacroGrid`).
3. `solveStagedPipeline` places primary stage columns, runs 6 bidirectional `stationY` barycenter sweeps, flips/finishes primary blocks, and places auxiliary zones into bands (`'bands'`) or trailing pockets (`'right-top'`). Tall single-row columns (`len >= 3` with aspect `< 1.35`) also generate a split-column candidate (`buildSplitStageColumns`).
4. Each candidate runs bounded intra-zone refinement (`layout/zoneRefine.ts`: `optimizeZoneSlackRanks`, `clearCorridorIntrusions`, exact bitmask or greedy `optimizeZoneFlips`, `(parentId, columnX)` `refineZoneNodeOrder`, and multi-scale cardinal `polishZoneCoordinates`) and finishing (`layout/zoneFinish.ts`: `compact`, `alignEdges`, `tighten`, `straighten`, `eliminateShortJogs`, `restoreStageBreathingRoom`), all scored by the unified objective in `layout/zoneScore.ts`.
5. `applyZonePlacement` runs `keepClear` on connected blocks and packs isolated blocks in rows below (`placeIsolatedBlocks`).

Results are cached by `structureKey(doc)` (which strips `static` labels via `withoutLabels(doc)` so typing a label does not trigger a zone re-search).

### Straightening single nodes

After zone placement, `layout/straightenNodes.ts` shifts single nodes up to `60` units (`REACH`) inside their parent frame (up to 4 rounds) to put links level (`<= 12` units) or upright, keeping `14` units from other nodes and `28` from foreign groups while guarding inter-zone `'primary'` links (`dx > 0` preserved).

### Border-mounted nodes

Last, `layout/borderMount.ts: applyBorderMounts` positions nodes declared with `[mount: border]` inside a group (innermost groups first):

1. Picks the border side (`left` / `right` / `top` / `bottom`) facing the average direction of the node's external connections outside its parent group's subtree (falling back to internal degree direction when there are no external connections).
2. Adjusts each parent border edge: shrinks mounted edges inward toward the mounted stations where interior clearance (`MIN_INNER_CLEAR_X = 56`, `MIN_INNER_CLEAR_Y = 44`, `TOP_MOUNT_INNER_CLEAR = 76`, `BOT_MOUNT_INNER_CLEAR = 36`) and `zoneMinWidth` permit, expands outward within safe parent/sibling clearance (`MOUNT_OUTER_CLEAR = 28`) when a mounted node's label would otherwise intrude into interior headers or members, and reclaims vacated margin back to `GROUP_PADDING` on any side a mounted node moved away from.
3. Aligns each mounted node along its edge using its **in-band `animate` (primary) neighbors** inside the mountable edge span `[lo, hi]` first (falling back to all in-band neighbors, then internal neighbors, then original center), so distant out-of-band external nodes or `static` return links do not bend straight primary chains. Multiple nodes on the same side space apart by at least `SIDE_SEP_Y = 130` / `SIDE_SEP_X = 136` while staying clear of the parent group's title header.

### Routing rails

Rails are routed after layout by `routeEdges` in `scene/route.ts` once per arrangement: a rail keeps its course from step to step. Self-loops stay curves at the upper right of their station.

1. **The grid** (`scene/routeGrid.ts`). Routes run on lines through station centers (plus off-center vertical ports when a zone label sits overhead), `8` units beside station areas, `12` units beside wider label blocks, `12` units inside and outside every zone border, midpoint tracks centered between nested group borders, all four sides of every wall, and interior tracks across wide gaps (`36+` units). Group-endpoint `static` connections open border doors around all four outer edges of the endpoint group (excluding its title wall) so routes meet the border perpendicularly without entering the group's interior.
2. **Shortest reach first with rip-up & reroute** (`scene/routeSearch.ts`, `scene/route.ts`). A* finds the cheapest grid path per edge (using an admissible rectangle-distance heuristic for group-border endpoints), followed by up to two rip-up-and-reroute passes on winding or crossing routes:

   | Cost | Amount |
   | :--- | :--- |
   | Length | 1 per unit |
   | Turns (1st / 2nd / 3rd+) | 40 / 52 / 115 |
   | Crossing an unrelated route | 160 |
   | Crossing a route sharing one endpoint | 40; 0 between the same pair |
   | Length inside a foreign zone or outside shared LCA container | 4 per unit (`THROUGH`) |
   | Hugging a zone border (`< 5` units clearance) | `2.5` per unit (`ALONG_BORDER`) |
   | Shared stretch | 6–25% per shared-endpoint route; 35–65% per unrelated route |
   | Port load balancing (`> 5` rails on one face) | `+80` / `+150` (`PORT_CROWD_COSTS`) |
   | Leaving downward or reaching from below | 30 |
   | Top port of a self-loop node | 40 |
   | Turning within 18 units of endpoint outline/labels | 180 |
   | Off-center port | 2 per unit |

   When both endpoints share an enclosing container (their lowest common ancestor group, LCA), `edge.home` is restricted to zones within that LCA and `contained: true` applies the same `THROUGH = 4` surcharge to stretches leaving the LCA into an outer ancestor or open canvas, keeping intra-group routes inside their shared boundary whenever space permits.

3. **Side by side** (`scene/routeSpread.ts`). Routes sharing a track pack into non-overlapping intervals spaced up to `7` units apart (expanding to `PORT_ARROW_GAP = 9` on faces with crowded arrowheads, and `BOTTOM_PORT_GAP = 10` across `76..96` units on bottom ports), clamped clear of every adjacent node's `area` and wide `labelArea` and at least `BORDER_KEEP_OUT = 5` units away from parallel zone borders whenever space permits.
4. **The ends.** A route stops `2` units outside its station outline or target group border. One leaving a node downward starts below the node's labels.

**Edge labels** (`placeLabels` in `scene/rails.ts`) are placed on the longest clear stretch of each rail, avoiding stations, node labels, zone titles, rails, numbered stop midpoints, other labels, and group border lines (`+40` penalty). In the overview, edge labels are hidden by default and rendered only when requested (`dav export --still --labels`, which picks each endpoint pair's first non-empty label across steps, checking `animate` before `static` within each step).

### Invariants

Tests live in `layout/__tests__/layout.test.ts`, `layout/__tests__/nestedCloud.test.ts`, `layout/__tests__/zoned.test.ts`, `layout/__tests__/e2eLayout.test.ts`, `layout/__tests__/tier5Hardening.test.ts`, `scene/__tests__/scene.test.ts`, `scene/__tests__/rails.test.ts`, `scene/__tests__/routeBorderAndPorts.test.ts`, `scene/__tests__/quality.test.ts`, and `exporter/__tests__/phase3Features.test.ts`.

| Invariant | Verification |
| :--- | :--- |
| Deterministic pure function `layout = f(doc)` with zero randomness | `layout.test.ts`, `nestedCloud.test.ts`, `tier5Hardening.test.ts` |
| Zero node overlaps and zero foreign nodes inside groups | `auto layout never overlaps nodes or puts foreign nodes inside groups` |
| Containment across arbitrary nested hierarchies | `wraps groups around their (nested) members`, `nestedCloud.test.ts` |
| Zero drift on connected elements when isolated elements change | `tier5Hardening.test.ts`, `nestedCloud.test.ts` |
| Border mounts snap to group edges and stay aligned with in-band primary flows | `phase3Features.test.ts` |
| No border hugging, crowded arrowheads, or text cuts | `routeBorderAndPorts.test.ts` |
| Overview readability budgets across all examples and large fixtures | `scene/__tests__/quality.test.ts` |
