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

If edges form a loop, one of them has to point back, and that one does not count. Which one depends on where the layout first reaches the loop: it searches from the nodes in the order they are declared, following edges in the order they are written, and the node where it enters the loop goes on the left.

A loop that nothing else leads into is entered at its node declared first:

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

A loop that another node leads into is entered there, whatever the order of its own nodes:

```dav
node x
node a
node b
x --> b
a --> b
b --> a
```

```text
x ─── b ⇄ a
```

`a` is declared before `b` but stands to its right, because the search reaches `b` from `x` first. Most loops of a large diagram are entered like this. A one-way edge that points back without making a loop does the same to its target: `worker --> console` puts `console` to the right of `worker`, wherever `console` is declared.

To keep a pair in the order you want, write it as one two-way edge, `a <-> b`. A two-way edge counts only in the direction it is written, so it makes no loop, and a packet can still run along it either way.

`dav check --detail` names each edge that is left out like this, in a note `back-edge`: the loop it closes, where the layout came into the loop, and the columns its two ends took. A loop of two nodes is named only when the node declared later stands on the left. Where the zones of a large diagram are [placed freely](#placing-zones-freely), each zone is laid out on its own, so only a loop inside one zone leaves an edge out: a link between zones sets no column there.

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

**There is no syntax to pin a node.** This is deliberate. See [Design decisions](https://github.com/Osg-Junue/DynamicArchitectViewer/blob/main/docs/design-decisions.md).

**Lines run level and upright, and keep clear of nodes.** A rail is made of straight stretches with rounded corners. It never runs through another node or over the name of a zone, and it goes round a zone it has nothing to do with unless the way round is much longer. Rails that share a line run side by side, so several rails can enter a node next to each other. Two stations that are 12 units or less off level are joined by one straight line that meets them a little off their middle.

## Exact rules

This section is for changing the layout code in [`layout/index.ts`](https://github.com/Osg-Junue/DynamicArchitectViewer/blob/main/apps/vscode/src/layout/index.ts). Rail routing is not part of this stage. It lives in `scene/route.ts` and `scene/rails.ts`, and is described under [Routing rails](#routing-rails).

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
5. Move single nodes a little where that puts one of their links level or upright. This comes after [placing zones freely](#placing-zones-freely) too.

### Columns

- Rank is the longest path. Cycles are broken by ignoring back edges of a depth-first search that starts from each unvisited node in declaration order and follows edges in declaration order. A two-way edge is one edge from its first node to its second. Self-loops are ignored.
- The gap between columns is `max(congestionGap, needed - 132) + 16 * edges`, where `edges` is 1 if some group frame ends at the left column, plus 1 if some frame starts at the right one. Frames nested along one edge share its 16 of padding, so the gap does not depend on the nesting. `congestionGap` starts at 36 and widens by 14 per crossing link beyond 2 (up to 148) when long-span edges or degree ≥ 4 hubs cross that column gap (or ≥ 4 links span it). `needed` is `min(180, label width) + 32` for the widest label between those columns. The 132 is the node width (176) minus the station width (44), since a label can use the space beside the stations.
- The left and top margins are `40 + depth * 16`.

### Rows

Each group, and the top level, places two kinds of block: the nodes directly in it, one block per column, and its child groups.

- Blocks with no columns in common go side by side. Overlapping blocks stack with a gap of 28.
- The initial order is by leftmost column, with column blocks before child groups. Inside a block, the order is declaration order.
- A node is 176 × 118 whatever its icon, with 14 between rows (widened up to 34 when long-span edges or degree ≥ 5 hubs add cross-corridor traffic). Its station center is always 50 below its top, so nodes at the same Y are joined by a level line.
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

When the column layout leaves a link longer than 700 units (a link used for a round trip counts double) or two links that cross, on straight lines between stations, and there are at least two top-level zones, `layout/zoned.ts` tries another arrangement. It is kept if its long links and crossings weigh less than those of the column layout, counting each unit of a link beyond 700 once and a crossing as 700 units. Zones linked across one another can cross in shared columns with every link short: placing them freely can take the crossings out. A chain of zones has no crossings in columns but is a strip dozens of times wider than high; freeing its zones at the price of one crossing is worth it.

1. Each top-level zone is laid out on its own, with the rules above.
2. The zones start in the columns of a graph that has one node per zone.
3. Simulated annealing moves zones, swaps them and flips them vertically, scoring link length, crossings, links through or blocked by other zones (including L-path and perimeter-detour barriers), right-to-left links, links that run upright, how far links are from straight, and overall size. Every unit of a link's length counts, and counts again past 700. The size counts as the longer side of a 16:10 canvas the zones fit in, so they fill such a canvas rather than stretch into a strip. A link used for a round trip counts double, since it is traversed twice in its time. A link is off straight by the sideways distance between its two stations, up to 160, counted twice; this applies where no node of either zone stands between them on that side, and a link that cannot be straight counts the full 160. A link runs upright by what it goes up or down beyond what it goes to the right. In an arrangement no wider than high every such unit counts once more, so that an upright link costs twice a level one, and the zones of a flow stand side by side instead of in a stack. That weight falls evenly to nothing at twice as wide as high: a longer flow has to turn back under itself, or it becomes a strip.
4. Each zone slides towards the zones it is linked to, as far as its clearance allows, so that linked neighbors end up one clearance apart (60 × 34).
5. Zone edges are aligned where that costs almost nothing, and the zones slide together once more. On diagrams with up to 20 top-level zones, intra-zone nodes with DAG column slack shift toward external neighbors, nested or loop-bearing zones try a vertical flip, and nodes sharing a parent group and column are reordered by clamped neighbor barycenters and adjacent swaps whenever that lowers crossings or link spans.
6. A zone moves up to 120 units to put the two stations of a link level, or one straight above the other, with nothing between them. It takes the move that straightens the most of its links, as long as the rest of the score rises by less than 120 per link. The best of six seeded runs is kept, counting each straight link as 120 in its favor (and each crossing anywhere in the diagram as 180 against). Once a run is scored, its zones are straightened once more with 300 allowed per link: a link a few units off level costs its rail two bends, which the score does not count. Doing this after the score leaves which run is kept as it was.

The result is deterministic. Zones no longer share columns, so a column does not line up across the diagram. The search takes under two seconds at 300 nodes, so the last result is reused until the nodes, groups, edges or round trips change. Edge labels are left out of the search, so typing one never rearranges the zones. A long label can still widen its zone, and the zones to its right then move aside.

### Straightening single nodes

Columns, rows and the placing of zones leave some nodes a few units off a node they are linked to, and the rail between them then steps aside with two bends. Last, `layout/straightenNodes.ts` moves such a node:

- up to 60 units, to put the two stations level (12 or less apart, which a rail joins with one straight line) or one straight above the other, with no other node between them;
- only inside the frame it stands in, keeping 14 from other nodes and the room for their loops, and 28 from groups it is not in. Frames do not change;
- together with the nodes it stands level with (for a move up or down) or straight above or below (for a move sideways), where moving alone would bend those links: that move is tried as well, under the same rules for each node;
- by the move that straightens the most links, then by the one that moves fewer nodes, and by none that bends as many links as it straightens or makes them cross more, counted on straight lines between stations.

Nodes are visited in declaration order, for up to four rounds.

### Routing rails

Rails are routed after layout, by `routeEdges` in `scene/route.ts`, once for an arrangement: a rail keeps its course from step to step. A self-loop is not routed; it stays a curve at its station's upper right.

1. **The grid** (`scene/routeGrid.ts`). Routes run on the lines through the middle of every station (plus off-center vertical ports when a zone label sits overhead), 8 units beside every node's station area, 12 units beside wider node label blocks, 12 units inside and outside every zone border, on all four sides of every wall, and along interior tracks added across wide gaps (36+ units). Lines nearer to each other than 7 units, the distance rails keep, become one; a line through a station is always kept.
2. **Shortest reach first with rip-up & reroute** (`scene/routeSearch.ts`, `scene/route.ts`). A route is the cheapest way over the grid from one station to the other (A*), followed by up to two rip-up-and-reroute passes on winding or crossing routes whenever that lowers the total score. What a step pays for:

   | Cost | Amount |
   | --- | --- |
   | Length | 1 per unit |
   | Turns (1st / 2nd / 3rd+) | 40 / 52 / 115 |
   | Crossing an unrelated route | 160 (at a 90° vertex or at the far end of a shared run) |
   | Crossing a route that shares one station | 40; nothing for a route between the same two stations |
   | Length inside a zone that holds neither end | 4 per unit |
   | Length on a shared stretch | 6–25% per shared-endpoint route; 35–65% per unrelated route, counting one on a line less than 7 units away |
   | Leaving a node downwards, or reaching one from below | 30 |
   | Using the top port of a node that has a self-loop | 40 |
   | Turning within 18 units of either station's outline/labels | 180 |
   | Meeting a station off its middle | 2 per unit |

   Another node's area and wider label block are closed to other routes, and walls (zone names, self-loops plus 10 units round them, and loop labels) are closed with a 4-unit guard on non-station lines. A route leaves its own station in a straight line, and enters a node's area only along a line through that station's middle, or through an off-center port within 12 units when linked almost straight or past an overhead wall.
3. **Side by side** (`scene/routeSpread.ts`). Routes that share a line are ordered by turn preferences, packed into non-overlapping interval tracks, and set up to 7 units apart within 30 units (28 where they meet a station). More of them than that has room for stand nearer, down to 4 units, one more than the 3 a rail is wide: for that the group grows, up to 40 units at a station, which is 44 across, and 20 beside a loop. Only more rails than fit even so stand nearer still. A group is kept outside the areas of the nodes beside it, for which its rails may stand as near as 3.5. Rails of different lines that this leaves nearer than 7 units where they run beside each other are then moved apart, each as little as that takes. They keep the order they are in, except that a rail that turns off within the length of a rail of the other line goes on the side of it that it turns towards, where the other order would have its turn cross that rail. At the top or right port of a station with a self-loop, shared rails are biased away from the upper-right loop quadrant. Two routes that run together keep their sides round every corner: the one that turns off to the left at the end of their shared run is the left one all along, so they part without crossing. Routes with nothing to tell them apart, such as the two directions between one pair of stations, each keep to the left of their own direction. Two routes whose shared run has them turn off the same way at its two ends cross either way, and the far end chooses; where one of them belongs to a bundle (routes that share a station) and the other does not, the other takes the side of the bundle it is on from the bundle's other routes, so that it crosses the bundle instead of running inside it.
4. **The ends.** A route stops 2 units outside its station's outline. One that leaves a node downwards starts below the node's labels instead.

A packet that travels where no edge runs gets a route of its own, found together with the edges. If no route is found at all, the rail is a straight line between the two stations.

**Edge labels** are placed once per arrangement too (`placeLabels` in `scene/rails.ts`), placing shorter (more constrained) rails first. A label goes beside the longest stretch of its rail that is long enough for it (preferring unshared stretches, then shared ones): above or below a level stretch, right or left of an upright one, 7, 13 or 19 units away. It keeps clear of stations, node labels, zone names, other edge labels, other rails and the middle of its own rail, where a step puts numbered stops. A loop's label is always written above the middle of its curve, and the other labels keep clear of it as well. On a rail too short for that, the label goes 20 units above or 28 below the middle. A label with no free place takes the one that covers the least.

Routing takes about 30 ms for 100 nodes with as many edges, about 100 ms for 27 nodes with 53 edges, and under a second at 300 nodes: the time grows with the rails that cross and run together more than with the nodes. The routes are reused until a node's or group's place, a node's label text, an edge, the label of a loop or an `animate` pair changes. Any other edge label only has the labels placed again.

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
| An overview does not get harder to read | `is no harder to read than its budget allows` |

When you add a diagram to the samples or `examples/`, add its limit to `CROSSING_BUDGET`. If a rule change reduces crossings, lower the limit.

`scene/__tests__/quality.test.ts` measures the overview of every example as it is drawn, and of ten larger diagrams in `scene/__tests__/fixtures/`, each with five zones and over twenty nodes: rails that turn three times or more, crossings of the drawn rails, the share of links between zones that point to the right, edge labels written over a rail or another label, and width to height. Its `BUDGET` holds what each diagram measures now. The zones of the larger diagrams are placed by a search that a small change sends another way, so a change to the layout moves their numbers both ways: judge it by all of them together, and move the budget with it.
