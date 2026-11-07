import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ICON_META_MAP } from '../core/icons';
import { DiagramGroup, DiagramModel, DiagramNode } from '../core/types';
import {
  getPointOnCubicBezier,
  resolveDiagramStep,
} from '../viewer/stepResolver';

export type SelectedElement =
  | { kind: 'node'; id: string }
  | { kind: 'group'; id: string }
  | { kind: 'edge'; id: string }
  | null;

interface CanvasPaneProps {
  model: DiagramModel;
  activeStepIndex: number | null;
  isPlaying: boolean;
  playbackSpeed: number;
  selected: SelectedElement;
  onSelect: (sel: SelectedElement) => void;
  onMoveNodesAndGroups: (
    nodeUpdates: Array<{ id: string; x: number; y: number }>,
    groupUpdates?: Array<{ id: string; x: number; y: number; width?: number; height?: number }>
  ) => void;
  onCreateEdge: (fromId: string, toId: string) => void;
  onAdvanceStep: () => void;
}

interface DragState {
  type: 'pan' | 'node' | 'group' | 'group-resize' | 'connect';
  startClientX: number;
  startClientY: number;
  initialPanX: number;
  initialPanY: number;
  targetId?: string;
  initialX?: number;
  initialY?: number;
  initialW?: number;
  initialH?: number;
  childInitialPositions?: Array<{ id: string; x: number; y: number }>;
  connectFromNode?: DiagramNode;
  currentMouseSvgX?: number;
  currentMouseSvgY?: number;
}

export const CanvasPane: React.FC<CanvasPaneProps> = ({
  model,
  activeStepIndex,
  isPlaying,
  playbackSpeed,
  selected,
  onSelect,
  onMoveNodesAndGroups,
  onCreateEdge,
  onAdvanceStep,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const [pan, setPan] = useState({ x: 30, y: 20 });
  const [zoom, setZoom] = useState(0.95);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [localNodeOffsets, setLocalNodeOffsets] = useState<Record<string, { x: number; y: number }>>({});
  const [localGroupOffsets, setLocalGroupOffsets] = useState<
    Record<string, { x: number; y: number; width: number; height: number }>
  >({});
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [phaseProgress, setPhaseProgress] = useState(0);

  // Merge live drag overrides into model before resolving step view
  const effectiveModel = useMemo<DiagramModel>(() => {
    if (
      Object.keys(localNodeOffsets).length === 0 &&
      Object.keys(localGroupOffsets).length === 0
    ) {
      return model;
    }
    return {
      ...model,
      nodes: model.nodes.map((n) =>
        localNodeOffsets[n.id]
          ? { ...n, x: localNodeOffsets[n.id].x, y: localNodeOffsets[n.id].y }
          : n
      ),
      groups: model.groups.map((g) =>
        localGroupOffsets[g.id]
          ? {
              ...g,
              x: localGroupOffsets[g.id].x,
              y: localGroupOffsets[g.id].y,
              width: localGroupOffsets[g.id].width,
              height: localGroupOffsets[g.id].height,
            }
          : g
      ),
    };
  }, [model, localNodeOffsets, localGroupOffsets]);

  const resolvedView = useMemo(
    () => resolveDiagramStep(effectiveModel, activeStepIndex),
    [effectiveModel, activeStepIndex]
  );

  // Reset phase progress when step changes
  useEffect(() => {
    setPhaseProgress(0);
  }, [activeStepIndex]);

  // Animation loop for packets along Bezier edges
  useEffect(() => {
    let rafId: number;
    let lastTime = performance.now();

    const tick = (now: number) => {
      const dt = (now - lastTime) / 1000;
      lastTime = now;

      if (resolvedView.totalPhases > 0) {
        setPhaseProgress((prev) => {
          const next = prev + dt * 0.65 * playbackSpeed;
          if (next >= resolvedView.totalPhases + 0.35) {
            if (isPlaying && model.steps.length > 0 && activeStepIndex !== null) {
              // Schedule step advance on next microtask
              queueMicrotask(onAdvanceStep);
              return 0;
            }
            return 0;
          }
          return next;
        });
      }
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [resolvedView.totalPhases, isPlaying, playbackSpeed, model.steps.length, activeStepIndex, onAdvanceStep]);

  const clientToSvgCoords = (clientX: number, clientY: number) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: (clientX - rect.left - pan.x) / zoom,
      y: (clientY - rect.top - pan.y) / zoom,
    };
  };

  const handleFitView = () => {
    if (model.nodes.length === 0 && model.groups.length === 0) return;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const n of model.nodes) {
      minX = Math.min(minX, n.x);
      minY = Math.min(minY, n.y);
      maxX = Math.max(maxX, n.x + n.width);
      maxY = Math.max(maxY, n.y + n.height);
    }
    for (const g of model.groups) {
      minX = Math.min(minX, g.x);
      minY = Math.min(minY, g.y);
      maxX = Math.max(maxX, g.x + g.width);
      maxY = Math.max(maxY, g.y + g.height);
    }

    const cw = containerRef.current?.clientWidth ?? 900;
    const ch = containerRef.current?.clientHeight ?? 600;
    const contentW = Math.max(240, maxX - minX + 120);
    const contentH = Math.max(240, maxY - minY + 120);
    const nextZoom = Math.max(0.35, Math.min(1.2, Math.min(cw / contentW, ch / contentH)));

    setZoom(nextZoom);
    setPan({
      x: Math.round((cw - (maxX - minX) * nextZoom) / 2 - minX * nextZoom),
      y: Math.round((ch - (maxY - minY) * nextZoom) / 2 - minY * nextZoom),
    });
  };

  // Mouse handlers
  const handleCanvasMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    if (e.button !== 0) return;
    onSelect(null);
    setDragState({
      type: 'pan',
      startClientX: e.clientX,
      startClientY: e.clientY,
      initialPanX: pan.x,
      initialPanY: pan.y,
    });
  };

  const handleNodeMouseDown = (e: React.MouseEvent, node: DiagramNode) => {
    e.stopPropagation();
    onSelect({ kind: 'node', id: node.id });
    setDragState({
      type: 'node',
      startClientX: e.clientX,
      startClientY: e.clientY,
      initialPanX: pan.x,
      initialPanY: pan.y,
      targetId: node.id,
      initialX: node.x,
      initialY: node.y,
    });
  };

  const handleGroupMouseDown = (e: React.MouseEvent, group: DiagramGroup) => {
    e.stopPropagation();
    onSelect({ kind: 'group', id: group.id });
    const children = model.nodes
      .filter((n) => n.groupId === group.id)
      .map((n) => ({ id: n.id, x: n.x, y: n.y }));

    setDragState({
      type: 'group',
      startClientX: e.clientX,
      startClientY: e.clientY,
      initialPanX: pan.x,
      initialPanY: pan.y,
      targetId: group.id,
      initialX: group.x,
      initialY: group.y,
      initialW: group.width,
      initialH: group.height,
      childInitialPositions: children,
    });
  };

  const handleGroupResizeMouseDown = (e: React.MouseEvent, group: DiagramGroup) => {
    e.stopPropagation();
    onSelect({ kind: 'group', id: group.id });
    setDragState({
      type: 'group-resize',
      startClientX: e.clientX,
      startClientY: e.clientY,
      initialPanX: pan.x,
      initialPanY: pan.y,
      targetId: group.id,
      initialX: group.x,
      initialY: group.y,
      initialW: group.width,
      initialH: group.height,
    });
  };

  const handleStartConnect = (e: React.MouseEvent, node: DiagramNode) => {
    e.stopPropagation();
    const pt = clientToSvgCoords(e.clientX, e.clientY);
    setDragState({
      type: 'connect',
      startClientX: e.clientX,
      startClientY: e.clientY,
      initialPanX: pan.x,
      initialPanY: pan.y,
      connectFromNode: node,
      currentMouseSvgX: pt.x,
      currentMouseSvgY: pt.y,
    });
  };

  useEffect(() => {
    if (!dragState) return;

    const handleMouseMove = (e: MouseEvent) => {
      const dxScreen = e.clientX - dragState.startClientX;
      const dyScreen = e.clientY - dragState.startClientY;
      const dxSvg = Math.round(dxScreen / zoom);
      const dySvg = Math.round(dyScreen / zoom);

      if (dragState.type === 'pan') {
        setPan({
          x: dragState.initialPanX + dxScreen,
          y: dragState.initialPanY + dyScreen,
        });
      } else if (dragState.type === 'node' && dragState.targetId) {
        const nx = Math.round(((dragState.initialX ?? 0) + dxSvg) / 5) * 5;
        const ny = Math.round(((dragState.initialY ?? 0) + dySvg) / 5) * 5;
        setLocalNodeOffsets({ [dragState.targetId]: { x: nx, y: ny } });
      } else if (dragState.type === 'group' && dragState.targetId) {
        const gx = Math.round(((dragState.initialX ?? 0) + dxSvg) / 5) * 5;
        const gy = Math.round(((dragState.initialY ?? 0) + dySvg) / 5) * 5;
        const actualDx = gx - (dragState.initialX ?? 0);
        const actualDy = gy - (dragState.initialY ?? 0);

        setLocalGroupOffsets({
          [dragState.targetId]: {
            x: gx,
            y: gy,
            width: dragState.initialW ?? 400,
            height: dragState.initialH ?? 260,
          },
        });

        const childNext: Record<string, { x: number; y: number }> = {};
        for (const ch of dragState.childInitialPositions ?? []) {
          childNext[ch.id] = { x: ch.x + actualDx, y: ch.y + actualDy };
        }
        setLocalNodeOffsets(childNext);
      } else if (dragState.type === 'group-resize' && dragState.targetId) {
        const nw = Math.max(160, Math.round(((dragState.initialW ?? 300) + dxSvg) / 10) * 10);
        const nh = Math.max(120, Math.round(((dragState.initialH ?? 200) + dySvg) / 10) * 10);
        setLocalGroupOffsets({
          [dragState.targetId]: {
            x: dragState.initialX ?? 0,
            y: dragState.initialY ?? 0,
            width: nw,
            height: nh,
          },
        });
      } else if (dragState.type === 'connect') {
        const pt = clientToSvgCoords(e.clientX, e.clientY);
        setDragState((prev) =>
          prev ? { ...prev, currentMouseSvgX: pt.x, currentMouseSvgY: pt.y } : null
        );
      }
    };

    const handleMouseUp = () => {
      if (dragState.type === 'node' && dragState.targetId) {
        const offset = localNodeOffsets[dragState.targetId];
        if (offset) {
          onMoveNodesAndGroups([{ id: dragState.targetId, x: offset.x, y: offset.y }]);
        }
      } else if (dragState.type === 'group' && dragState.targetId) {
        const gOff = localGroupOffsets[dragState.targetId];
        if (gOff) {
          const nUpdates = Object.entries(localNodeOffsets).map(([id, pos]) => ({
            id,
            x: pos.x,
            y: pos.y,
          }));
          onMoveNodesAndGroups(nUpdates, [{ id: dragState.targetId, x: gOff.x, y: gOff.y }]);
        }
      } else if (dragState.type === 'group-resize' && dragState.targetId) {
        const gOff = localGroupOffsets[dragState.targetId];
        if (gOff) {
          onMoveNodesAndGroups(
            [],
            [
              {
                id: dragState.targetId,
                x: gOff.x,
                y: gOff.y,
                width: gOff.width,
                height: gOff.height,
              },
            ]
          );
        }
      } else if (dragState.type === 'connect' && dragState.connectFromNode && hoveredNodeId) {
        if (hoveredNodeId !== dragState.connectFromNode.id) {
          onCreateEdge(dragState.connectFromNode.id, hoveredNodeId);
        }
      }

      setLocalNodeOffsets({});
      setLocalGroupOffsets({});
      setDragState(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragState, zoom, localNodeOffsets, localGroupOffsets, hoveredNodeId, onMoveNodesAndGroups, onCreateEdge]);

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.08 : 0.92;
    setZoom((z) => Math.max(0.25, Math.min(2.4, z * factor)));
  };

  // Active phase packets calculation
  const activePhaseIdx =
    resolvedView.totalPhases > 0
      ? Math.min(resolvedView.totalPhases - 1, Math.floor(phaseProgress))
      : -1;
  const localT = Math.min(1, Math.max(0, phaseProgress - activePhaseIdx));
  const activePackets = resolvedView.phases.filter((p) => p.phaseIndex === activePhaseIdx);

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        backgroundColor: '#0b0f19',
        backgroundImage: 'radial-gradient(#1e293b 1px, transparent 1px)',
        backgroundSize: '24px 24px',
      }}
      onWheel={handleWheel}
    >
      {/* Floating Canvas Zoom & View Controls */}
      <div
        style={{
          position: 'absolute',
          top: 12,
          right: 14,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          background: 'rgba(15, 23, 42, 0.9)',
          border: '1px solid #334155',
          borderRadius: 8,
          padding: '4px 8px',
          zIndex: 10,
        }}
      >
        <button
          className="dav-toolbar-btn"
          onClick={() => setZoom((z) => Math.max(0.25, z / 1.15))}
          title="縮小"
        >
          －
        </button>
        <span style={{ fontSize: 11, color: '#94a3b8', minWidth: 42, textAlign: 'center' }}>
          {Math.round(zoom * 100)}%
        </span>
        <button
          className="dav-toolbar-btn"
          onClick={() => setZoom((z) => Math.min(2.4, z * 1.15))}
          title="拡大"
        >
          ＋
        </button>
        <button className="dav-toolbar-btn" onClick={handleFitView} title="画面にフィット">
          Fit
        </button>
      </div>

      {/* Mode Indicator Banner */}
      <div
        style={{
          position: 'absolute',
          top: 12,
          left: 14,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          background: 'rgba(15, 23, 42, 0.88)',
          border: '1px solid #334155',
          borderRadius: 8,
          padding: '5px 12px',
          fontSize: 12,
          color: '#cbd5e1',
          zIndex: 10,
          pointerEvents: 'none',
        }}
      >
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: activeStepIndex === null ? '#94a3b8' : '#3b82f6',
            boxShadow: activeStepIndex === null ? 'none' : '0 0 8px #3b82f6',
          }}
        />
        {activeStepIndex === null || !model.steps[activeStepIndex] ? (
          <span>
            <strong>全体編集ビュー</strong>（ノードをドラッグで移動 / 右端の●ドラッグでエッジ接続）
          </span>
        ) : (
          <span>
            <strong>
              Step {model.steps[activeStepIndex].stepNumber}: {model.steps[activeStepIndex].title}
            </strong>
          </span>
        )}
      </div>

      <svg
        ref={svgRef}
        className="dav-canvas-svg"
        width="100%"
        height="100%"
        onMouseDown={handleCanvasMouseDown}
        style={{ cursor: dragState?.type === 'pan' ? 'grabbing' : 'grab' }}
      >
        <defs>
          <marker
            id="dav-arrow-default"
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 1.5 L 8.5 5 L 0 8.5 z" fill="#64748b" />
          </marker>
          <marker
            id="dav-arrow-active"
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="6.5"
            markerHeight="6.5"
            orient="auto-start-reverse"
          >
            <path d="M 0 1.5 L 8.5 5 L 0 8.5 z" fill="#60a5fa" />
          </marker>
        </defs>

        <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
          {/* 1. Groups Layer */}
          {effectiveModel.groups.map((group) => {
            const isSelected = selected?.kind === 'group' && selected.id === group.id;
            const stroke = isSelected ? '#60a5fa' : group.color || '#334155';
            const headerWidth = Math.min(
              group.width - 24,
              Math.max(96, group.label.length * 9.5 + 28)
            );
            return (
              <g key={group.id} className="dav-group-rect">
                <rect
                  x={group.x}
                  y={group.y}
                  width={group.width}
                  height={group.height}
                  rx={12}
                  fill={isSelected ? 'rgba(30, 58, 138, 0.16)' : 'rgba(15, 23, 42, 0.52)'}
                  stroke={stroke}
                  strokeWidth={isSelected ? 2 : 1.5}
                  strokeDasharray="6 4"
                  onMouseDown={(e) => handleGroupMouseDown(e, group)}
                  style={{ cursor: 'move' }}
                />
                {/* Group title tab */}
                <rect
                  x={group.x + 12}
                  y={group.y - 11}
                  width={headerWidth}
                  height={22}
                  rx={6}
                  fill="#1e293b"
                  stroke={stroke}
                  strokeWidth={1}
                  onMouseDown={(e) => handleGroupMouseDown(e, group)}
                  style={{ cursor: 'move' }}
                />
                <text
                  x={group.x + 22}
                  y={group.y + 4}
                  fill="#e2e8f0"
                  fontSize={11.5}
                  fontWeight={600}
                  style={{ pointerEvents: 'none' }}
                >
                  {group.label}
                </text>
                {/* Bottom-right resize handle */}
                <rect
                  x={group.x + group.width - 12}
                  y={group.y + group.height - 12}
                  width={12}
                  height={12}
                  rx={3}
                  fill={isSelected ? '#3b82f6' : '#475569'}
                  style={{ cursor: 'nwse-resize' }}
                  onMouseDown={(e) => handleGroupResizeMouseDown(e, group)}
                />
              </g>
            );
          })}

          {/* 2. Edges Layer */}
          {resolvedView.edges
            .filter((e) => e.visible)
            .map((edge) => {
              const isSelected = selected?.kind === 'edge' && selected.id === edge.id;
              const stroke = isSelected
                ? '#60a5fa'
                : edge.isActiveFlow
                  ? edge.activeFlowColor
                  : edge.color || '#475569';
              const strokeWidth = isSelected || edge.isActiveFlow ? 2.6 : 1.8;
              const markerEnd = edge.isActiveFlow
                ? 'url(#dav-arrow-active)'
                : 'url(#dav-arrow-default)';
              const labelW = edge.label ? Math.max(48, edge.label.length * 7.2 + 16) : 0;

              return (
                <g
                  key={edge.id}
                  className={`dav-edge-group ${edge.isDimmed ? 'dav-dimmed' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelect({ kind: 'edge', id: edge.id });
                  }}
                  style={{ cursor: 'pointer' }}
                >
                  {/* Wide invisible hit target */}
                  <path
                    d={edge.path.svgPath}
                    fill="none"
                    stroke="transparent"
                    strokeWidth={14}
                  />
                  <path
                    d={edge.path.svgPath}
                    fill="none"
                    stroke={stroke}
                    strokeWidth={strokeWidth}
                    strokeDasharray={edge.style === 'dashed' ? '6 5' : undefined}
                    markerEnd={markerEnd}
                    markerStart={edge.direction === 'bidirectional' ? markerEnd : undefined}
                  />
                  {edge.isActiveFlow && (
                    <path
                      d={edge.path.svgPath}
                      fill="none"
                      stroke={edge.activeFlowColor}
                      strokeWidth={3}
                      className="dav-edge-flow-active"
                    />
                  )}
                  {edge.label && (
                    <g>
                      <rect
                        x={edge.path.midPoint.x - labelW / 2}
                        y={edge.path.midPoint.y - 10}
                        width={labelW}
                        height={20}
                        rx={5}
                        fill="#0f172a"
                        stroke={isSelected ? '#3b82f6' : '#334155'}
                        strokeWidth={1}
                      />
                      <text
                        x={edge.path.midPoint.x}
                        y={edge.path.midPoint.y + 3.5}
                        textAnchor="middle"
                        fill="#94a3b8"
                        fontSize={10.5}
                        fontWeight={500}
                      >
                        {edge.label}
                      </text>
                    </g>
                  )}
                </g>
              );
            })}

          {/* Temporary connection line while dragging port */}
          {dragState?.type === 'connect' &&
            dragState.connectFromNode &&
            dragState.currentMouseSvgX !== undefined &&
            dragState.currentMouseSvgY !== undefined && (
              <line
                x1={dragState.connectFromNode.x + dragState.connectFromNode.width}
                y1={dragState.connectFromNode.y + dragState.connectFromNode.height / 2}
                x2={dragState.currentMouseSvgX}
                y2={dragState.currentMouseSvgY}
                stroke="#3b82f6"
                strokeWidth={2.5}
                strokeDasharray="5 4"
                markerEnd="url(#dav-arrow-active)"
              />
            )}

          {/* 3. Nodes Layer */}
          {resolvedView.nodes
            .filter((n) => n.visible)
            .map((node) => {
              const iconMeta = ICON_META_MAP[node.icon] ?? ICON_META_MAP.server;
              const accent = node.color || iconMeta.accentColor;
              const isSelected = selected?.kind === 'node' && selected.id === node.id;
              const isHovered = hoveredNodeId === node.id;
              const isScreen = node.icon === 'screen' || node.icon === 'modal';

              let borderStroke = isSelected ? '#60a5fa' : '#334155';
              let bgFill = '#0f172a';
              let glowStyle: React.CSSProperties = { cursor: 'move' };

              if (node.status === 'active' || node.isFocused || isSelected) {
                borderStroke = isSelected ? '#60a5fa' : accent;
                glowStyle = {
                  ...glowStyle,
                  filter: `drop-shadow(0 0 10px ${accent}44)`,
                };
              }
              if (node.status === 'warning') {
                borderStroke = '#f59e0b';
                glowStyle = {
                  ...glowStyle,
                  filter: 'drop-shadow(0 0 10px rgba(245, 158, 11, 0.45))',
                };
              } else if (node.status === 'error') {
                borderStroke = '#ef4444';
              } else if (node.status === 'muted') {
                borderStroke = '#1e293b';
                bgFill = 'rgba(15, 23, 42, 0.62)';
              }

              const contentY = isScreen ? node.y + 28 : node.y + 14;
              const badgeColor =
                node.status === 'error'
                  ? '#ef4444'
                  : node.status === 'warning'
                    ? '#f59e0b'
                    : '#10b981';
              const badgeW = node.badge ? Math.max(44, node.badge.length * 7 + 14) : 0;

              return (
                <g
                  key={node.id}
                  className={`dav-node-group ${node.isDimmed ? 'dav-dimmed' : ''} ${
                    node.status === 'error' ? 'dav-node-error' : ''
                  }`}
                  style={glowStyle}
                  onMouseDown={(e) => handleNodeMouseDown(e, node)}
                  onMouseEnter={() => setHoveredNodeId(node.id)}
                  onMouseLeave={() =>
                    setHoveredNodeId((prev) => (prev === node.id ? null : prev))
                  }
                >
                  <rect
                    x={node.x}
                    y={node.y}
                    width={node.width}
                    height={node.height}
                    rx={10}
                    fill={bgFill}
                    stroke={borderStroke}
                    strokeWidth={
                      isSelected || node.isFocused || node.status !== 'normal' ? 2.2 : 1.5
                    }
                  />

                  {/* Wireframe browser topbar for screen/modal nodes */}
                  {isScreen && (
                    <g>
                      <rect
                        x={node.x}
                        y={node.y}
                        width={node.width}
                        height={22}
                        rx={10}
                        fill="#1e293b"
                      />
                      <circle cx={node.x + 12} cy={node.y + 11} r={3} fill="#ef4444" />
                      <circle cx={node.x + 22} cy={node.y + 11} r={3} fill="#f59e0b" />
                      <circle cx={node.x + 32} cy={node.y + 11} r={3} fill="#10b981" />
                    </g>
                  )}

                  {/* Icon Box */}
                  <g transform={`translate(${node.x + 12}, ${contentY})`}>
                    <rect
                      x={0}
                      y={0}
                      width={36}
                      height={36}
                      rx={8}
                      fill={`${accent}22`}
                      stroke={`${accent}55`}
                      strokeWidth={1}
                    />
                    <svg
                      x={6}
                      y={6}
                      width={24}
                      height={24}
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke={accent}
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      dangerouslySetInnerHTML={{ __html: iconMeta.svgInner }}
                    />
                  </g>

                  {/* Node Label & Subtitle */}
                  <text
                    x={node.x + 56}
                    y={contentY + 15}
                    fill="#f8fafc"
                    fontSize={12.5}
                    fontWeight={600}
                    style={{ pointerEvents: 'none' }}
                  >
                    {node.label}
                  </text>
                  {node.sub && (
                    <text
                      x={node.x + 56}
                      y={contentY + 32}
                      fill="#94a3b8"
                      fontSize={10.5}
                      style={{ pointerEvents: 'none' }}
                    >
                      {node.sub}
                    </text>
                  )}

                  {/* Status Badge */}
                  {node.badge && (
                    <g>
                      <rect
                        x={node.x + node.width - badgeW + 6}
                        y={node.y - 10}
                        width={badgeW}
                        height={18}
                        rx={9}
                        fill={badgeColor}
                      />
                      <text
                        x={node.x + node.width - badgeW / 2 + 6}
                        y={node.y + 2}
                        textAnchor="middle"
                        fill="#ffffff"
                        fontSize={9.5}
                        fontWeight={700}
                      >
                        {node.badge}
                      </text>
                    </g>
                  )}

                  {/* Right-side Port for Drag-Connecting Edges */}
                  {(isHovered || isSelected) && (
                    <circle
                      cx={node.x + node.width}
                      cy={node.y + node.height / 2}
                      r={6}
                      fill="#3b82f6"
                      stroke="#ffffff"
                      strokeWidth={2}
                      style={{ cursor: 'crosshair' }}
                      onMouseDown={(e) => handleStartConnect(e, node)}
                    >
                      <title>ドラッグして別のノードへ接続線を作成</title>
                    </circle>
                  )}
                </g>
              );
            })}

          {/* 4. Animated Data Packets Layer */}
          {activePackets.map((pkt, idx) => {
            const pt = getPointOnCubicBezier(
              pkt.path.p0,
              pkt.path.p1,
              pkt.path.p2,
              pkt.path.p3,
              localT
            );
            const pillW = pkt.label ? Math.max(64, pkt.label.length * 7.4 + 20) : 0;

            return (
              <g key={`${pkt.from}-${pkt.to}-${idx}`} style={{ pointerEvents: 'none' }}>
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r={8}
                  fill={pkt.color}
                  className="dav-packet-ring"
                />
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r={6}
                  fill="#ffffff"
                  stroke={pkt.color}
                  strokeWidth={3}
                />
                {pkt.label && (
                  <g>
                    <rect
                      x={pt.x - pillW / 2}
                      y={pt.y - 30}
                      width={pillW}
                      height={20}
                      rx={10}
                      fill={pkt.color}
                      stroke="#ffffff"
                      strokeWidth={1}
                    />
                    <text
                      x={pt.x}
                      y={pt.y - 16.5}
                      textAnchor="middle"
                      fill="#ffffff"
                      fontSize={11}
                      fontWeight={700}
                    >
                      {pkt.label}
                    </text>
                  </g>
                )}
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
};
