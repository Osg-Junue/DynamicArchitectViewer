# Readability and layout principles (`dav 2`)

## What constitutes a readable diagram in DynamicArchitectViewer

In `dav 1`, diagram quality was measured almost exclusively by static geometric graph metrics: minimizing total edge crossings, rail bends, and link lengths in the overview. Optimizing those metrics in isolation distorted architectural layers—pulling data stores or monitoring hubs into the middle of application flows and forcing authors to learn layout workarounds.

In `dav 2`, readability is defined by four criteria in strict priority order. Lower-priority aesthetics may not override higher-priority structure.

### 1. Mental model fidelity (Backbone direction & layer separation) — Highest priority
- **Forward backbone flows left to right:** The primary sequence of steps (first-seen forward transitions across normal operation) reads left to right.
- **Returns do not break the backbone:** Responses, retries, error rollbacks, and alert feedback paths point back toward upstream nodes they already passed through. Going right-to-left on a return path is natural and expected; it is never penalized as a layout flaw.
- **No layer intrusion:** Groups (`group`) representing distinct architectural layers or domains keep their spatial separation (for example: edge/clients → application mesh → external, with shared data/platform zones separated into clean upper/lower bands rather than wedged between upstream and midstream layers).

### 2. Primary vs secondary separation (Hierarchy)
- **Backbone shapes the map; background follows it:** Moving flows (`animate`) along the main progression determine the structural columns and zone order. Non-moving relationships (`static`, such as monitoring, logging, or standby replication) and cross-cutting hubs attach to that map rather than distorting the main flow into a tangled cluster.
- **Overview visual restraint:** Bidirectional traffic collapses onto one rail, dashed/static-only connections stay visually subordinate to primary solid flows, and overview rails carry no text labels.

### 3. Spatial-temporal continuity (Step playability)
- **Smooth eye tracking during playback:** Consecutive `animate` phases within a step follow a coherent path on the map without erratic cross-canvas jumps or meaningless zigzags.
- **Fixed stage across steps:** Nodes and groups never move between steps, so the reader's mental map holds steady as focus shifts from step to step.
- **Clear step overlays:** Packet labels, stop badges, and callouts (`desc`, `code`) remain legible without occluding focused nodes or neighboring labels.

### 4. Local legibility (Within the constraints of 1–3)
- **Zero unreadable text:** No truncated labels (`text-cut`) or overlapping labels/rails.
- **Distinguishable rails:** Parallel rails do not collapse onto a single indistinguishable stroke.
- **Bounded crossings and bends:** Within a zone or between adjacent layers—once backbone direction and zone order are respected—node ordering and routing minimize unnecessary crossings, short jogs, and multi-bend detours. Crossings caused by cross-cutting `static` links or upstream return paths crossing the backbone are accepted when preserving architectural clarity.

---

## Implications for the v2 layout & quality pipeline

### Quality evaluation (replacing v1 `quality.ts`)
Evaluations must distinguish **semantic flow** from **geometric noise**:
1. **Forward flow rightward rate:** Share of forward backbone transitions (first-visit progression in `step` order, excluding return/reply/feedback edges and `static` links) whose target lies to the right of its source.
2. **Layer order & non-intrusion:** Consistency between zone placement and structural progression (`group` declaration order as tiebreaker, cross-cutting zones separated into bands).
3. **Step trajectory smoothness:** Path continuity across consecutive phases in each step and absence of callout/label collisions during step playback.
4. **Local overview geometry:** Crossings/bends among forward primary rails, rail overlap/merging integrity, text truncation, and canvas aspect ratio.

### Three-stage layout approach
1. **Extract flow roles from `step`s (no author tricks required):**
   - Walk `step`s and `animate` phases in order to identify the forward DAG backbone (first-arrival edges) vs return/cycle edges (edges targeting already-visited upstream nodes) vs `static` / cross-cutting connections.
   - Ignore `static` connections and return edges when assigning primary horizontal ranks so monitoring, logging, and replies never invert the architecture.
2. **Macro zone placement (band-aware, structure-preserving):**
   - Place top-level zones along the primary left-to-right flow and separate cross-cutting / data / external zones into clean upper/lower/trailing bands (as exemplified by `examples/04-enterprise-zero-trust-payment.dav`) rather than unconstrained link-length annealing.
   - Respect `group` declaration order whenever flow constraints leave ties.
3. **Micro ordering & routing:**
   - Reorder nodes within each column/zone and route rails to reduce local crossings, jogs, and shared-port tangles without breaking macro zone placement or backbone direction.
