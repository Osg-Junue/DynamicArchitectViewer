# How diagrams are laid out

`.dav` files have no coordinates. You describe what connects to what, and the layout follows. This guide explains what to write to get the arrangement you want. The [exact rules](https://github.com/Osg-Junue/DynamicArchitectViewer/blob/main/docs/layout.md#exact-rules) are for contributors: writing a diagram needs none of them.

## The short version

- **Edges decide the column.** Things flow from left to right.
- **Groups decide what stays together.**
- **Declaration order breaks ties**, from top to bottom.
- **Steps never move anything.** A node stays in the same place for the whole diagram, and writing steps never rearranges it.

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

From the caller to what it calls, as the facts give it: `client --> api` says that `client` calls `api`, and puts `client` on the left of `api`. Through a queue, a topic or a stream, it goes the way the messages go: from the producer, and to whatever takes them, pushed or pulled. Do not turn an arrow round to move a node: it would then say that the other node calls. For a call and its answer, use a single two-way edge (`client <-> api`): the first node named goes on the left, which for a request and its response is the caller. [Cycles](#cycles) says what to do with a call that runs back.

### Cycles

If edges form a loop, one of them has to point back, and that one does not count. Which one depends on where the layout first reaches the loop: it searches depth first from the nodes in the order they are declared, following edges in the order they are written, and the node where it enters the loop goes on the left.

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

A loop is entered at the first of its nodes the search reaches, which can be a node that another node leads into, as here, where `x` is declared first:

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

`a` is declared before `b` but stands to its right, because the search reaches `b` from `x` first. Most loops of a large diagram are entered like this. A one-way edge that points back without making a loop does the same to its target, unless it runs between zones [placed freely](https://github.com/Osg-Junue/DynamicArchitectViewer/blob/main/docs/layout.md#placing-zones-freely): `worker --> console` puts `console` to the right of `worker`, wherever `console` is declared.

To keep a pair in the order you want, write it as one two-way edge, `a <-> b`. A two-way edge counts only in the direction it is written, so it makes no loop, and a packet can still run along it either way.

`dav check --detail` names the edges left out like this in notes `back-edge`, one for each pair of nodes and direction: the loop as the search went round it, where the layout came into the loop, and the columns its two ends took. Where that loop has two nodes, it is named only when the node declared later stands on the left. Where the zones of a large diagram are [placed freely](https://github.com/Osg-Junue/DynamicArchitectViewer/blob/main/docs/layout.md#placing-zones-freely), each zone is laid out on its own, so only a loop inside one zone leaves an edge out: a link between zones sets no column there.

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
| Move a node to the left | Remove an edge that points into it, or make it two-way, naming this node first. A one-way edge turned round does the same, but its arrow then says that the other node calls |
| Swap two nodes in a column | Swap their declarations |
| Keep nodes together | Put them in a `group` |
| Keep zones next to each other | Nest them in one `group`, then compare `--map`: the other zones can move as well |
| Show a path that appears later | Declare it with `visible: false`, then show it with `state` |
| Widen the gap between two columns | Use a longer label on an edge between them |
| Connect nodes without affecting layout | No edge does that: every edge counts. A packet can go between two nodes without an edge, but it then has no line to follow, and `dav check --detail` reports it |

## Things that surprise people

**A hidden node still takes up space.** A node with `visible: false` is placed like any other, so nothing moves when a step reveals it.

**A hidden edge still counts.** An edge with `visible: false` sets columns and pulls zones like any other, and its rail keeps its course while hidden, so nothing moves when a step reveals it. That also makes it no clean way to pull two zones together: it sets a column as well, and its rail takes room among the others while hidden.

**The zones of a large diagram are not in the order they are declared.** Where links in columns would run longer than 700 units or cross, the layout [places the top-level zones freely](https://github.com/Osg-Junue/DynamicArchitectViewer/blob/main/docs/layout.md#placing-zones-freely) wherever that leaves less of both, and their order then follows their links. The search starts from the order of the declarations and counts a link that points left against an arrangement, so moving a declaration or turning an edge can move zones as well, though not into the declared order. Zones nested in one zone stay together inside its frame, so nest the zones that belong together. That changes what the search places, so the other zones can move as well: compare `--map` before and after. Do not nest everything: with one top-level zone there is nothing to place freely, and a large diagram stands in shared columns, which can make it much taller and give it more crossings.

**`animate` adds no connection.** Nodes joined only by `animate` are placed as if unconnected. Add an edge if the position matters.

**A self-loop adds room above every row.** Each node gets the room the tallest loop of the diagram needs, so stations stay level from one zone to the next and the rails between them stay straight.

**A node outside a zone stands lower than the zone's top.** The first row of a group starts as far down as the first row of the deepest group nested in it. A zone's frame pushes its stations down by its header and by the room for loops, and without this a rail from a station outside a zone to one inside it would have to step down.

**There is no syntax to pin a node.** This is deliberate. See [Design decisions](https://github.com/Osg-Junue/DynamicArchitectViewer/blob/main/docs/design-decisions.md).

**Lines run level and upright, and keep clear of nodes.** A rail is made of straight stretches with rounded corners. It never runs through another node or over the name of a zone, and it goes round a zone it has nothing to do with unless the way round is much longer. Rails that share a line run side by side, so several rails can enter a node next to each other. Two stations that are 12 units or less off level are joined by one straight line that meets them a little off their middle.

