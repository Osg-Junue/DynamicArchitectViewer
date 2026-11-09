# How diagrams are laid out

`.dav` files have no coordinates. You describe what connects to what, and the layout follows. This guide explains what to write to get the arrangement you want. The [exact rules](#exact-rules) for contributors are at the end.

## The short version

- **Edges decide the column.** Things flow from left to right.
- **Groups decide what stays together.**
- **Declaration order breaks ties**, from top to bottom.
- **Steps never move anything.** A node stays in the same place for the whole diagram.

The same file always produces the same layout.

To keep them short, the examples below leave out the `dav 1` header and most `node` declarations.

## Columns: follow the arrows

A node sits one column to the right of whatever points at it.

```dav
a --> b
b --> c
```

```text
a ─── b ─── c
```

When several paths reach a node, the **longest** one wins:

```dav
a --> b
b --> c
a --> c
```

```text
a ─── b ─── c
 ╲_________╱
```

`c` is in the third column, not the second, because the path through `b` is longer.

Nodes that share a column are aligned across the whole diagram, even in different groups. A node with no edges goes in the first column.

### Which way should an arrow point?

Point it the way you want the diagram to read. To put `client` on the left of `api`, write `client --> api`. For traffic in both directions, use a single two-way edge (`client <-> api`) and the first node named goes on the left.

### Cycles

If edges form a loop, the node declared first goes on the left:

```dav
node a
node b
a --> b : "request"
b --> a : "response"
```

```text
a ⇄ b
```

To swap them, declare `b` first. A self-loop (`a --> a`) never changes the column.

## Rows: use groups and order

Nodes in the same column stack from top to bottom. A node goes near the nodes it connects to, and declaration order settles anything left over.

```dav
a --> b
a --> c
```

```text
a ─┬─ b
   └─ c
```

To swap `b` and `c`, swap the order in which they are declared.

A group keeps its members together inside a box. Blocks that use different columns sit side by side, and blocks that share a column stack.

```dav
group web { node lb }
group data { node db }
lb --> db
```

```text
┌ web ┐    ┌ data ┐
│ lb ─┼────┼─ db  │
└─────┘    └──────┘
```

## Recipes

| To get this | Do this |
| :--- | :--- |
| Move a node to the right | Add an edge into it from a node further right, or lengthen the path that reaches it |
| Move a node to the left | Remove or reverse an edge that points into it |
| Swap two nodes in a column | Swap their declarations |
| Keep nodes together | Put them in a `group` |
| Show a path that appears later | Declare it with `visible: false`, then show it with `state` |
| Widen the gap between two columns | Use a longer label on an edge between them |
| Connect nodes without affecting layout | Leave out the edge and use only `animate` between them |

## Things that surprise people

**A hidden node still takes up space.** A node with `visible: false` is placed like any other, so nothing moves when a step reveals it.

**`animate` does not affect layout.** Nodes joined only by `animate` are placed as if unconnected. Add an edge if the position matters.

**A self-loop adds room above its row.** Every node directly in the same group moves down with it, which keeps their rails straight.

**There is no syntax to pin a node.** This is deliberate. See [Design decisions](https://github.com/Osg-Junue/DynamicArchitectViewer/blob/HEAD/docs/design-decisions.md).

**Lines avoid nodes, but may cross a group.** Crossings between rails are reduced automatically. A rail can still pass through the area of an unrelated group.

## Exact rules

This section is for changing the layout code in [`layout/index.ts`](https://github.com/Osg-Junue/DynamicArchitectViewer/blob/HEAD/apps/vscode/src/layout/index.ts). Rail routing, such as curving around nodes and separating parallel lines, is not part of this stage. It lives in `scene/resolve.ts` and `scene/geometry.ts`.

### Inputs and outputs

| | |
| :--- | :--- |
| Uses | `node` and `group` declarations and nesting, and edges (including label width and the number of self-loops) |
| Ignores | `step`, `animate`, `focus`, `state` |
| Returns | A plain, JSON-serializable rectangle for each node and group (`Layout`) |
| Exported HTML | Embeds the `Layout` computed at export, so later rule changes do not affect exported files |

### Stages

1. Assign each node a column from the edges.
2. Compute the X coordinate of each column, shared by the whole diagram.
3. Place everything from top to bottom along the group hierarchy.
4. Try other vertical orders, and keep a result only if it is better.

### Columns

- Rank is the longest path. Cycles are broken by ignoring back edges of a depth-first search in declaration order. Self-loops are ignored.
- The gap between columns is `max(36, needed - 132) + depth * 32`, where `depth` is the deepest group nesting. `needed` is `min(180, label width) + 32` for the widest label between those columns. The 132 is the node width (176) minus the station width (44), since a label can use the space beside the stations.
- The left and top margins are `40 + depth * 16`.

### Rows

Each group, and the top level, places two kinds of block: the nodes directly in it, one block per column, and its child groups.

- Blocks with no columns in common go side by side. Overlapping blocks stack with a gap of 28.
- The initial order is by leftmost column, with column blocks before child groups. Inside a block, the order is declaration order.
- A node is 176 × 118 whatever its icon, with 14 between rows. Its station center is always 50 below its top, so nodes at the same Y are joined by a level line.
- In the first placement, a column is sorted by the average Y of its already placed predecessors. Nodes with no predecessor go last, and ties use declaration order.
- A node with self-loops needs `30 + (loops - 1) * 18` above it. The largest requirement in a group level applies to all of that level's rows.
- A group frame wraps its direct nodes and child groups with a padding of 16, plus 18 at the top for its name. An empty group reserves 160 × 40 in column 0.

### Order improvement

| | |
| :--- | :--- |
| Iterations | Up to 16, stopping after 4 without improvement |
| Column order | Odd passes use the average Y of neighbors on the left, even passes on the right. Nodes with no neighbors keep their position. Ties use the previous position, then declaration order |
| Block order | Average Y of the block's connections outside the block, or of its own nodes if there are none. Groups with no nodes go last |
| Accepted when | There are fewer crossings, or as many crossings and a shorter total vertical rail length |
| Skipped when | There are no edges other than self-loops, or more than 500, since it runs on every edit and crossing counts are quadratic in edges |

Crossings are counted on straight lines between station centers (`countCrossings`), and edges sharing a station do not count. Drawn rails curve around nodes, so the drawn count can differ.

### Placing zones freely

When the column layout leaves a link longer than 700 units (a link used for a round trip counts double) and there are at least two top-level zones, `layout/zoned.ts` tries another arrangement. It is kept only if it shortens the long links without adding crossings:

1. Each top-level zone is laid out on its own, with the rules above.
2. The zones start in the columns of a graph that has one node per zone.
3. Simulated annealing moves zones, swaps them and flips them vertically, scoring link length, crossings, links through other zones, right-to-left links and overall size. A link used for a round trip counts double, since it is traversed twice in its time.
4. Zone edges are aligned where that costs almost nothing. The best of six seeded runs is kept.

The result is deterministic. Zones no longer share columns, so a column does not line up across the diagram. The search takes up to about a second, so the last result is reused until the nodes, groups, edges or round trips change.

### Invariants

Tests are in `layout/__tests__/layout.test.ts` and `scene/__tests__/scene.test.ts`.

| Invariant | Test |
| :--- | :--- |
| The same input gives the same layout. No randomness or unordered iteration | `is deterministic` |
| Nodes never overlap, and unrelated nodes never land inside a group | `auto layout never overlaps nodes or puts foreign nodes inside groups` |
| A group wraps all of its descendants | `wraps groups around their (nested) members` |
| Connected rows stay level | `keeps connected rows on one line` |
| Samples do not gain crossings | `stays within its crossing budget` |
| Room for self-loops is kept | `self-loop room` |

When you add a diagram to the samples or `examples/`, add its limit to `CROSSING_BUDGET`. If a rule change reduces crossings, lower the limit.
