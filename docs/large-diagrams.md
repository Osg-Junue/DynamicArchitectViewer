# Writing a large diagram

A diagram of about 50 nodes or more, or one of 4 zones or more with edges between them, is laid out by the same rules as a small one, with one more stage: where its links would run too long or cross in columns, its zones are placed by a search. Most surprises in a large diagram come from that stage and from loops. This page says what the layout does and does not do, and how to write a large diagram so that it comes out as you mean it. [How diagrams are laid out](layout.md) has the rules themselves, and [What the checker prints](checker.md) explains every line of the checker.

## What the layout does, and what it does not

| You want | What the layout does | Do this |
| :--- | :--- | :--- |
| A node or a zone at a place you choose | There is no syntax for positions. Edges set the columns, groups keep nodes together, and the order of the declarations breaks ties | Write the structure, and read where things ended with `--map` |
| The zones in the order you declared them | Where links in columns would run too long or cross, the zones at the top level are [placed freely](layout.md#placing-zones-freely), wherever their links come out shorter and cross less. Their order then follows their links. The search starts from the order of the declarations and prefers links that point right, so moving a declaration or turning an edge can move zones as well, but not into the order you declared. The checker's line of zones says `placed freely` when this happens | Nest the zones that belong together, as [below](#choose-the-zones) |
| Two zones next to each other | Only zones nested in one zone are sure to stand together, inside its frame | Nest them in one zone named for what they share, such as `edge` and `identity` inside `perimeter` |
| Two zones together without a frame round them | A hidden edge (`visible: false`) counts for the columns and pulls zones like any other, and its rail keeps its course while it is hidden | Nest them, or link them by an edge that says something true |
| An arrow that points back, its target staying on the left | In shared columns or inside one zone, an edge puts its target to the right of its source. Between zones placed freely, it sets no column, whichever way it is written | Write the pair as one two-way edge that names the node on the left first, such as `console <-> oncall` for a console that belongs on the left of the engineer who opens it; a packet can run along it either way. Between zones placed freely, nest the two zones in one zone that is a real boundary, where edges set the columns again, or leave them |
| Every edge of a loop to count | One edge of each loop is left out, so that the columns can be counted. The layout comes into the loop where its search first reaches it, and that node stands on the left | Read the note `back-edge`. To start the loop at another of its nodes, declare that node before the one the note names |
| A label of any length | A label is one line of a fixed width: the label of a node takes about 20 Latin letters or 12 Japanese characters | Keep labels short. Put the technology in `sub`, and what a message does in `desc` |
| To see the diagram | The checker does not draw. Its lines describe the layout that the preview draws, in numbers and words | Read `--detail` and `--map`. The user sees the diagram in VS Code, and `dav export` writes an SVG of it |
| A whole system on one canvas | A canvas reads best with up to about 100 nodes. Past that, a reader loses the thread, and placing the zones takes longer | Split a larger system into several diagrams, by area or by scenario |

## Write it in rounds

1. Write the nodes, groups and edges, without steps, but with the self-loops that the steps will animate: one more edge, a self-loop too, can move zones. Run the checker with `--detail` and `--map`.
2. Settle where things stand before writing steps, because a change to the structure can move whole zones. Read the notes and the crossings as [below](#read-what-the-checker-says).
3. Then write the steps a few at a time, appending them to the file, and run the checker after each batch. A file of a thousand lines can be too long to write in one reply, and an error is easier to find among a few new steps.

Steps never move anything, so what the structure settles in round 2 stays as it is.

## Choose the zones

- **A zone at the top level is one piece,** which the search moves about as a whole. A node outside every zone is a piece of its own. Give a zone to each boundary that matters: a network, a trust zone, a team, a deployment.
- **Where the zones are placed freely, each is laid out on its own,** by the column rules and the edges inside it. Edges that leave it change little inside it: a node with a column to spare can move towards them, the whole zone can be turned upside down, and nodes that share a column of the same zone are sorted by where all their connections lead. Zones nested in it are not sorted so: they stand in the order that the edges inside give them, and otherwise in the order they are declared.
- **Nest the zones that belong together,** so that they stand side by side, but not everything. With one zone at the top level there is nothing left to place freely, and a large diagram can come out much taller, with more crossings. So can one zone round most of it, such as a cloud round the edge, the services and the data: nest small zones that belong side by side, not the layers of a whole flow. Nesting changes the pieces that the search places, so the other zones can move as well, for the better or the worse: compare `--map` before and after, and keep it where the zones then stand in the order you mean, which counts for more than the number of crossings. Name the zone that holds them for a boundary that is real, such as a cloud, a site or a network: it adds a frame, not a part of the system.
- **Services that many nodes call,** such as outside APIs, can go in one zone of their own. Put them in it as nodes, not as zones of one node each: nodes are sorted by where their callers stand, and nested zones are not. Gathered like this they stand on one side, so the calls from callers on the far side run across the zone they leave. Left outside every zone, each stands by its caller instead, which crosses less but can put it to the left of its caller.

## Point the edges

- **Write each edge as the facts give it, from the caller,** so that a caller stands to the left of what it calls. An edge sets the column of its target. A job that reads a store is the caller too: `etl --> db`. Never turn a one-way edge round for the layout: its arrow would then say that the other node calls. Between zones placed freely it would not set a column either: the search only prefers links that point right, so a turned edge moves zones in ways that are hard to foresee. Where the node called belongs on the left, make the edge two-way, as below.
- **A request and its response** are one two-way edge that names the caller first, such as `api <-> db`. A packet runs along it either way. A reply is not another connection: where a scene shows it, make the edge two-way, even if the facts name only the call. Where no scene shows a reply, the edge stays one-way.
- **A call against the reading direction,** such as an engineer who opens a console that belongs on their left, a command sent back to a device, a webhook from an outside service, or the events that a service takes from a topic standing to its right, puts its target to the right of its source, in shared columns or inside one zone. Write it as one two-way edge that names the node on the left first, which here is the node called, not the caller, such as `payment <-> stripe : "Charges, webhooks"`, `shipping <.> order_events : "Subscription"`, dashed like every edge of a queue or a topic, or `db <-> etl : "Nightly extract"` for a database that a pipeline starts from. Its line has an arrowhead at each end, so where only one side calls, say which in the label, such as `oncall <-> pagerduty : "Pages (from PagerDuty)"`. Where it closes a loop, the checker names it in a note `back-edge`.
- **`animate` adds no connection.** Nodes joined only by packets are placed as if they were not connected, and a packet without an edge has no line to follow, so declare the edge.

## Read what the checker says

`--detail` gives the layout in numbers, and notes; `--map` says where each zone and node ended. In a large diagram, read them in this order:

1. **The notes `back-edge`.** Each names a loop and the node at its far end. If another node of the loop belongs on the left, declare it before the node that the note names.
2. **The note `left-links`.** Where the zones are placed freely, it names the connections between zones that point left, against the reading direction. A link between zones placed freely sets no column, so an edge written as you mean can still point left. Leave it: that is the price of placing zones freely, and writing an edge the other way round only to turn its link moves other zones, often for the worse. Change only an edge written other than you mean:
   - A two-way edge that names first the node you want on the right: write it the other way round.
   - A one-way call back, as in [Point the edges](#point-the-edges): make it one two-way edge that names the node on the left first.

   Two zones that belong together can be nested, as in [Choose the zones](#choose-the-zones).

   `--map` gives every connection the same way: one that runs `left` points against the reading direction.
3. **The crossings by zone.** A layout line counts the crossings by the zones that the two connections join, the most first.
   - Many between connections of one kind, such as `"GCP"–"External" × "GCP"–"External"`, come from the order of the nodes at one end. Put those nodes directly in their zone, where they are sorted, or declare the zones nested in it in the order of what they connect to.
   - Many between connections inside a zone and ones that leave it, such as `"GCP" × "GCP"–"External"`, mean that those run across the zone, from callers on its far side. That is the price of gathering their targets on one side.
   - Many inside one zone, such as `"GCP" × "GCP"`, are that zone's own. Swap the declarations of nodes that share a column, as in a small diagram.

**Stop** when the map shows the zones in the order you mean, and no note names something written other than you mean. Fewer crossings and fewer links that point left pull against each other: turning edges to trade one for the other is no progress, and a fresh arrangement found that way is as likely to be worse.

## Write the steps

- **A step shows its own part.** `animate`, `state` and `focus` emphasize the nodes they name, dim the others, and hide the edges that do not join two emphasized nodes. A dense overview reads better step by step, so a crossing in the overview matters less than one inside a step.
- **Keep a step to one path** where you can. A request that crosses the whole diagram reads as one path; packets in several places at once do not.
