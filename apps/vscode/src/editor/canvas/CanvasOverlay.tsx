import type { Rect } from '../../layout';
import type { Point } from '../../model/types';
import { type ResolvedView, svgPath } from '../../scene';
import type { SnapGuide } from './snap';

export type ResizeHandleDir = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

export interface ConnectionDraft {
  fromId: string;
  fromPoint: Point;
  toPoint: Point;
  targetId: string | null;
}

export interface CanvasOverlayProps {
  view: ResolvedView;
  selectedIds: ReadonlySet<string>;
  cursorElementId: string | null;
  hoveredNodeId: string | null;
  snapGuides: readonly SnapGuide[];
  marquee: Rect | null;
  connectionDraft: ConnectionDraft | null;
}

const HANDLE_DIRS: readonly ResizeHandleDir[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

function handlePoints(r: Rect): Record<ResizeHandleDir, Point> {
  const cx = r.x + r.width / 2;
  const cy = r.y + r.height / 2;
  const right = r.x + r.width;
  const bottom = r.y + r.height;
  return {
    nw: { x: r.x, y: r.y },
    n: { x: cx, y: r.y },
    ne: { x: right, y: r.y },
    e: { x: right, y: cy },
    se: { x: right, y: bottom },
    s: { x: cx, y: bottom },
    sw: { x: r.x, y: bottom },
    w: { x: r.x, y: cy },
  };
}

function portPoints(r: Rect): Array<{ side: string; point: Point }> {
  const cx = r.x + r.width / 2;
  const cy = r.y + r.height / 2;
  return [
    { side: 'top', point: { x: cx, y: r.y - 6 } },
    { side: 'right', point: { x: r.x + r.width + 6, y: cy } },
    { side: 'bottom', point: { x: cx, y: r.y + r.height + 6 } },
    { side: 'left', point: { x: r.x - 6, y: cy } },
  ];
}

export function CanvasOverlay({
  view,
  selectedIds,
  cursorElementId,
  hoveredNodeId,
  snapGuides,
  marquee,
  connectionDraft,
}: CanvasOverlayProps) {
  const rectById = new Map<string, { rect: Rect; kind: 'node' | 'group' }>();
  for (const g of view.groups) rectById.set(g.id, { rect: g.rect, kind: 'group' });
  for (const n of view.nodes) rectById.set(n.id, { rect: n.rect, kind: 'node' });

  const singleSelectedId = selectedIds.size === 1 ? (Array.from(selectedIds)[0] ?? null) : null;
  const singleRect = singleSelectedId ? (rectById.get(singleSelectedId)?.rect ?? null) : null;

  // Show connection ports on the single selected node or hovered node
  const portNodeId =
    (singleSelectedId && rectById.get(singleSelectedId)?.kind === 'node'
      ? singleSelectedId
      : null) ?? hoveredNodeId;
  const portNodeRect = portNodeId ? (rectById.get(portNodeId)?.rect ?? null) : null;

  const cursorRect =
    cursorElementId && !selectedIds.has(cursorElementId)
      ? (rectById.get(cursorElementId)?.rect ?? null)
      : null;

  return (
    <g className="dav-editor-overlay">
      {/* Code cursor highlight */}
      {cursorRect && (
        <rect
          className="editor-cursor-highlight"
          x={cursorRect.x - 4}
          y={cursorRect.y - 4}
          width={cursorRect.width + 8}
          height={cursorRect.height + 8}
          rx={12}
          fill="none"
          stroke="#38bdf8"
          strokeWidth={1.5}
          strokeDasharray="4 4"
          pointerEvents="none"
        />
      )}

      {/* Selection boxes for nodes and groups */}
      {Array.from(selectedIds).map((id) => {
        const item = rectById.get(id);
        if (!item) return null;
        const { rect } = item;
        return (
          <rect
            key={`sel-${id}`}
            className="editor-selection-box"
            data-selected-id={id}
            x={rect.x - 3}
            y={rect.y - 3}
            width={rect.width + 6}
            height={rect.height + 6}
            rx={12}
            fill="none"
            stroke="#60a5fa"
            strokeWidth={2}
            pointerEvents="none"
          />
        );
      })}

      {/* Selection highlight for selected edges */}
      {view.edges
        .filter((e) => selectedIds.has(e.id))
        .map((e) => (
          <path
            key={`sel-edge-${e.id}`}
            className="editor-selection-edge"
            d={svgPath(e.path)}
            fill="none"
            stroke="#60a5fa"
            strokeWidth={5}
            strokeOpacity={0.45}
            pointerEvents="none"
          />
        ))}

      {/* 8 resize handles when a single node or group is selected */}
      {singleSelectedId &&
        singleRect &&
        HANDLE_DIRS.map((dir) => {
          const p = handlePoints(singleRect)[dir];
          return (
            <rect
              key={`resize-${dir}`}
              className={`editor-resize-handle handle-${dir}`}
              data-resize-handle={dir}
              data-target-id={singleSelectedId}
              x={p.x - 5}
              y={p.y - 5}
              width={10}
              height={10}
              rx={2}
              fill="#0b0f19"
              stroke="#60a5fa"
              strokeWidth={2}
            />
          );
        })}

      {/* 4 connection port handles on the active node */}
      {portNodeId &&
        portNodeRect &&
        portPoints(portNodeRect).map(({ side, point }) => (
          <circle
            key={`port-${portNodeId}-${side}`}
            className="editor-port-handle"
            data-port-node={portNodeId}
            data-port-side={side}
            cx={point.x}
            cy={point.y}
            r={5.5}
            fill="#2563eb"
            stroke="#eff6ff"
            strokeWidth={1.75}
          />
        ))}

      {/* Target highlight during connection drag */}
      {(() => {
        const targetRect = connectionDraft?.targetId
          ? rectById.get(connectionDraft.targetId)?.rect
          : undefined;
        if (!targetRect) return null;
        return (
          <rect
            className="editor-connect-target"
            x={targetRect.x - 4}
            y={targetRect.y - 4}
            width={targetRect.width + 8}
            height={targetRect.height + 8}
            rx={12}
            fill="none"
            stroke="#22c55e"
            strokeWidth={2.5}
            pointerEvents="none"
          />
        );
      })()}

      {/* Live connection draft line */}
      {connectionDraft && (
        <line
          className="editor-connect-preview"
          x1={connectionDraft.fromPoint.x}
          y1={connectionDraft.fromPoint.y}
          x2={connectionDraft.toPoint.x}
          y2={connectionDraft.toPoint.y}
          stroke="#38bdf8"
          strokeWidth={2.25}
          strokeDasharray="6 4"
          markerEnd="url(#dav-arrow-end-active)"
          pointerEvents="none"
        />
      )}

      {/* Smart alignment snap guides */}
      {snapGuides.map((g) =>
        g.axis === 'x' ? (
          <line
            key={`guide-x-${g.position}-${g.from}-${g.to}`}
            className="editor-snap-guide"
            x1={g.position}
            y1={g.from}
            x2={g.position}
            y2={g.to}
            stroke="#f43f5e"
            strokeWidth={1.25}
            strokeDasharray="4 3"
            pointerEvents="none"
          />
        ) : (
          <line
            key={`guide-y-${g.position}-${g.from}-${g.to}`}
            className="editor-snap-guide"
            x1={g.from}
            y1={g.position}
            x2={g.to}
            y2={g.position}
            stroke="#f43f5e"
            strokeWidth={1.25}
            strokeDasharray="4 3"
            pointerEvents="none"
          />
        ),
      )}

      {/* Marquee selection box */}
      {marquee && (
        <rect
          className="editor-marquee"
          x={marquee.x}
          y={marquee.y}
          width={marquee.width}
          height={marquee.height}
          fill="rgba(59, 130, 246, 0.14)"
          stroke="#60a5fa"
          strokeWidth={1.5}
          strokeDasharray="4 3"
          pointerEvents="none"
        />
      )}
    </g>
  );
}
