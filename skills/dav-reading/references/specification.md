# `.dav` language specification (`dav 1`)

The normative definition of the `.dav` language, version 1. For a guided introduction, open the documentation from the preview toolbar in VS Code.

## Design goals

1. **Structure and scenario in one file.** The static diagram (`group`, `node`, edges) and its behavior over time (`step`) are written separately in the same file.
2. **No coordinates.** There is no syntax for positions or sizes. Layout comes from the edges and the group hierarchy. See [How diagrams are laid out](https://github.com/Osg-Junue/DynamicArchitectViewer/blob/HEAD/docs/layout.md).
3. **A small grammar.** One declaration per line, with a syntax that people and AI agents can both write without guessing.
4. **Clean diffs.** The formatter normalizes a file to one text representation.

## Lexical structure

| Element | Definition |
| :--- | :--- |
| Encoding | UTF-8 |
| Line endings | `\n` or `\r\n` |
| Comment | `//` to the end of the line |
| Identifier | `^[a-zA-Z_][a-zA-Z0-9_]*$`, excluding keywords (`code` is contextual, not a keyword) |
| String | Double-quoted. Escapes: `\"`, `\\`, `\n`, `\t` |
| CodeFence | ```` ``` ... ``` ````. Verbatim text up to the closing ```` ``` ````; common leading indentation on multi-line content is stripped |
| Color | `red`, `orange`, `yellow`, `green`, `teal`, `blue`, `purple`, `pink`, `gray`. Case-insensitive. Rendered in a shade that suits the active theme |
| Boolean | `true` or `false` |

## Grammar

```ebnf
Document      ::= Header Statement*
Header        ::= "dav" Number

Statement     ::= TitleStmt | GroupDecl | NodeDecl | EdgeDecl | StepDecl
TitleStmt     ::= "title" String

GroupDecl     ::= "group" Identifier String? AttrBlock? "{" GroupChild* "}"
GroupChild    ::= GroupDecl | NodeDecl

NodeDecl      ::= "node" Identifier String? AttrBlock?

EdgeDecl      ::= Identifier ArrowOp Identifier (":" String)? AttrBlock?
ArrowOp       ::= "-->" | "..>" | "<->" | "<.>"

AnimateArrow  ::= "-->" | "<->"

StepDecl      ::= "step" String "{" StepStmt* "}"
StepStmt      ::= DescStmt | FocusStmt | StateStmt | AnimateStmt
DescStmt      ::= "desc" String
FocusStmt     ::= "focus" Identifier ("," Identifier)*
StateStmt     ::= "state" Identifier AttrBlock
AnimateStmt   ::= "animate" Identifier AnimateArrow Identifier (":" String)? AttrBlock? AnimateBody?
AnimateBody   ::= "{" (DescStmt | CodeStmt)* "}"
CodeStmt      ::= "code" CodeLang? (String CodeFence | CodeFence | String)
CodeLang      ::= Identifier | "dav"

AttrBlock     ::= "[" (Attr ("," Attr)* ","?)? "]"
Attr          ::= (Identifier | "desc") ":" (String | Number | Color | Identifier | Boolean)
```

`code` is a contextual keyword inside `AnimateBody`, not a reserved word: declarations such as `node code` remain valid.

## Semantics

### Header and title

```dav
dav 1
title "Multi-AZ web architecture and database failover"
```

The first statement that is not a comment must be `dav 1`. Without it, the file reports `missing-header`. The version is a whole number: `dav 1.0` and `dav 01` report `unsupported-version`.

### `group`

```dav
group vpc "Production VPC" [color: blue] {
  node alb "Application LB" [icon: lb]
}
```

Groups can nest, and are drawn as a box around their members.

| Attribute | Value | Effect |
| :--- | :--- | :--- |
| `color` | color | Color of the zone |

### `node`

```dav
node db_pri "Primary DB" [icon: database, sub: "Aurora Writer", badge: "WRITER", visible: true, color: green]
```

| Attribute | Value | Default | Effect |
| :--- | :--- | :--- | :--- |
| `icon` | icon name | `server` | Case-insensitive. See the list below |
| `sub` | string | none | Secondary label under the node |
| `badge` | string | none | Badge above the node |
| `visible` | boolean | `true` | Initial visibility |
| `color` | color | none | Color of the ring, icon and badge |

The 42 built-in icons:

- **Infrastructure and logic (28):** `server`, `container`, `function`, `runtime`, `database`, `cache`, `queue`, `storage`, `lb`, `firewall`, `cdn`, `cloud`, `building`, `router`, `hub`, `wifi`, `external`, `auth`, `ai`, `api`, `mail`, `monitor`, `schedule`, `search`, `logic`, `webhook`, `payment`, `key`
- **Screens, actors and documents (14):** `screen`, `modal`, `browser`, `desktop`, `mobile`, `terminal`, `device`, `printer`, `chat`, `sheet`, `file`, `user`, `users`, `bot`

### Edges

```dav
api --> db_pri : "Read / Write"
db_pri ..> db_sby : "Sync Replication"
user <-> apigw : "HTTPS"
api ..> db_sby : "Failover Route" [id: e_failover, visible: false, color: yellow]
```

| Arrow | Line | Direction |
| :--- | :--- | :--- |
| `-->` | Solid | One way |
| `..>` | Dashed | One way |
| `<->` | Solid | Both ways |
| `<.>` | Dashed | Both ways |

| Attribute | Value | Default | Effect |
| :--- | :--- | :--- | :--- |
| `id` | identifier | none | Required for a `state` to refer to the edge |
| `color` | color | none | Color of the line |
| `visible` | boolean | `true` | Initial visibility |

An edge from a node to itself (`a --> a`) draws a loop at the top right of the node. Self-loops cannot use `<->` or `<.>` (`invalid-self-arrow`).

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

A step has effects that **accumulate** and effects that **last for that step only**.

**`state` accumulates.** To show step *k*, the `state` statements of steps 1 to *k* apply in order.

| Target | Attributes |
| :--- | :--- |
| Node | `badge`, `visible`, `color` |
| Group | `color` |
| Edge | `visible`, `color` |

`color: none` removes a color set by an earlier step and returns to the declared color. It is valid only in `state`.

**`focus` and `animate` last for one step.** `focus` accepts nodes and groups, not edges. The targets of `state` and the endpoints of `animate` are emphasized even when `focus` does not list them. There are two refinements: a `state` with `visible: false` does not count, and a `state` on an edge also emphasizes both of its nodes.

While a step emphasizes something, the other nodes and groups are dimmed, and only the edges the step is about are drawn: those an `animate` runs on, those a `state` targets, and those between two emphasized nodes. A step that emphasizes nothing, like the overview, draws every edge.

**`animate` moves a packet between two nodes.**

| Attribute | Value | Default | Effect |
| :--- | :--- | :--- | :--- |
| `icon` | icon name | none | Draws the packet as a chip that shows what it carries, instead of a dot |
| `color` | color | accent color | Color of the packet and of the running rail |
| `parallel` | boolean | `false` | Plays in the same phase as the preceding `animate` |
| `desc` | string | none | Text of the callout. Can also be written as a `{ desc "..." }` block |
| `code` | string | none | Monospace snippet inside the callout, such as `[code: "{ \"status\": 201 }"]`. Usually written as a `{ code ... }` block |

````dav
animate cdn --> api : "POST /orders" [desc: "Order API validates idempotencyKey"] {
  code json "Order Request" ```
    {
      "orderId": "ord_01JCK9X7",
      "amount": 14800
    }
  ```
}
````

Inside `{ ... }`, `code` takes an optional language identifier (`json`, `sql`, `http`, `dav`, etc.), an optional title string (`"Order Request"`), and a ```` ``` ... ``` ```` fence — or a one-line string (`code json "{ \"ok\": true }"` or `code "{ \"ok\": true }"`):

- ```` code json "Title" ``` ... ``` ````
- ```` code json ``` ... ``` ````
- ```` code "Title" ``` ... ``` ````
- ```` code ``` ... ``` ````
- `code json "{ \"ok\": true }"` or `code "{ \"ok\": true }"`

Common leading indentation inside ```` ``` ... ``` ```` is stripped automatically, and the formatter indents fenced lines two spaces inside `code`. The code frame is shown inside the packet's callout on the canvas and in exported SVG/HTML only when non-empty `code` is present (with no copy button), and hidden completely when absent. At most one `code` is allowed per `animate` (`duplicate-code`).

`animate` accepts two arrows: `-->` goes one way and `<->` goes there and back in the time of a one-way trip. The arrow of the edge does not affect the packet. On a self-loop, the packet goes around the loop once.

## Diagnostics

| Code | Severity | Reported when |
| :--- | :--- | :--- |
| `missing-header` | Error | The file does not start with `dav <version>` |
| `unsupported-version` | Error | The version is not `1`, including forms that are not a whole number such as `1.0` |
| `duplicate-title` | Warning | `title` appears more than once |
| `duplicate-id` | Error | An identifier is declared more than once |
| `duplicate-edge` | Error | Several edges join the same pair without an `id` |
| `undefined-reference` | Error | An edge, `focus`, `state` or `animate` refers to an undeclared identifier |
| `reference-kind-mismatch` | Error | A reference has the wrong kind, such as a group as an edge endpoint or in `animate` |
| `unknown-attribute` | Warning | The attribute is not allowed on this statement |
| `duplicate-attribute` | Warning | An attribute appears twice in one block |
| `duplicate-code` | Warning | More than one `code` is given on the same `animate` (the last value wins) |
| `invalid-attribute-value` | Error | The value has the wrong type or is not one of the allowed values |
| `attribute-not-applicable` | Warning | A `state` attribute does not apply to its kind of target |
| `empty-state` | Warning | A `state` has an empty attribute block |
| `unknown-icon` | Error | The icon is not built in. The closest name is suggested |
| `invalid-color` | Error | The color is not one of the named colors, including hex codes. The closest name is suggested for a misspelling |
| `invalid-animate-arrow` | Error | `animate` uses a dashed arrow |
| `invalid-self-arrow` | Error | A self-loop uses a two-way arrow |
| `invalid-escape` | Error | A string contains an undefined escape sequence |
| `unexpected-eof` | Error | A `{ ... }` block is not closed |
| `syntax-error` | Error | Any other syntax error, including an unterminated string |

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
