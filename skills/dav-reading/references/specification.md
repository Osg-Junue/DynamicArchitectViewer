# `.dav` language specification (`dav 1`)

The normative definition of the `.dav` language, version 1: what a file may contain, and what it means. Three things are not part of it: where the nodes are placed, which [How diagrams are laid out](https://github.com/Osg-Junue/DynamicArchitectViewer/blob/main/docs/layout.md) describes; how much of a long text is shown before it is cut off, which `dav check --detail` reports as `text-cut` for the texts of nodes, edges and packets, though not for the language and title of code, in a file without errors and warnings; and how the viewer presents a step beyond what this page says it shows, such as where its camera looks and how it marks the zones a packet crosses. For a guided introduction, open the documentation from the preview toolbar in VS Code.

## Design goals

1. **Structure and scenario in one file.** The static diagram (`group`, `node`, edges) and its behavior over time (`step`) are written separately in the same file.
2. **No coordinates.** There is no syntax for positions or sizes. Layout comes from the edges and the group hierarchy.
3. **A small grammar.** One declaration per line, with a syntax that people and AI agents can both write without guessing.
4. **Clean diffs.** The formatter writes a file in one canonical form.

## Lexical structure

A file is UTF-8 text. Lines end with `\n` or `\r\n`. A `\r` on its own does not end a line: it counts as whitespace, so a comment runs on past it.

| Token | Definition |
| :--- | :--- |
| Whitespace | Spaces, tabs and line breaks, and the other characters that Unicode counts as whitespace, such as the no-break space and the ideographic space U+3000. The zero-width space U+200B and U+FEFF are not whitespace: between tokens they are a `syntax-error`. A byte order mark at the very start of a file is dropped when the file is read. Whitespace separates tokens and is otherwise ignored, so a statement may run over several lines. The formatter writes one statement to a line |
| Comment | `//` to the end of the line. A comment may stand wherever whitespace may |
| Keyword | `dav`, `title`, `group`, `node`, `step`, `desc`, `focus`, `state`, `animate`, `true`, `false`. Keywords are lowercase and reserved: none of them can be an identifier |
| Identifier | `[A-Za-z_][A-Za-z0-9_]*`, other than a keyword. Identifiers are case-sensitive: `Api` and `api` are two identifiers, and `Node` is an identifier, not a keyword. `code` is a keyword only at the start of a statement in an `animate` body, so `node code` declares a node named `code` |
| Number | An optional `-`, digits, and optionally `.` and more digits. Only the header uses a number |
| String | Text between double quotes, which cannot hold a line feed: one in it is a `syntax-error`, though in a file with `\n` line endings one right after a `\` is an `invalid-escape` instead. The escapes are `\"`, `\\`, `\n` (a line break) and `\t` (a tab). A description and the text of code show a line break as one; a text drawn on one line, such as a label, a `sub`, a badge or the title of code, does not break at it, and how it shows there is not defined: leave it out of such texts. Any other sequence that starts with `\` reports `invalid-escape` and is kept as written. A string that is not read, such as the value of an attribute that is ignored, is not checked |
| Code fence | Text between two runs of three backticks, ```` ``` ... ``` ````, on one line or over several. Its text is taken as written, without escapes, from just after the opening backticks: in ```` ```json ````, `json` is the first line of the code, not its language. The text cannot contain three backticks in a row, nor end with a backtick |
| Arrow | `-->`, `..>`, `<->`, `<.>` |
| Hex color | `#` followed by letters and digits, such as `#ff0000`. It is read only so that it can be reported: no attribute takes it |
| Punctuation | `{`, `}`, `[`, `]`, `,`, `:` |

## Grammar

```ebnf
Document     ::= Header? Statement*
Header       ::= "dav" Number
Statement    ::= Title | Group | Node | Edge | Step

Title        ::= "title" String
Group        ::= "group" Identifier String? Attributes? "{" (Group | Node)* "}"
Node         ::= "node" Identifier String? Attributes?
Edge         ::= Identifier Arrow Identifier (":" String)? Attributes?

Step         ::= "step" String "{" (Desc | Focus | State | Animate)* "}"
Desc         ::= "desc" String
Focus        ::= "focus" Identifier ("," Identifier)*
State        ::= "state" Identifier Attributes
Animate      ::= "animate" Identifier Arrow Identifier (":" String)? Attributes? AnimateBody?
AnimateBody  ::= "{" (Desc | Code)* "}"
Code         ::= "code" CodeLang? (String CodeFence | CodeFence | String)
CodeLang     ::= Identifier | "dav"

Attributes   ::= "[" (Attribute ("," Attribute)* ","?)? "]"
Attribute    ::= (Identifier | "desc") ":" Value
Value        ::= String | Number | HexColor | Identifier | "true" | "false"
```

Anything else is a `syntax-error`, or an `unexpected-eof` when the file ends before a statement or a block is complete. Three consequences that are easy to miss:

- **A statement takes at most one attribute block.** `[desc: "...", parallel: true]` is right; `[desc: "..."] [parallel: true]` is a syntax error. A comma after the last attribute is allowed.
- **The label of an edge or an `animate` follows a colon.** `a --> b : "Label"` and `animate a --> b : "Label"`; without the `:`, the string is a syntax error. That of a `node` or a `group` takes none: `node a "Label"`, where `node a : "Label"` is a syntax error.
- **A `code` string takes no title.** The title string is followed by a code fence: `code json "Title" "{ ... }"` is a syntax error, and its message says so.

The grammar is looser than the language in a few places, so that a mistake gets a message of its own: a missing header, a dashed arrow in `animate`, a two-way arrow on a self-loop, a number or a hex color as a value. The semantics below say which of these are errors.

## Semantics

### The file

- **The header comes first.** The first statement must be `dav 1`. Only whitespace and comments may come before it. Without a header, the file reports `missing-header`. The version is compared as written: anything but `1`, `1.0` and `01` included, reports `unsupported-version`.
- **`title` is optional.** It names the diagram. Given more than once, it reports `duplicate-title`, and the last one is used.
- **The other statements can come in any order,** and a reference may come before the declaration it names.

### Identifiers and references

Nodes, groups and the edges that are given an `id` share one namespace, and each identifier can be declared once. Declarations count in the order of the file, whatever their kind, and declaring a taken identifier again reports `duplicate-id`. A node or a group so declared is left out, and the members of a group left out belong to the group around it; an edge so declared is still drawn. An edge written `[id: x]` before `node x` therefore leaves the node out. An edge without an `id` is known by its two ends, and nothing can refer to it.

| What refers | What it may name |
| :--- | :--- |
| Each end of an edge | A node |
| Each end of an `animate` | A node |
| Each name in `focus` | A node or a group |
| The target of `state` | A node, a group, or an edge with an `id` |

A name that is declared as nothing reports `undefined-reference`, and one of another kind reports `reference-kind-mismatch`. An edge with such an end is not drawn, and an `animate` with one moves no packet.

### Attributes

Each attribute has a type:

| Type | Written as |
| :--- | :--- |
| string | A string: `"..."` |
| boolean | `true` or `false` |
| color | A color name, in any case: `red`, `orange`, `yellow`, `green`, `teal`, `blue`, `purple`, `pink`, `gray`. In `state` only, also `none`. A color is drawn in a shade that suits the light or dark theme |
| icon | An icon name, in any case. See [`node`](#node) |
| identifier | An identifier |

Attribute names are lowercase, as the tables give them: `Icon` is an unknown attribute. Color and icon names are written without quotes: `color: "red"` reports `invalid-attribute-value`. No attribute takes a number. An attribute that the statement does not take reports `unknown-attribute` and is ignored. One that it takes, given twice in one block, reports `duplicate-attribute`, and the last one that is not ignored is used. A value of the wrong type, or not one of the allowed names, reports `invalid-attribute-value`, `invalid-color` or `unknown-icon`, and the attribute is ignored. A color or an icon written within two letters of a name, or one letter for a name of three letters or fewer, gets that name as a suggestion; `none` is never suggested, and a hex color gets no suggestion.

### `group`

```dav
group vpc "Production VPC" [color: blue] {
  node alb "Application LB" [icon: lb]
  group private "Private subnet" {
    node api "Order API" [icon: api]
  }
}
```

A group is a zone: a frame drawn round its members. It contains only groups and nodes, and groups can nest. A group has no visibility of its own: its frame is drawn in every step, also while every node in it is hidden. Its label is the string after its identifier, or the identifier when there is none; `""` gives an empty label.

| Attribute | Type | Default | Effect |
| :--- | :--- | :--- | :--- |
| `color` | color | none | Color of the zone |

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
| `visible` | boolean | `true` | Whether the node is shown before any `state` changes it |
| `color` | color | none | Color of the ring, the icon and the badge |

The 42 icons:

- **Infrastructure and logic (28):** `server`, `container`, `function`, `runtime`, `database`, `cache`, `queue`, `storage`, `lb`, `firewall`, `cdn`, `cloud`, `building`, `router`, `hub`, `wifi`, `external`, `auth`, `ai`, `api`, `mail`, `monitor`, `schedule`, `search`, `logic`, `webhook`, `payment`, `key`
- **Screens, actors and documents (14):** `screen`, `modal`, `browser`, `desktop`, `mobile`, `terminal`, `device`, `printer`, `chat`, `sheet`, `file`, `user`, `users`, `bot`

### Edges

```dav
api --> db_pri : "Read / Write"
db_pri ..> db_sby : "Sync Replication"
user <-> apigw : "HTTPS"
api ..> db_sby : "Failover Route" [id: e_failover, visible: false, color: yellow]
```

An edge joins two nodes. Its arrow sets its line and its arrowheads:

| Arrow | Line | Arrowheads |
| :--- | :--- | :--- |
| `-->` | Solid | At the second node |
| `..>` | Dashed | At the second node |
| `<->` | Solid | At both nodes |
| `<.>` | Dashed | At both nodes |

| Attribute | Type | Default | Effect |
| :--- | :--- | :--- | :--- |
| `id` | identifier | none | A name for the edge, which `state` needs to refer to it |
| `visible` | boolean | `true` | Whether the edge is shown before any `state` changes it |
| `color` | color | none | Color of the line |

- **The label** after `:` is drawn on the line.
- **A self-loop** joins a node to itself, `a --> a`, and is drawn as a loop at the top right of the node. It takes only a one-way arrow, `-->` or `..>`: a two-way arrow reports `invalid-self-arrow`.
- **Two edges between the same nodes in the same direction** need an `id` on all but one. A second edge from `a` to `b` without an `id` reports `duplicate-edge`, whatever the line of either, and is still drawn. An edge from `b` to `a` is another pair, and a two-way edge counts in the direction it is written: `a <-> b` and `a --> b` are a duplicate, `b <-> a` and `a --> b` are not.

### `step`

```dav
step "Primary database fails over" {
  desc "The primary fails, so the standby is promoted and traffic moves to it."
  focus api, db_pri, db_sby
  state db_pri [badge: "DOWN"]
  state db_sby [badge: "PROMOTED"]
  state e_failover [visible: true]
  animate api --> db_sby : "Reconnect" [icon: key, color: yellow, desc: "The endpoint now points at the promoted standby"]
}
```

The steps play in the order they are written, numbered from 1. The viewer opens on step 1 without playing it: its first phase repeats until the steps are played. Before step 1 comes the overview: the diagram as declared, with nothing dimmed and nothing moving. A file without steps shows the overview only.

A step's string is its title. Its `desc` statements are its description, joined with line breaks when there are several. The viewer's playback bar shows two lines of it, and the whole text on hover; an exported picture shows two lines, the lines after the second running on at the end of it. `desc`, `focus` and `animate` last for their step only; `state` lasts.

#### `state`

`state` changes a node, a group or an edge with an `id`, from the start of its step and in every later step.

| Attribute | Type | On a node | On a group | On an edge |
| :--- | :--- | :--- | :--- | :--- |
| `badge` | string | The badge. `""` removes it, the declared badge included | Not applicable | Not applicable |
| `visible` | boolean | Shows or hides the node | Not applicable | Shows or hides the edge |
| `color` | color, or `none` | The color. `none` returns to the declared color | The color. `none` returns to the declared color | The color. `none` returns to the declared color |

- **States accumulate.** To show step *k*, the `state` statements of steps 1 to *k* apply in the order they are written. For each target and attribute, the last value given wins.
- **A state shows from the start of its step,** before the first packet of that step moves. A status that a packet brings about is therefore set in the next step.
- An attribute that does not apply to its kind of target reports `attribute-not-applicable` and changes nothing on the target, though `visible: false` still keeps the `state` from emphasizing it, as below. An empty block, `state a []`, reports `empty-state`.

#### What a step shows

A step emphasizes the nodes and groups named in its `focus`, the targets of its `state` statements, both nodes of an edge whose state it sets, and both nodes of each `animate`. A `state` with `visible: false` emphasizes nothing.

- **When a step emphasizes anything, the rest is dimmed.** A node is dimmed unless it, or a group around it, is emphasized. A group is dimmed unless it, a group around it, or something inside it is emphasized.
- **Such a step draws only the edges it is about:** the edges its packets run on, the edges its `state` statements target, and the edges whose two nodes are both undimmed. A step that emphasizes nothing dims nothing and draws every edge that is shown.
- **A node is shown** when it is visible, as declared or as a `state` set it, and also, in its step only, when a packet of that step starts or ends at it.
- **An edge is shown** when it is visible, or when a packet of the step runs on it, and only while both of its nodes are shown.

#### `animate`

`animate` moves a packet from its first node to its second, along an edge where there is one.

| Arrow | The packet |
| :--- | :--- |
| `-->` | Goes from the first node to the second |
| `<->` | Goes to the second node, rests there a moment, and comes back: about twice as long as a one-way packet on the same way |
| `..>`, `<.>` | Not allowed: `invalid-animate-arrow` |

| Attribute | Type | Default | Effect |
| :--- | :--- | :--- | :--- |
| `icon` | icon | none | Draws the packet as a chip that shows what it carries, instead of a dot |
| `color` | color | the accent color | Color of the packet and of the line it runs on |
| `parallel` | boolean | `false` | Plays in the same phase as the `animate` before it |
| `desc` | string | none | Text of the packet's callout |
| `code` | string | none | A code snippet in the callout. See [`code`](#code) |

- **The label** after `:` names what the packet carries, and is shown with it.
- **The packet follows an edge** between its two nodes, solid or dashed alike: one from its first node to its second, or a two-way edge written either way round. A one-way edge written the other way round is not followed. Of several such edges, it takes the first declared of those visible at that step, as declared or as its states set them, or the first declared when none is. With no such edge, it travels between the two nodes on a way of its own, along which no line is drawn; `dav check --detail` reports it as `animate-without-edge` in a file without errors and warnings.
- **On a self-loop,** `animate a --> a` goes round the loop once. A two-way arrow on a self-loop reports `invalid-self-arrow`.
- **Phases.** The `animate` statements of a step play one after another, each in a phase of its own. `parallel: true` puts an `animate` in the phase of the one before it, so that they leave together; on the first `animate` of a step it has no effect. A packet takes longer the longer its way on screen is and the more packets share its phase, and a phase lasts until its last packet arrives, with a short pause after it. A packet, its callout and the color it gives its line last for its phase; when packets of one phase run on the same edge, the line takes the color of the first. When a step has more than one phase, each packet is numbered by its phase, with a letter for each of several in one phase: `1`, `2a`, `2b`. The number shows on its callout and at a stop halfway along its way.
- **Still pictures.** Where nothing moves, in a still export of a step or in the viewer with motion stopped, no packet and no callout is drawn: the lines the step's packets run on are lit, each in the color of the first packet on it. In a stopped viewer, picking a node shows, stopped on their way and with their callouts, the packets of a phase in which it sends a packet, or, if it sends none, in which it receives one: the first such phase, or, while one of them is shown after a pick, however it was picked, the next one, and after the last one the still picture again. A reader who asks for reduced motion gets a viewer that is always stopped.
- **Its description** is the `desc` attribute followed by the `desc` statements of its body, joined with line breaks. In a description, the whitespace at the start and the end of each line is dropped, so it cannot be indented, and whitespace in a row shows as one space, though the viewer's playback bar counts only spaces and tabs as whitespace here; a packet's callout, and a step's description in an exported picture, leave out empty lines. A packet's callout shows up to four lines; the lines after the fourth run on at the end of it. A packet with no label, `desc` or `code` has no callout.

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

- **The language** is any identifier, or `dav`. It names the code above it; every language is colored alike.
- **The text is drawn tidied,** whatever its form: line breaks, a `\r` on its own included, become `\n`, each tab becomes two spaces, whitespace at the end of a line is removed, the blank lines at the start and at the end are removed, and so is the indentation that all its lines that are not blank share, counted in spaces. Otherwise, the text of a code fence is taken as written, and that of a string with its escapes, `\n` for a line break.
- **Empty code,** of whitespace only, draws no frame.
- **One per `animate`.** The attribute and each `code` statement count; two `code` attributes in one block are a `duplicate-attribute` instead. Each one after the first reports `duplicate-code`, and the last one that is not empty is used.

## Formatting

The formatter writes a file in its canonical form, without changing what it means. VS Code formats a `.dav` file on request, and `dav format` and `dav check --write` do the same.

- One space between tokens: `a --> b : "Label" [key: value, key: value]`, and no comma after the last attribute.
- Two spaces of indentation for each level of `{ }`. An empty `group` or `step` body is written `{}`, and an empty `animate` body is dropped.
- Comments are kept. A comment after a statement stays on its line; one after a `{` goes to the next line. Two blank lines or more become one, and the blank lines at the start and the end of the file and of a block are removed.
- A file with any `\r\n` line ending gets `\r\n` on every line; any other file gets `\n`. The file ends with one line ending, and a file of whitespace only becomes empty.
- The text of a code fence is tidied: a `\r` on its own becomes a line break, tabs become two spaces, and whitespace at the end of a line and the indentation that all its lines that are not blank share, counted in spaces, are removed. It goes on lines of its own, two spaces deeper than its `code`, with the closing backticks on a line of their own, so a one-line fence with one line of code in it becomes three lines. A `code` string stays on one line.
- A statement with a comment among its own words is kept as written, but indented to its depth and without spaces at the ends of its lines. For a `group`, a `step` or an `animate`, a comment before its `{` keeps its body as written too, and the lines of a code fence in it keep their own indentation. A `code` statement with a comment among its words is kept as written up to its code fence, which is laid out as above. A file with a `syntax-error`, an `unexpected-eof`, or a string that runs over a line break is not changed.

## Diagnostics

A diagnostic does not stop the rest of the file from being read, and the table says what becomes of what is in error where it matters. After a `syntax-error`, the diagnostics that follow it can come from it: fix the first one, and read the file again. A file with an error is not valid, and how it is drawn is not defined beyond that; `dav export` exports nothing from it.

| Code | Severity | Reported when |
| :--- | :--- | :--- |
| `missing-header` | Error | The file does not start with `dav`. A `dav` without a number, such as `dav "1"`, is a `syntax-error` instead |
| `unsupported-version` | Error | The version is not written `1`, such as `1.0` or `2` |
| `duplicate-title` | Warning | `title` appears more than once. The last one is used |
| `duplicate-id` | Error | An identifier is declared more than once. A node or a group declared later is left out; an edge is still drawn |
| `duplicate-edge` | Error | A second edge joins the same nodes in the same direction without an `id`. It is still drawn |
| `undefined-reference` | Error | An edge, `focus`, `state` or `animate` names an identifier that is not declared |
| `reference-kind-mismatch` | Error | A name is of the wrong kind, such as a group as the end of an edge or of an `animate` |
| `unknown-attribute` | Warning | The statement does not take the attribute. It is ignored |
| `duplicate-attribute` | Warning | An attribute that the statement takes appears twice in one block. The last one that is not ignored is used |
| `duplicate-code` | Warning | An `animate` has more than one `code`. The last one that is not empty is used |
| `invalid-attribute-value` | Error | The value has the wrong type. The attribute is ignored |
| `attribute-not-applicable` | Warning | A `state` attribute does not apply to its kind of target. It changes nothing on the target, though `visible: false` still keeps the `state` from emphasizing it |
| `empty-state` | Warning | A `state` has an empty attribute block |
| `unknown-icon` | Error | The icon is not one of the 42. A name within reach is suggested, as [Attributes](#attributes) says |
| `invalid-color` | Error | The color is not one of the nine names, or `none` outside `state`, or a hex color. A name within reach is suggested, as [Attributes](#attributes) says |
| `invalid-animate-arrow` | Error | `animate` uses a dashed arrow |
| `invalid-self-arrow` | Error | An edge from a node to itself uses `<->` or `<.>`, or an `animate` from a node to itself uses `<->` |
| `invalid-escape` | Error | A string contains an escape other than `\"`, `\\`, `\n` and `\t` |
| `unexpected-eof` | Error | The file ends before a statement or a `{ }` or `[ ]` block is complete, outside a string and a code fence, and no `syntax-error` came before |
| `syntax-error` | Error | Anything else the grammar does not allow, such as a string or a code fence that the file ends inside. For a `code` string given a title on the same line, the message says that only a code fence takes one |

## Compatibility

The language version follows the major version of the extension: the language of every `1.x.x` release is `dav 1`. It has been frozen since extension `1.0.0`, and a `1.x.x` release changes it only if existing files keep their meaning:

| Change | Allowed in `dav 1` | Reason |
| :--- | :--- | :--- |
| New optional attributes or syntax | Yes | Existing files mean the same |
| New values for an attribute, such as icons | Yes | Existing files mean the same |
| New warnings | Yes | Files still load |
| Changes to the layout rules | Yes | Layout is not part of the specification. Only determinism is guaranteed |
| Bug fixes that match this specification, and diagnostic wording | Yes | The specification does not change |
| New keywords | No | Files that use the word as an identifier would stop loading |
| Rejecting syntax that was accepted | No | Existing files would stop loading |
| Changing a default or the meaning of an attribute or arrow | No | Existing files would silently render differently |

A change in the last group is made only when there is no way to stay compatible with `dav 1`. It needs a new major release of the extension, `n.0.0`, and the language that release introduces is `dav n`. The extension will keep reading `dav 1` files, and old syntax will get migration diagnostics and Quick Fixes. A major release that leaves the language as it is keeps the `dav` version it has.

The format of data embedded in exported HTML (`EXPORT_FORMAT_VERSION`) is versioned separately.
