# `.dav` language specification (v2)

The normative definition of the `.dav` language, version 2: what a file may contain, and what it means. Three things are not part of it: where the nodes are placed, which [How diagrams are laid out](https://github.com/Osg-Junue/DynamicArchitectViewer/blob/main/docs/layout.md) describes; how much of a long text is shown before it is cut off, which `dav check --detail` reports as `text-cut` for the texts of nodes, `static` labels and packets, though not for the language and title of code, in a file without errors and warnings; and how the viewer presents a step beyond what this page says it shows, such as where its camera looks and how it marks the zones a packet crosses.

## Design goals

1. **System definitions for AI; animations for people.** Authors (especially AI agents) describe true system boundaries, components, and step-by-step behavior without layout tricks or coordinate hints; the renderer turns those facts into a clear overview and animation.
2. **Zero boilerplate.** No file header is required; start directly with `title`, `group`, `node`, or `step`.
3. **No double declaration.** `group` and `node` declare the structure; `step` declares both moving traffic (`animate`) and non-moving connections (`static`). There are no top-level edges.
4. **Self-contained steps.** `desc`, `focus`, `state`, `animate`, and `static` apply to their own step only. Nothing carries over from earlier steps, so no cleanup boilerplate is needed.
5. **No coordinates.** There is no syntax for positions or sizes. Layout follows structure and sequence flow automatically.
6. **A small grammar and clean diffs.** One declaration per line, with a canonical formatter.

## Lexical structure

A file is UTF-8 text. Lines end with `\n` or `\r\n`. A `\r` on its own does not end a line: it counts as whitespace, so a comment runs on past it.

| Token | Definition |
| :--- | :--- |
| Whitespace | Spaces, tabs and line breaks, and the other characters that Unicode counts as whitespace, such as the no-break space and the ideographic space U+3000. The zero-width space U+200B and U+FEFF are not whitespace: between tokens they are a `syntax-error`. A byte order mark at the very start of a file is dropped when the file is read. Whitespace separates tokens and is otherwise ignored, so a statement may run over several lines. The formatter writes one statement to a line |
| Comment | `//` to the end of the line. A comment may stand wherever whitespace may |
| Keyword | `title`, `group`, `node`, `step`, `desc`, `focus`, `state`, `animate`, `static`, `true`, `false`. Keywords are lowercase and reserved: none of them can be an identifier |
| Identifier | `[A-Za-z_][A-Za-z0-9_]*`, other than a keyword. Identifiers are case-sensitive: `Api` and `api` are two identifiers, and `Node` is an identifier, not a keyword. `code` is a keyword only at the start of a statement in an `animate` body, so `node code` declares a node named `code` |
| Number | An optional `-`, digits, and optionally `.` and more digits. Read in attribute values only so that a number where another type is expected reports `invalid-attribute-value` |
| String | Text between double quotes, which cannot hold a line feed: one in it is a `syntax-error`, though in a file with `\n` line endings one right after a `\` is an `invalid-escape` instead. The escapes are `\"`, `\\`, `\n` (a line break) and `\t` (a tab). A description and the text of code show a line break as one; a text drawn on one line, such as a label, a `sub`, a badge or the title of code, does not break at it, and how it shows there is not defined: leave it out of such texts. Any other sequence that starts with `\` reports `invalid-escape` and is kept as written. A string that is not read, such as the value of an attribute that is ignored, is not checked |
| Code fence | Text between two runs of three backticks, ```` ``` ... ``` ````, on one line or over several. Its text is taken as written, without escapes, from just after the opening backticks: in ```` ```json ````, `json` is the first line of the code, not its language. The text cannot contain three backticks in a row, nor end with a backtick |
| Arrow | `-->`, `..>`, `<->`, `<.>` |
| Hex color | `#` followed by letters and digits, such as `#ff0000`. It is read only so that it can be reported: no attribute takes it |
| Punctuation | `{`, `}`, `[`, `]`, `,`, `:` |

## Grammar

```ebnf
Document     ::= Statement*
Statement    ::= Title | Group | Node | Step

Title        ::= "title" String
Group        ::= "group" Identifier String? Attributes? "{" (Group | Node)* "}"
Node         ::= "node" Identifier String? Attributes?

Step         ::= "step" String "{" (Desc | Focus | State | Animate | Static)* "}"
Desc         ::= "desc" String
Focus        ::= "focus" Identifier ("," Identifier)*
State        ::= "state" Identifier Attributes
Animate      ::= "animate" Identifier Arrow Identifier (":" String)? Attributes? AnimateBody?
Static       ::= "static" Identifier Arrow Identifier (":" String)? Attributes?
AnimateBody  ::= "{" (Desc | Code)* "}"
Code         ::= "code" CodeLang? (String CodeFence | CodeFence | String)
CodeLang     ::= Identifier

Attributes   ::= "[" (Attribute ("," Attribute)* ","?)? "]"
Attribute    ::= (Identifier | "desc") ":" Value
Value        ::= String | Number | HexColor | Identifier | "true" | "false"
```

Anything else is a `syntax-error`, or an `unexpected-eof` when the file ends before a statement or a block is complete. Three consequences that are easy to miss:

- **A statement takes at most one attribute block.** `[desc: "...", parallel: true]` is right; `[desc: "..."] [parallel: true]` is a syntax error. A comma after the last attribute is allowed.
- **The label of an `animate` or a `static` follows a colon.** `animate a --> b : "Label"` and `static a ..> b : "Label"`; without the `:`, the string is a syntax error. That of a `node` or a `group` takes none: `node a "Label"`, where `node a : "Label"` is a syntax error.
- **A `code` string takes no title.** The title string is followed by a code fence: `code json "Title" "{ ... }"` is a syntax error, and its message says so.

The grammar is looser than the language in a few places, so that a mistake gets a message of its own: a two-way arrow on a self-loop, or a number or a hex color as a value. The semantics below say which of these are errors.

## Semantics

### The file

- **No header statement.** A `.dav` file starts directly with comments, whitespace, or statements (`title`, `group`, `node`, `step`).
- **`title` is optional.** It names the diagram. Given more than once, it reports `duplicate-title`, and the last one is used.
- **At least one `step` is required.** `.dav` v2 is exclusively for animated diagrams. A file without a `step` reports `missing-step`.
- **The top-level statements can come in any order,** and a reference may come before the declaration it names.

### Identifiers and references

Nodes and groups share one namespace, and each identifier can be declared once. Declarations count in the order of the file, whatever their kind, and declaring a taken identifier again reports `duplicate-id`. A node or a group so declared is left out, and the members of a group left out belong to the group around it.

| What refers | What it may name |
| :--- | :--- |
| Each end of an `animate` | A node |
| Each end of a `static` | A node or a group |
| Each name in `focus` | A node or a group |
| The target of `state` | A node or a group |

A name that is declared as nothing reports `undefined-reference`, and one of another kind reports `reference-kind-mismatch`. An `animate` or `static` with such an end is ignored.

### Attributes

Each attribute has a type:

| Type | Written as |
| :--- | :--- |
| string | A string: `"..."` |
| boolean | `true` or `false` |
| color | A color name, in any case: `red`, `orange`, `yellow`, `green`, `teal`, `blue`, `purple`, `pink`, `gray`. In `state` only, also `none`. A color is drawn in a shade that suits the light or dark theme |
| icon | An icon name, in any case. See [`node`](#node) |
| border | `solid` or `dashed`, in any case |
| mount | `border`, in any case |

Attribute names are lowercase, as the tables give them: `Icon` is an unknown attribute. Color and icon names are written without quotes: `color: "red"` reports `invalid-attribute-value`. No attribute takes a number. An attribute that the statement does not take reports `unknown-attribute` and is ignored. One that it takes, given twice in one block, reports `duplicate-attribute`, and the last one that is not ignored is used. A value of the wrong type, or not one of the allowed names, reports `invalid-attribute-value`, `invalid-color` or `unknown-icon`, and the attribute is ignored. A color or an icon written within two letters of a name, or one letter for a name of three letters or fewer, gets that name as a suggestion; `none` is never suggested, and a hex color gets no suggestion.

### `group`

```dav
group vpc "Production VPC" [color: blue] {
  node igw "Internet Gateway" [icon: router, mount: border]
  node alb "Application LB" [icon: lb]
  group az_a "Availability Zone A" [border: dashed] {
    node api "Order API" [icon: api]
  }
}
```

A group is a zone: a frame drawn round its members. It contains only groups and nodes, and groups can nest. A group has no visibility of its own: its frame is drawn in every step, also while every node in it is hidden. Its label is the string after its identifier, or the identifier when there is none; `""` gives an empty label.

| Attribute | Type | Default | Effect |
| :--- | :--- | :--- | :--- |
| `color` | color | none | Color of the zone |
| `border` | border | `solid` | Border stroke style (`solid` or `dashed`, e.g. for Availability Zones) |

### `node`

```dav
node db_pri "Primary DB" [icon: database, sub: "Aurora Writer", badge: "WRITER", visible: true, color: green]
```

A node belongs to the group it is declared in, or to none at the top level. Its label is the string after its identifier, or the identifier when there is none; `""` gives an empty label.

| Attribute | Type | Default | Effect |
| :--- | :--- | :--- | :--- |
| `icon` | icon | `server` | The symbol of the node |
| `sub` | string | none | A second line under the label |
| `badge` | string | none | A badge above the node |
| `visible` | boolean | `true` | Whether the node is shown in the overview and in a step unless `state`, `animate` or `static` includes it |
| `color` | color | none | Color of the ring, the icon and the badge |
| `mount` | mount | none | `border` mounts a grouped node onto its parent group's boundary on the side facing its external connections—falling back to internal out/in degree direction when none exist (ignored with `attribute-not-applicable` on top-level nodes) |

The 51 icons:

- **Infrastructure and logic (37):** `server`, `container`, `function`, `runtime`, `database`, `cache`, `queue`, `storage`, `lb`, `firewall`, `cdn`, `cloud`, `building`, `router`, `hub`, `wifi`, `external`, `auth`, `ai`, `api`, `mail`, `monitor`, `schedule`, `search`, `logic`, `webhook`, `payment`, `key`, `dns`, `shield`, `stream`, `event`, `nat`, `registry`, `warehouse`, `vault`, `audit`
- **Screens, actors and documents (14):** `screen`, `modal`, `browser`, `desktop`, `mobile`, `terminal`, `device`, `printer`, `chat`, `sheet`, `file`, `user`, `users`, `bot`

### Overview

Before step 1 comes the overview: the structural map of the system with nothing dimmed, nothing moving, and no edge labels.

- **Nodes and groups:** Every group and every node whose declared `visible` is `true` is shown with its declared attributes. Nodes with `visible: false` reserve their space in the layout so nothing moves when a step reveals them, and are omitted from the overview until a step shows them.
- **Aggregated connections:** Overview lines are synthesized automatically from the `animate` and `static` statements across all steps whose both endpoints are visible in the overview.
  - All statements joining the same unordered pair of endpoints `{a, b}` (or self-loop `{a, a}`) collapse into a single rail.
  - **Arrowheads:** If both directions between `a` and `b` appear (either as `a --> b` and `b --> a` across statements, or as `<->` / `<.>`), the overview rail carries arrowheads at both ends. Otherwise it carries an arrowhead only at the target.
  - **Line style:** Solid if any `animate` or `static` on the pair uses a solid arrow (`-->` or `<->`); dashed if all use dashed arrows (`..>` or `<.>`).
  - **Labels:** Overview rails carry no text labels by default; specific request, event, and relation names belong to each step. Still SVG exports can opt in (`--still --labels`), which displays each endpoint pair's first non-empty label across steps (checking `animate` before `static` within each step; on a single-step still `--still --step <n> --labels`, a step's `static` label takes precedence over its `animate` label on the same pair).

### `step`

```dav
step "Write the order and replicate" {
  desc "The API commits to the primary database while asynchronous replication keeps the standby current."
  state db_pri [badge: "COMMIT", color: green]
  animate api --> db_pri : "INSERT order" [desc: "The order transaction commits on the primary"]
  static db_pri ..> db_sby : "Sync Replication"
}

step "Primary database fails over" {
  desc "The primary fails, so the standby is promoted and traffic moves to it."
  focus api, db_pri, db_sby
  state db_pri [badge: "DOWN", color: red]
  state db_sby [badge: "PROMOTED", color: green]
  animate api ..> db_sby : "Reconnect" [icon: key, color: yellow, desc: "The endpoint now points at the promoted standby"]
}
```

The steps play in the order they are written, numbered from 1. The viewer opens on step 1 without playing it: its first phase repeats until the steps are played.

A step's string is its title. Its `desc` statements are its description, joined with line breaks when there are several. The viewer's playback bar shows two lines of it, and the whole text on hover; an exported picture shows two lines, the lines after the second running on at the end of it.

**Every statement inside a `step` applies to that step only.** `desc`, `focus`, `state`, `animate`, and `static` do not carry over to later steps.

#### `state`

`state` overrides attributes of a node or a group for its step only.

| Attribute | Type | On a node | On a group |
| :--- | :--- | :--- | :--- |
| `badge` | string | The badge for this step. `""` removes a declared badge for this step | Not applicable |
| `visible` | boolean | Shows or hides the node in this step | Not applicable |
| `color` | color, or `none` | The color for this step. `none` clears a declared color for this step | The color for this step. `none` clears a declared color for this step |

- **Step-local only.** In step *k*, only the `state` statements inside step *k* apply on top of the node's or group's declared attributes. When multiple `state` statements in the same step target the same attribute, the last one wins.
- **A state shows from the start of its step,** before the first packet of that step moves.
- An attribute that does not apply to its kind of target reports `attribute-not-applicable` and changes nothing on the target, though `visible: false` still keeps the `state` from emphasizing it, as below. An empty block, `state a []`, reports `empty-state`.

#### What a step shows

A step emphasizes the nodes and groups named in its `focus`, the targets of its `state` statements (except `visible: false`), both nodes of each `animate`, and both endpoints of each `static`.

- **When a step emphasizes anything, the rest is dimmed.** A node is dimmed unless it, or a group around it, is emphasized. A group is dimmed unless it, a group around it, or something inside it is emphasized.
- **A node is shown** when it is visible (as declared or overridden by `state` in this step), and also when an `animate` or `static` in this step uses it as an endpoint.
- **Connections drawn in the step:** A step draws every connection declared by its own `animate` and `static` statements, plus any overview connection whose two endpoints are both visible and undimmed in that step. A step that emphasizes nothing dims nothing and draws all overview connections between visible nodes.

#### `animate`

`animate` declares a connection in the diagram and moves a packet along it during the step.

| Arrow | Line | Packet behavior |
| :--- | :--- | :--- |
| `-->` | Solid | Goes from the first node to the second |
| `..>` | Dashed | Goes from the first node to the second |
| `<->` | Solid | Goes to the second node, rests there a moment, and comes back: about twice as long as a one-way packet on the same way |
| `<.>` | Dashed | Goes to the second node, rests there a moment, and comes back: about twice as long as a one-way packet on the same way |

| Attribute | Type | Default | Effect |
| :--- | :--- | :--- | :--- |
| `icon` | icon | none | Draws the packet as a chip that shows what it carries, instead of a dot |
| `color` | color | the accent color | Color of the packet and of the line it runs on |
| `parallel` | boolean | `false` | Plays in the same phase as the `animate` before it |
| `desc` | string | none | Text of the packet's callout |
| `code` | string | none | A code snippet in the callout. See [`code`](#code) |

- **The label** after `:` names what the packet carries, and is shown with it.
- **The rail** follows the layout's routed path between the two endpoints; in the step, its line takes the arrow style (`-->`/`<->` solid, `..>`/`<.>` dashed) of the `animate`.
- **On a self-loop,** `animate a --> a` and `animate a ..> a` go round the loop at the upper right of the node once. A two-way arrow (`<->` or `<.>`) on a self-loop reports `invalid-self-arrow`.
- **Phases.** The `animate` statements of a step play one after another, each in a phase of its own. `parallel: true` puts an `animate` in the phase of the one before it, so that they leave together; on the first `animate` of a step it has no effect. A packet takes longer the longer its way on screen is and the more packets share its phase, and a phase lasts until its last packet arrives, with a short pause after it. A packet, its callout and the color it gives its line last for its phase; when packets of one phase run on the same pair, the line takes the color of the first. When a step has more than one phase, each packet is numbered by its phase, with a letter for each of several in one phase: `1`, `2a`, `2b`. The number shows on its callout and at a stop halfway along its way.
- **Still pictures.** Where nothing moves, in a still export of a step or in the viewer with motion stopped, no packet and no callout is drawn: the lines the step's packets run on are lit, each in the color of the first packet on it. In a stopped viewer, picking a node shows, stopped on their way and with their callouts, the packets of a phase in which it sends a packet, or, if it sends none, in which it receives one: the first such phase, or, while one of them is shown after a pick, however it was picked, the next one, and after the last one the still picture again. A reader who asks for reduced motion gets a viewer that is always stopped.
- **Its description** is the `desc` attribute followed by the `desc` statements of its body, joined with line breaks. In a description, the whitespace at the start and the end of each line is dropped, so it cannot be indented, and whitespace in a row shows as one space, though the viewer's playback bar counts only spaces and tabs as whitespace here; a packet's callout, and a step's description in an exported picture, leave out empty lines. A packet's callout shows up to four lines; the lines after the fourth run on at the end of it. A packet with no label, `desc` or `code` has no callout.

#### `static`

```dav
static db_pri ..> db_sby : "Sync Replication"
static api --> metrics [color: teal]
```

`static` declares a connection that exists during its step without moving a packet along it—such as background monitoring, asynchronous replication, or an idle dependency relevant to the scene.

| Arrow | Line | Arrowheads |
| :--- | :--- | :--- |
| `-->` | Solid | At the second endpoint |
| `..>` | Dashed | At the second endpoint |
| `<->` | Solid | At both endpoints |
| `<.>` | Dashed | At both endpoints |

| Attribute | Type | Default | Effect |
| :--- | :--- | :--- | :--- |
| `color` | color | default edge color | Color of the line during this step |

- **The label** after `:` is drawn on the line during this step only. It is not shown in the overview.
- **On a self-loop,** `static a --> a` and `static a ..> a` draw a static loop at the upper right of the node. A two-way arrow (`<->` or `<.>`) on a self-loop reports `invalid-self-arrow`.
- **Both endpoints** are visible and emphasized during this step, just as for `animate`.

#### `code`

`code` gives an example of what the packet carries, drawn in a frame in the packet's callout, with the language and the title above it. It is written in the body of `animate`, or as its `code` attribute:

| Form | Language | Title |
| :--- | :--- | :--- |
| ```` code json "Title" ``` ... ``` ```` | Optional | Optional |
| `code json "..."` | Optional | None: `code json "Title" "..."` is a syntax error |
| `[code: "..."]` | None | None |

````dav
step "Place an order" {
  animate cdn --> api : "POST /orders" [desc: "Order API validates the idempotency key"] {
    code json "Order Request" ```
      {
        "orderId": "ord_01JCK9X7",
        "amount": 14800
      }
    ```
  }
}
````

- **The language** is any identifier. It names the code above it; every language is colored alike.
- **The text is drawn tidied,** whatever its form: line breaks, a `\r` on its own included, become `\n`, each tab becomes two spaces, whitespace at the end of a line is removed, the blank lines at the start and at the end are removed, and so is the indentation that all its lines that are not blank share, counted in spaces. Otherwise, the text of a code fence is taken as written, and that of a string with its escapes, `\n` for a line break.
- **Empty code,** of whitespace only, draws no frame.
- **One per `animate`.** The attribute and each `code` statement count; two `code` attributes in one block are a `duplicate-attribute` instead. Each one after the first reports `duplicate-code`, and the last one that is not empty is used.

## Formatting

The formatter writes a file in its canonical form, without changing what it means. VS Code formats a `.dav` file on request, and `dav format` and `dav check --write` do the same.

- One space between tokens: `animate a --> b : "Label" [key: value, key: value]` and `static a ..> b : "Label" [color: yellow]`, and no comma after the last attribute.
- Two spaces of indentation for each level of `{ }`. An empty `group` or `step` body is written `{}`, and an empty `animate` body is dropped.
- Comments are kept. A comment after a statement stays on its line; one after a `{` goes to the next line. Two blank lines or more become one, and the blank lines at the start and the end of the file and of a block are removed.
- A file with any `\r\n` line ending gets `\r\n` on every line; any other file gets `\n`. The file ends with one line ending, and a file of whitespace only becomes empty.
- The text of a code fence is tidied: a `\r` on its own becomes a line break, tabs become two spaces, and whitespace at the end of a line and the indentation that all its lines that are not blank share, counted in spaces, are removed. It goes on lines of its own, two spaces deeper than its `code`, with the closing backticks on a line of their own, so a one-line fence with one line of code in it becomes three lines. A `code` string stays on one line.
- A statement with a comment among its own words is kept as written, but indented to its depth and without spaces at the ends of its lines. For a `group`, a `step` or an `animate`, a comment before its `{` keeps its body as written too, and the lines of a code fence in it keep their own indentation. A `code` statement with a comment among its words is kept as written up to its code fence, which is laid out as above. A file with a `syntax-error`, an `unexpected-eof`, or a string that runs over a line break is not changed.

## Diagnostics

A diagnostic does not stop the rest of the file from being read, and the table says what becomes of what is in error where it matters. After a `syntax-error`, the diagnostics that follow it can come from it: fix the first one, and read the file again. A file with an error is not valid, and how it is drawn is not defined beyond that; `dav export` exports nothing from it.

| Code | Severity | Reported when |
| :--- | :--- | :--- |
| `missing-step` | Error | The file declares no `step` |
| `duplicate-title` | Warning | `title` appears more than once. The last one is used |
| `duplicate-id` | Error | An identifier (`node` or `group`) is declared more than once. A node or a group declared later is left out |
| `undefined-reference` | Error | `focus`, `state`, `animate`, or `static` names an identifier that is not declared |
| `reference-kind-mismatch` | Error | A name is of the wrong kind, such as a group as an end of an `animate` |
| `unknown-attribute` | Warning | The statement does not take the attribute. It is ignored |
| `duplicate-attribute` | Warning | An attribute that the statement takes appears twice in one block. The last one that is not ignored is used |
| `duplicate-code` | Warning | An `animate` has more than one `code`. The last one that is not empty is used |
| `invalid-attribute-value` | Error | The value has the wrong type. The attribute is ignored |
| `attribute-not-applicable` | Warning | A `state` attribute does not apply to its kind of target, or `mount: border` is used on a top-level node. It changes nothing on the target, though `visible: false` on `state` still keeps the `state` from emphasizing it |
| `empty-state` | Warning | A `state` has an empty attribute block |
| `unknown-icon` | Error | The icon is not one of the 51. A name within reach is suggested, as [Attributes](#attributes) says |
| `invalid-color` | Error | The color is not one of the nine names, or `none` outside `state`, or a hex color. A name within reach is suggested, as [Attributes](#attributes) says |
| `invalid-self-arrow` | Error | An `animate` or `static` from a node to itself uses `<->` or `<.>` |
| `invalid-escape` | Error | A string contains an escape other than `\"`, `\\`, `\n` and `\t` |
| `unexpected-eof` | Error | The file ends before a statement or a `{ }` or `[ ]` block is complete, outside a string and a code fence, and no `syntax-error` came before |
| `syntax-error` | Error | Anything else the grammar does not allow, such as a `dav` header, top-level edge syntax, a string or a code fence that the file ends inside. For a `code` string given a title on the same line, the message says that only a code fence takes one |

## Compatibility

`.dav` v2 is a breaking language revision introduced for the `2.0.0` release:

- The top-of-file `dav <version>` header is removed; files begin directly with statements or comments.
- Top-level edge statements (`a --> b`), edge `id`/`visible` attributes, and edge targets in `state` are removed.
- `static` is added as a reserved keyword inside `step`.
- `animate` permits dashed arrows (`..>`, `<.>`).
- `state` no longer accumulates across steps.
- Documents without a `step` are rejected with `missing-step`.

`2.0.0` replaces the v1 language cleanly without retaining a dual-version parser; `1.x` releases remain available on the v1 release branch/tags. The format of data embedded in exported HTML (`EXPORT_FORMAT_VERSION`) is versioned separately.
