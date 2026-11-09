# Design decisions

Why some obvious features are not here. Please read this before proposing one of them.

## No manual positions

There is no syntax to place or pin a node. Hand-placed coordinates make every addition a manual layout job and bury the real change in the diff. To influence the result, use edges, groups and declaration order, as described in [How diagrams are laid out](layout.md).

## No branching scenarios

A `scenario` attribute on `step`, with a selector for normal and failure paths, was built and tried in the preview. It was declined for three reasons:

- **Plain steps already work.** "Normal flow, failure, retry, recovery" reads well as one sequence of steps, as in `examples/01-infra-ha-failover.dav` and `examples/05-sequence-payment-retry.dav`. `badge: ""` and `color: none` reset state from any step.
- **Paths get hidden.** The timeline shows every step at a glance. A selector would hide the other paths.
- **Files get harder to follow.** With steps from several scenarios in one file, it is harder to see which ones each `state` applies to. Scenarios also rarely rejoin cleanly: a success and a failure usually end differently.

## No lifeline sequence view

Drawing participants in a row with messages stacked below was also compared in the preview. It was declined because:

- **Time would be shown twice.** Static tools stack messages vertically because their diagrams cannot move. Here, `step` and `animate` already show time.
- **Structure would be lost.** A single row drops the groups and arrangement that give the diagram its meaning, and state changes end up far from the messages that cause them.
- **It needs a second renderer**, against the [one-renderer principle](architecture.md#principles).

For sequence-style flows, write steps of `animate`, and use `icon` on a packet to show what it carries.

## No vendor logos in the built-in icons

The built-in icons describe roles, such as `database` or `queue`. Adding product logos would make the list open-ended, and a logo says less than a role plus a `sub` label such as `"Aurora Writer"`.
