import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  addEdge,
  addGroup,
  addNode,
  applyChanges,
  removeElement,
  setPlacement,
  type TextChange,
} from '../../dsl';
import type { Layout, Rect } from '../../layout';
import { implicitEdgeId, type Point } from '../../model/types';
import { Player, type PlayerData } from '../../runtime/player';
import { resolveView } from '../../scene';
import type { PushOptions } from '../history';
import { CanvasOverlay, type ConnectionDraft, type ResizeHandleDir } from './CanvasOverlay';
import { computeSnap, type SnapGuide, snapScalar } from './snap';

export interface CanvasPaneProps {
  dsl: string;
  data: PlayerData;
  locale: 'ja' | 'en';
  selectedIds: ReadonlySet<string>;
  cursorElementId: string | null;
  activeStepIndex: number | null;
  onSelectIds: (ids: Set<string>) => void;
  onActiveStepChange: (stepIndex: number | null) => void;
  onApplyDsl: (nextDsl: string, options?: PushOptions) => void;
  onJumpToElement: (id: string) => void;
}

const LABELS = {
  ja: {
    addNode: '+ ノード',
    addGroup: '+ グループ',
    connect: '接続作成',
    snap: 'スナップ',
    autoLayout: '自動配置に戻す',
    jumpCode: 'コードへ移動',
    deleteSelected: '削除',
  },
  en: {
    addNode: '+ Node',
    addGroup: '+ Group',
    connect: 'Connect',
    snap: 'Snap',
    autoLayout: 'Auto Layout',
    jumpCode: 'Jump to Code',
    deleteSelected: 'Delete',
  },
} as const;

export function CanvasPane({
  dsl,
  data,
  locale,
  selectedIds,
  cursorElementId,
  activeStepIndex,
  onSelectIds,
  onActiveStepChange,
  onApplyDsl,
  onJumpToElement,
}: CanvasPaneProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<Player | null>(null);
  const [worldEl, setWorldEl] = useState<SVGGElement | null>(null);

  const [connectMode, setConnectMode] = useState(false);
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [snapGuides, setSnapGuides] = useState<readonly SnapGuide[]>([]);
  const [marquee, setMarquee] = useState<Rect | null>(null);
  const [connectionDraft, setConnectionDraft] = useState<ConnectionDraft | null>(null);

  const t = LABELS[locale];
  const sessionCounterRef = useRef(0);

  // Latest props ref for DOM event listeners attached to the player SVG
  const stateRef = useRef({
    dsl,
    data,
    selectedIds,
    connectMode,
    snapEnabled,
    onSelectIds,
    onApplyDsl,
    onJumpToElement,
  });
  stateRef.current = {
    dsl,
    data,
    selectedIds,
    connectMode,
    snapEnabled,
    onSelectIds,
    onApplyDsl,
    onJumpToElement,
  };

  const stepChangeRef = useRef(onActiveStepChange);
  stepChangeRef.current = onActiveStepChange;

  // Mount shared Player instance
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const player = new Player(host, stateRef.current.data, {
      locale,
      onStepChange: (idx) => stepChangeRef.current(idx),
    });
    playerRef.current = player;
    setWorldEl(player.getWorldElement());

    return () => {
      player.destroy();
      playerRef.current = null;
      setWorldEl(null);
    };
  }, [locale]);

  // Keep player data synced
  useEffect(() => {
    playerRef.current?.update(data);
  }, [data]);

  // Keep player step index synced when changed from outside (e.g. cursor in step block or StepInspector)
  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;
    if (player.getStepIndex() !== activeStepIndex) {
      player.goTo(activeStepIndex);
    }
  }, [activeStepIndex]);

  // Resolved view for the React overlay
  const resolvedView = useMemo(
    () => resolveView(data.document, data.layout, activeStepIndex),
    [data.document, data.layout, activeStepIndex],
  );

  // Bind interactive authoring gestures on the SVG element
  useEffect(() => {
    const player = playerRef.current;
    if (!player || !worldEl) return;
    const svg = player.getSvgElement();

    type Gesture =
      | {
          kind: 'move';
          pointerId: number;
          sessionKey: string;
          startWorld: Point;
          primaryId: string;
          initialRects: Map<string, Rect>;
          otherRects: Rect[];
          moved: boolean;
          toggleOnClickId: string | null;
        }
      | {
          kind: 'resize';
          pointerId: number;
          sessionKey: string;
          handle: ResizeHandleDir;
          targetId: string;
          startWorld: Point;
          initialRect: Rect;
        }
      | {
          kind: 'connect';
          pointerId: number;
          fromId: string;
          fromPoint: Point;
        }
      | {
          kind: 'marquee';
          pointerId: number;
          startWorld: Point;
          additive: boolean;
        };

    let gesture: Gesture | null = null;

    const findElementAttr = (
      target: EventTarget | null,
      selector: string,
      attr: string,
    ): string | null => {
      if (!(target instanceof Element)) return null;
      const el = target.closest(selector);
      return el ? el.getAttribute(attr) : null;
    };

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      const { data: curData, selectedIds: curSel, connectMode: isConnect } = stateRef.current;
      const worldPt = player.clientToWorld(e.clientX, e.clientY);

      // 1. Resize handle
      const resizeDir = findElementAttr(
        e.target,
        '[data-resize-handle]',
        'data-resize-handle',
      ) as ResizeHandleDir | null;
      const resizeTarget = findElementAttr(e.target, '[data-resize-handle]', 'data-target-id');
      if (resizeDir && resizeTarget) {
        const rect = getRectOf(curData.layout, resizeTarget);
        if (rect) {
          e.preventDefault();
          e.stopPropagation();
          svg.setPointerCapture(e.pointerId);
          sessionCounterRef.current++;
          gesture = {
            kind: 'resize',
            pointerId: e.pointerId,
            sessionKey: `resize-${sessionCounterRef.current}`,
            handle: resizeDir,
            targetId: resizeTarget,
            startWorld: worldPt,
            initialRect: rect,
          };
          return;
        }
      }

      // 2. Connection port handle
      const portNodeId = findElementAttr(e.target, '[data-port-node]', 'data-port-node');
      if (portNodeId) {
        const rect = curData.layout.nodes[portNodeId];
        if (rect) {
          e.preventDefault();
          e.stopPropagation();
          svg.setPointerCapture(e.pointerId);
          const fromPoint = { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
          gesture = {
            kind: 'connect',
            pointerId: e.pointerId,
            fromId: portNodeId,
            fromPoint,
          };
          setConnectionDraft({
            fromId: portNodeId,
            fromPoint,
            toPoint: worldPt,
            targetId: null,
          });
          return;
        }
      }

      // 3. Node or Group
      const nodeId = findElementAttr(e.target, '.dav-node[data-id]', 'data-id');
      const groupId = !nodeId ? findElementAttr(e.target, '.dav-group[data-id]', 'data-id') : null;
      const hitId = nodeId ?? groupId;

      if (hitId) {
        e.preventDefault();
        e.stopPropagation();
        svg.setPointerCapture(e.pointerId);

        // If Connect tool is active and a node was clicked, start connection drag
        if (isConnect && nodeId) {
          const rect = curData.layout.nodes[nodeId];
          if (rect) {
            const fromPoint = { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
            gesture = {
              kind: 'connect',
              pointerId: e.pointerId,
              fromId: nodeId,
              fromPoint,
            };
            setConnectionDraft({
              fromId: nodeId,
              fromPoint,
              toPoint: worldPt,
              targetId: null,
            });
            return;
          }
        }

        let nextSel: Set<string>;
        let toggleOnClickId: string | null = null;
        if (e.shiftKey) {
          nextSel = new Set(curSel);
          if (nextSel.has(hitId)) {
            toggleOnClickId = hitId;
          } else {
            nextSel.add(hitId);
            stateRef.current.onSelectIds(nextSel);
          }
        } else if (curSel.has(hitId)) {
          nextSel = new Set(curSel);
        } else {
          nextSel = new Set([hitId]);
          stateRef.current.onSelectIds(nextSel);
        }

        // Collect all moving items (selected nodes/groups + descendants of selected groups)
        const movingIds = collectMovingIds(curData, nextSel);
        const initialRects = new Map<string, Rect>();
        for (const id of movingIds) {
          const r = getRectOf(curData.layout, id);
          if (r) initialRects.set(id, { ...r });
        }

        const otherRects: Rect[] = [];
        for (const [id, r] of Object.entries(curData.layout.nodes)) {
          if (!movingIds.has(id)) otherRects.push(r);
        }
        for (const [id, r] of Object.entries(curData.layout.groups)) {
          if (!movingIds.has(id)) otherRects.push(r);
        }

        sessionCounterRef.current++;
        gesture = {
          kind: 'move',
          pointerId: e.pointerId,
          sessionKey: `move-${sessionCounterRef.current}`,
          startWorld: worldPt,
          primaryId: hitId,
          initialRects,
          otherRects,
          moved: false,
          toggleOnClickId,
        };
        return;
      }

      // 4. Edge
      const edgeId = findElementAttr(e.target, '.dav-edge[data-id]', 'data-id');
      if (edgeId) {
        e.preventDefault();
        e.stopPropagation();
        const nextSel = new Set(e.shiftKey ? curSel : []);
        if (nextSel.has(edgeId)) nextSel.delete(edgeId);
        else nextSel.add(edgeId);
        stateRef.current.onSelectIds(nextSel);
        return;
      }

      // 5. Empty canvas: Shift + Drag starts marquee selection
      if (e.shiftKey) {
        e.preventDefault();
        e.stopPropagation();
        svg.setPointerCapture(e.pointerId);
        gesture = {
          kind: 'marquee',
          pointerId: e.pointerId,
          startWorld: worldPt,
          additive: true,
        };
        setMarquee({ x: worldPt.x, y: worldPt.y, width: 0, height: 0 });
        return;
      }

      // Normal click on empty background clears selection
      if (curSel.size > 0) {
        stateRef.current.onSelectIds(new Set());
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      const worldPt = player.clientToWorld(e.clientX, e.clientY);

      if (!gesture) {
        const overNode = findElementAttr(e.target, '.dav-node[data-id]', 'data-id');
        setHoveredNodeId((prev) => (prev === overNode ? prev : overNode));
        return;
      }
      if (gesture.pointerId !== e.pointerId) return;

      if (gesture.kind === 'move') {
        const rawDx = worldPt.x - gesture.startWorld.x;
        const rawDy = worldPt.y - gesture.startWorld.y;
        if (!gesture.moved && Math.hypot(rawDx, rawDy) < 3) return;
        gesture.moved = true;

        const primaryInit = gesture.initialRects.get(gesture.primaryId);
        if (!primaryInit) return;

        const candidate: Rect = {
          x: primaryInit.x + rawDx,
          y: primaryInit.y + rawDy,
          width: primaryInit.width,
          height: primaryInit.height,
        };
        const snap = computeSnap(candidate, gesture.otherRects, {
          enableGrid: stateRef.current.snapEnabled,
          enableGuides: stateRef.current.snapEnabled,
        });
        setSnapGuides(snap.guides);

        const snappedDx = snap.pos.x - primaryInit.x;
        const snappedDy = snap.pos.y - primaryInit.y;

        let nextDsl = stateRef.current.dsl;
        for (const [id, initRect] of gesture.initialRects) {
          try {
            const changes = setPlacement(nextDsl, id, {
              pos: {
                x: Math.round(initRect.x + snappedDx),
                y: Math.round(initRect.y + snappedDy),
              },
            });
            nextDsl = applyChanges(nextDsl, changes);
          } catch {
            // Ignore elements that cannot be placed
          }
        }
        stateRef.current.onApplyDsl(nextDsl, {
          coalesceKey: gesture.sessionKey,
          forceCoalesce: true,
        });
        return;
      }

      if (gesture.kind === 'resize') {
        const dx = worldPt.x - gesture.startWorld.x;
        const dy = worldPt.y - gesture.startWorld.y;
        const nextRect = computeResizedRect(
          gesture.initialRect,
          gesture.handle,
          dx,
          dy,
          stateRef.current.snapEnabled,
        );
        try {
          const changes = setPlacement(stateRef.current.dsl, gesture.targetId, {
            pos: { x: nextRect.x, y: nextRect.y },
            size: { width: nextRect.width, height: nextRect.height },
          });
          const nextDsl = applyChanges(stateRef.current.dsl, changes);
          stateRef.current.onApplyDsl(nextDsl, {
            coalesceKey: gesture.sessionKey,
            forceCoalesce: true,
          });
        } catch {
          // Ignore invalid resize
        }
        return;
      }

      if (gesture.kind === 'connect') {
        const hitTarget = findNodeAtPoint(stateRef.current.data.layout, worldPt, gesture.fromId);
        setConnectionDraft({
          fromId: gesture.fromId,
          fromPoint: gesture.fromPoint,
          toPoint: worldPt,
          targetId: hitTarget,
        });
        return;
      }

      if (gesture.kind === 'marquee') {
        const x = Math.min(gesture.startWorld.x, worldPt.x);
        const y = Math.min(gesture.startWorld.y, worldPt.y);
        const width = Math.abs(worldPt.x - gesture.startWorld.x);
        const height = Math.abs(worldPt.y - gesture.startWorld.y);
        setMarquee({ x, y, width, height });
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      if (!gesture || gesture.pointerId !== e.pointerId) return;
      const finished = gesture;
      gesture = null;
      setSnapGuides([]);

      if (finished.kind === 'move' && !finished.moved && finished.toggleOnClickId) {
        const nextSel = new Set(stateRef.current.selectedIds);
        nextSel.delete(finished.toggleOnClickId);
        stateRef.current.onSelectIds(nextSel);
      }

      if (finished.kind === 'connect') {
        const worldPt = player.clientToWorld(e.clientX, e.clientY);
        const targetId = findNodeAtPoint(stateRef.current.data.layout, worldPt, finished.fromId);
        setConnectionDraft(null);
        if (targetId && targetId !== finished.fromId) {
          try {
            const changes = addEdge(stateRef.current.dsl, {
              from: finished.fromId,
              to: targetId,
            });
            const nextDsl = applyChanges(stateRef.current.dsl, changes);
            stateRef.current.onApplyDsl(nextDsl);
            stateRef.current.onSelectIds(new Set([implicitEdgeId(finished.fromId, targetId)]));
            setConnectMode(false);
          } catch {
            // Ignore duplicate or invalid edge
          }
        }
      }

      if (finished.kind === 'marquee') {
        const worldPt = player.clientToWorld(e.clientX, e.clientY);
        const box: Rect = {
          x: Math.min(finished.startWorld.x, worldPt.x),
          y: Math.min(finished.startWorld.y, worldPt.y),
          width: Math.abs(worldPt.x - finished.startWorld.x),
          height: Math.abs(worldPt.y - finished.startWorld.y),
        };
        setMarquee(null);
        if (box.width > 4 || box.height > 4) {
          const hits = new Set<string>(finished.additive ? stateRef.current.selectedIds : []);
          for (const [id, r] of Object.entries(stateRef.current.data.layout.nodes)) {
            if (rectsOverlap(box, r)) hits.add(id);
          }
          for (const [id, r] of Object.entries(stateRef.current.data.layout.groups)) {
            if (rectsOverlap(box, r)) hits.add(id);
          }
          stateRef.current.onSelectIds(hits);
        }
      }
    };

    const onDoubleClick = (e: MouseEvent) => {
      const id =
        findElementAttr(e.target, '.dav-node[data-id]', 'data-id') ??
        findElementAttr(e.target, '.dav-group[data-id]', 'data-id') ??
        findElementAttr(e.target, '.dav-edge[data-id]', 'data-id');
      if (id) {
        e.preventDefault();
        stateRef.current.onJumpToElement(id);
      }
    };

    svg.addEventListener('pointerdown', onPointerDown, { capture: true });
    svg.addEventListener('pointermove', onPointerMove);
    svg.addEventListener('pointerup', onPointerUp);
    svg.addEventListener('pointercancel', onPointerUp);
    svg.addEventListener('dblclick', onDoubleClick);

    return () => {
      svg.removeEventListener('pointerdown', onPointerDown, { capture: true });
      svg.removeEventListener('pointermove', onPointerMove);
      svg.removeEventListener('pointerup', onPointerUp);
      svg.removeEventListener('pointercancel', onPointerUp);
      svg.removeEventListener('dblclick', onDoubleClick);
    };
  }, [worldEl]);

  const handleAddNode = () => {
    const existingIds = new Set([
      ...data.document.nodes.map((n) => n.id),
      ...data.document.groups.map((g) => g.id),
      ...data.document.steps.flatMap((s) => (s.id ? [s.id] : [])),
    ]);
    let idx = data.document.nodes.length + 1;
    while (existingIds.has(`node_${idx}`)) idx++;
    const id = `node_${idx}`;

    // If a single group is selected, add inside that group
    const singleId = selectedIds.size === 1 ? Array.from(selectedIds)[0] : undefined;
    const parentGroup = singleId ? data.document.groups.find((g) => g.id === singleId) : undefined;

    try {
      const changes = addNode(dsl, {
        id,
        label: `Node ${idx}`,
        attrs: { icon: 'server' },
        ...(parentGroup ? { parentId: parentGroup.id } : {}),
      });
      onApplyDsl(applyChanges(dsl, changes));
      onSelectIds(new Set([id]));
    } catch {
      // Ignore if syntax prevents insertion
    }
  };

  const handleAddGroup = () => {
    const existingIds = new Set([
      ...data.document.nodes.map((n) => n.id),
      ...data.document.groups.map((g) => g.id),
      ...data.document.steps.flatMap((s) => (s.id ? [s.id] : [])),
    ]);
    let idx = data.document.groups.length + 1;
    while (existingIds.has(`group_${idx}`)) idx++;
    const id = `group_${idx}`;

    const singleId = selectedIds.size === 1 ? Array.from(selectedIds)[0] : undefined;
    const parentGroup = singleId ? data.document.groups.find((g) => g.id === singleId) : undefined;

    try {
      const changes = addGroup(dsl, {
        id,
        label: `Group ${idx}`,
        ...(parentGroup ? { parentId: parentGroup.id } : {}),
      });
      onApplyDsl(applyChanges(dsl, changes));
      onSelectIds(new Set([id]));
    } catch {
      // Ignore if syntax prevents insertion
    }
  };

  const handleAutoLayout = () => {
    const targets =
      selectedIds.size > 0
        ? Array.from(selectedIds)
        : [...data.document.nodes.map((n) => n.id), ...data.document.groups.map((g) => g.id)];
    let nextDsl = dsl;
    for (const id of targets) {
      try {
        const changes: TextChange[] = setPlacement(nextDsl, id, { pos: null, size: null });
        nextDsl = applyChanges(nextDsl, changes);
      } catch {
        // Ignore edges
      }
    }
    onApplyDsl(nextDsl);
  };

  const handleDeleteSelected = () => {
    if (selectedIds.size === 0) return;
    let nextDsl = dsl;
    for (const id of selectedIds) {
      try {
        nextDsl = applyChanges(nextDsl, removeElement(nextDsl, id));
      } catch {
        // Already removed with parent group or not found
      }
    }
    onApplyDsl(nextDsl);
    onSelectIds(new Set());
  };

  const singleSelectedId = selectedIds.size === 1 ? (Array.from(selectedIds)[0] ?? null) : null;

  return (
    <div className="canvas-pane-shell">
      <div className="canvas-authoring-bar" role="toolbar" aria-label="Canvas tools">
        <button
          type="button"
          className="tool-btn"
          onClick={handleAddNode}
          data-testid="btn-add-node"
        >
          {t.addNode}
        </button>
        <button
          type="button"
          className="tool-btn"
          onClick={handleAddGroup}
          data-testid="btn-add-group"
        >
          {t.addGroup}
        </button>
        <button
          type="button"
          className={`tool-btn ${connectMode ? 'active' : ''}`}
          aria-pressed={connectMode}
          onClick={() => setConnectMode((v) => !v)}
          data-testid="btn-connect-mode"
        >
          {t.connect}
        </button>
        <button
          type="button"
          className={`tool-btn ${snapEnabled ? 'active' : ''}`}
          aria-pressed={snapEnabled}
          onClick={() => setSnapEnabled((v) => !v)}
          data-testid="btn-snap-toggle"
        >
          {t.snap}
        </button>
        <button
          type="button"
          className="tool-btn"
          onClick={handleAutoLayout}
          data-testid="btn-auto-layout"
        >
          {t.autoLayout}
        </button>
        {singleSelectedId && (
          <button
            type="button"
            className="tool-btn"
            onClick={() => onJumpToElement(singleSelectedId)}
            data-testid="btn-jump-code"
          >
            {t.jumpCode}
          </button>
        )}
        {selectedIds.size > 0 && (
          <button
            type="button"
            className="tool-btn danger"
            onClick={handleDeleteSelected}
            data-testid="btn-delete-selected"
          >
            {t.deleteSelected} ({selectedIds.size})
          </button>
        )}
      </div>
      <div ref={hostRef} className="player-host" />
      {worldEl &&
        createPortal(
          <CanvasOverlay
            view={resolvedView}
            selectedIds={selectedIds}
            cursorElementId={cursorElementId}
            hoveredNodeId={hoveredNodeId}
            snapGuides={snapGuides}
            marquee={marquee}
            connectionDraft={connectionDraft}
          />,
          worldEl,
        )}
    </div>
  );
}

function getRectOf(layout: Layout, id: string): Rect | undefined {
  return layout.nodes[id] ?? layout.groups[id];
}

function collectMovingIds(data: PlayerData, selected: ReadonlySet<string>): Set<string> {
  const out = new Set<string>();
  const { nodes, groups } = data.document;
  for (const id of selected) {
    if (data.layout.nodes[id] || data.layout.groups[id]) out.add(id);
  }
  // Include descendants of any selected group so dragging a group moves its children
  let added = true;
  while (added) {
    added = false;
    for (const g of groups) {
      if (g.parentId && out.has(g.parentId) && !out.has(g.id)) {
        out.add(g.id);
        added = true;
      }
    }
    for (const n of nodes) {
      if (n.parentId && out.has(n.parentId) && !out.has(n.id)) {
        out.add(n.id);
        added = true;
      }
    }
  }
  return out;
}

function computeResizedRect(
  init: Rect,
  handle: ResizeHandleDir,
  dx: number,
  dy: number,
  snap: boolean,
): Rect {
  const minW = 96;
  const minH = 56;
  let { x, y, width, height } = init;

  if (handle.includes('e')) {
    width = Math.max(minW, init.width + dx);
  }
  if (handle.includes('s')) {
    height = Math.max(minH, init.height + dy);
  }
  if (handle.includes('w')) {
    const nextW = Math.max(minW, init.width - dx);
    x = init.x + (init.width - nextW);
    width = nextW;
  }
  if (handle.includes('n')) {
    const nextH = Math.max(minH, init.height - dy);
    y = init.y + (init.height - nextH);
    height = nextH;
  }

  if (snap) {
    x = snapScalar(x);
    y = snapScalar(y);
    width = Math.max(minW, snapScalar(width));
    height = Math.max(minH, snapScalar(height));
  } else {
    x = Math.round(x);
    y = Math.round(y);
    width = Math.round(width);
    height = Math.round(height);
  }
  return { x, y, width, height };
}

function findNodeAtPoint(layout: Layout, pt: Point, excludeId: string): string | null {
  for (const [id, r] of Object.entries(layout.nodes)) {
    if (id === excludeId) continue;
    if (pt.x >= r.x && pt.x <= r.x + r.width && pt.y >= r.y && pt.y <= r.y + r.height) {
      return id;
    }
  }
  return null;
}

function rectsOverlap(a: Rect, b: Rect): boolean {
  return (
    a.x <= b.x + b.width && a.x + a.width >= b.x && a.y <= b.y + b.height && a.y + a.height >= b.y
  );
}
