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

**A self-loop adds room above every row.** Each node gets the room the tallest loop of the diagram needs, so stations stay level from one zone to the next and the rails between them stay straight.

**A node outside a zone stands lower than the zone's top.** The first row of a group starts as far down as the first row of the deepest group nested in it. A zone's frame pushes its stations down by its header and by the room for loops, and without this a rail from a station outside a zone to one inside it would have to step down.

**There is no syntax to pin a node.** This is deliberate. See [Design decisions](https://github.com/Osg-Junue/DynamicArchitectViewer/blob/HEAD/docs/design-decisions.md).

**Lines run level and upright, and keep clear of nodes.** A rail is made of straight stretches with rounded corners. It never runs through another node or over the name of a zone, and it goes round a zone it has nothing to do with unless the way round is much longer. Rails that share a line run side by side, so several rails can enter a node next to each other. Two stations that are 12 units or less off level are joined by one straight line that meets them a little off their middle.

## Exact rules

This section is for changing the layout code in [`layout/index.ts`](https://github.com/Osg-Junue/DynamicArchitectViewer/blob/HEAD/apps/vscode/src/layout/index.ts). Rail routing is not part of this stage. It lives in `scene/route.ts` and `scene/rails.ts`, and is described under [Routing rails](#routing-rails).

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
- The gap between columns is `max(36, needed - 132) + 16 * edges`, where `edges` is 1 if some group frame ends at the left column, plus 1 if some frame starts at the right one. Frames nested along one edge share its 16 of padding, so the gap does not depend on the nesting. `needed` is `min(180, label width) + 32` for the widest label between those columns. The 132 is the node width (176) minus the station width (44), since a label can use the space beside the stations.
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

Crossings are counted on straight lines between station centers (`countCrossings`), and edges sharing a station do not count. Drawn rails take right-angled routes, so the drawn count can differ.

### Placing zones freely

When the column layout leaves a link longer than 700 units (a link used for a round trip counts double) and there are at least two top-level zones, `layout/zoned.ts` tries another arrangement. It is kept if it shortens the long links by more than the crossings it adds are worth, counting a crossing as 700 units. A chain of zones has no crossings in columns but is a strip dozens of times wider than high; freeing its zones at the price of one crossing is worth it.

1. Each top-level zone is laid out on its own, with the rules above.
2. The zones start in the columns of a graph that has one node per zone.
3. Simulated annealing moves zones, swaps them and flips them vertically, scoring link length, crossings, links through other zones, right-to-left links, how far links are from straight, and overall size. Every unit of a link's length counts, and counts again past 700. The size counts as the longer side of a 16:10 canvas the zones fit in, so they fill such a canvas rather than stretch into a strip. A link used for a round trip counts double, since it is traversed twice in its time. A link is off straight by the sideways distance between its two stations, up to 160, counted twice; this applies where no node of either zone stands between them on that side, and a link that cannot be straight counts the full 160.
4. Each zone slides towards the zones it is linked to, as far as its clearance allows, so that linked neighbors end up one clearance apart.
5. Zone edges are aligned where that costs almost nothing, and the zones slide together once more.
6. A zone moves up to 120 units to put the two stations of a link level, or one straight above the other, with nothing between them. It takes the move that straightens the most of its links, as long as the rest of the score rises by less than 120 per link. The best of six seeded runs is kept, counting each straight link as 120 in its favor.

The result is deterministic. Zones no longer share columns, so a column does not line up across the diagram. The search takes about a second at 300 nodes, so the last result is reused until the nodes, groups, edges or round trips change. Edge labels are left out of the search, so typing one never rearranges the zones. A long label can still widen its zone, and the zones to its right then move aside.

### Routing rails

Rails are routed after layout, in `scene/route.ts`, once for an arrangement: a rail keeps its course from step to step. A self-loop is not routed; it stays a curve at its station's upper right.

1. **The grid.** Routes run on the lines through the middle of every station, 8 units beside every node's area (its station and labels), 12 units inside and outside every zone border, and just past every zone name.
2. **One route at a time, shortest reach first.** A route is the cheapest way over the grid from one station to the other (A*). What it pays for:

   | Cost | Amount |
   | --- | --- |
   | Length | 1 per unit |
   | A turn | 36 |
   | Crossing a route found earlier | 90 |
   | Length inside a zone that holds neither end | 4 per unit |
   | Length on a line that already carries routes | up to 10% more for two, 50% more for each further one |
   | Leaving a node downwards, or reaching one from below | 30 |
   | Meeting a station off its middle | 2 per unit |

   Another node's area and a zone's name are closed. A route leaves its own station in a straight line, and enters a node's area only along a line through that station's middle, or through the middle of a linked station that is 12 units or less off it.
3. **Side by side.** Routes that share a line are set 7 units apart, within 42 units, or 28 where they meet a station. Two routes that run together keep their sides round every corner: the one that turns off to the left at the end of their shared run is the left one all along, so they part without crossing. Routes with nothing to tell them apart, such as the two directions between one pair of stations, each keep to the left of their own direction.
4. **The ends.** A route stops 2 units outside its station's outline. One that leaves a node downwards starts below the node's labels instead.

A packet that travels where no edge runs gets a route of its own, found together with the edges. If no route is found at all, the rail is a straight line between the two stations.

**Edge labels** are placed once per arrangement too (`placeLabels` in `scene/rails.ts`). A label goes beside the longest stretch of its rail that no other rail runs beside and that is long enough for it: above or below a level stretch, right or left of an upright one, 7 units away. It keeps clear of stations, node labels, zone names, other edge labels, other rails and the middle of its own rail, where a step puts numbered stops. On a rail too short for that, the label goes 20 units above or 28 below the middle. A label with no free place takes the one that covers the least.

Routing takes 30 to 40 ms at 100 nodes and about 220 ms at 300, so the last result is reused until a node's or group's place, an edge, an edge label or an `animate` pair changes.

### Invariants

Tests are in `layout/__tests__/layout.test.ts`, `scene/__tests__/scene.test.ts` and, for rails, `scene/__tests__/rails.test.ts`.

| Invariant | Test |
| :--- | :--- |
| The same input gives the same layout. No randomness or unordered iteration | `is deterministic` |
| Nodes never overlap, and unrelated nodes never land inside a group | `auto layout never overlaps nodes or puts foreign nodes inside groups` |
| A group wraps all of its descendants | `wraps groups around their (nested) members` |
| Connected rows stay level | `keeps connected rows on one line` |
| Samples do not gain crossings | `stays within its crossing budget` |
| Room for self-loops is kept | `self-loop room` |

When you add a diagram to the samples or `examples/`, add its limit to `CROSSING_BUDGET`. If a rule change reduces crossings, lower the limit.
