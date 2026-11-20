# Writing a large diagram

A diagram of about 50 nodes or more, or one of 4 zones or more with connections between them, is laid out by the same rules as a small one. Its zones at the top level stand along the flow of its steps: what the steps reach first stands on the left. This page says what the layout does and does not do, and how to write a large diagram so that it reads well.

## What the layout does, and what it does not

| You want | What the layout does | Do this |
| :--- | :--- | :--- |
| A node or a zone at a place you choose | There is no syntax for positions. Groups keep nodes together, the steps set the order from left to right, and the order of the declarations breaks ties | Write the structure and the steps as they are, and read where things ended with `--map` |
| The zones in the order of the flow | With two zones or more at the top level, the zones stand along the forward flow of the steps: the zone a scenario enters first stands on the left, and the next one to its right. A connection back to a node the steps already reached, such as a reply, a retry or an alert, does not reorder them | Write the steps in the order things happen |
| Monitoring, logging and other background links out of the way | A `static` connection, and a zone that only such connections reach, attaches to the flow rather than reordering it, often in a band above or below it | Write a link that no packet travels as `static` |
| An arrow that points back | A reply or a way back may point left. That is expected: it reads as going back | Leave it |
| Two zones next to each other | Zones nested in one zone stand together inside its frame, laid out there by the same rules | Nest zones that share a real boundary, such as subnets in a VPC |
| A gateway on the edge of its zone | `[mount: border]` puts a node of a zone on the zone's border, on the side its connections leave by | Mount the node that a zone is entered or left through |
| A label of any length | A label is one line of a fixed width: the label of a node takes about 20 Latin letters or 12 Japanese characters | Keep labels short. Put the technology in `sub`, and what a message does in `desc` |
| To see the diagram | The checker does not draw. Its lines describe the layout that the preview draws, in numbers and words | Read `--detail` and `--map`. The user sees the diagram in VS Code, and `dav export` writes an SVG of it |
| A whole system on one canvas | A canvas reads best with up to about 100 nodes. Past that, a reader loses the thread | Split a larger system into several diagrams, by area or by scenario |

Never reorder steps, or turn an arrow round, to move a zone: the diagram would then say something that is not so.

## Write it in rounds

1. Write the zones and the nodes, and the steps of the main scenario in the order it happens. They set where the zones stand. Run the checker with `--detail` and `--map`.
2. Settle where things stand: read the map and the notes as [below](#read-what-the-checker-says).
3. Then add the other steps a few at a time, such as failures, retries and background links, and run the checker after each batch. A step that only goes back along a way the earlier steps came, or adds `static` links, is meant to leave the zones where they are; one that opens a new way forward can move them. A file of a thousand lines can be too long to write in one reply, and an error is easier to find among a few new steps.

The labels of nodes and packets, descriptions, `desc`, `focus` and `state` never move anything, and neither does a step of only those. A long name of a zone, or a long label of a `static` link, can widen its zone.

## Choose the zones

- **A zone at the top level is one piece,** placed as a whole. A node outside every zone is a piece of its own. Give a zone to each boundary that matters: a network, a trust zone, a team, a deployment.
- **Nest the zones that belong together,** such as subnets in a VPC or accounts in an organization. Each zone is laid out inside its frame by the steps that run inside it.
- **Services that many nodes call,** such as outside APIs, can go in one zone of their own, so that they stand together.

## Write the connections

- **Write each `animate` from the node that sends to the node that receives,** in the order of the scenario. The first step that joins two nodes decides how the layout reads the pair.
- **A reply goes back the same way:** a round trip `<->` when the reply follows at once, or an `animate` back in a later phase. It may point left.
- **Write a link that no packet travels as `static`:** replication, monitoring, DNS, secrets. A group can be one end of a `static`, for a link of a whole zone, such as its logs.
- **An arrow says who sends, and the steps say what happens first.** Write both as the facts give them, also where another way would place a zone better.

## Read what the checker says

`--detail` gives the layout in numbers, and notes; `--map` says where each zone and node ended. In a large diagram, read them in this order:

1. **The map.** Check that the zones stand in the order in which the scenario goes through them.
2. **The notes `back-edge`.** Each names a loop: one connection of it points back and sets no column. A way back that the scenario takes, such as a retry, a reply or a return to an earlier screen, closes one. [What the checker prints](checker.md#notes) says how to read the note.
3. **The crossings by zone.** A layout line counts the crossings by the zones that the two connections join, the most first.
   - Many between connections of one kind, such as `"GCP"–"External" × "GCP"–"External"`, come from the order of the nodes at one end. Putting those nodes directly in their zone, or declaring the zones nested in it in the order of what they connect to, can help.
   - Many between connections inside a zone and ones that leave it, such as `"GCP" × "GCP"–"External"`, mean that those run across the zone, from callers on its far side.
   - Many inside one zone, such as `"GCP" × "GCP"`, are that zone's own. Swapping the declarations of nodes that share a column often removes one, as in a small diagram.

**Stop** when the map shows the zones in the order of the scenario and no note names something written other than you mean. Crossings that a background link or a way back makes are the price of keeping the flow in order.

## Write the steps

- **A step shows its own part.** `animate`, `static`, `state` and `focus` emphasize the nodes they name and dim the others, and a connection with a dimmed end is not drawn in the step. A dense overview reads better step by step, so a crossing in the overview matters less than one inside a step.
- **Keep a step to one path** where you can. A request that crosses the whole diagram reads as one path; packets in several places at once do not.
