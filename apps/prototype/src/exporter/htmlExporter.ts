import { ICON_META_MAP } from '../core/icons';
import { DiagramModel } from '../core/types';
import { VIEWER_SHARED_CSS } from '../viewer/viewerStyles';

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeScriptContent(str: string): string {
  return str.replace(/<\/script/gi, '<\\/script');
}

/**
 * Generates a 100% standalone, zero-dependency Single-File HTML string
 * that plays the dynamic architecture / screen-transition diagram in any browser
 * and embeds the original DSL for round-trip re-importing into the editor.
 */
export function generateStandaloneHtml(model: DiagramModel, dslText: string): string {
  const payload = {
    model,
    icons: ICON_META_MAP,
  };

  const safeTitle = escapeHtml(model.title || 'Dynamic Architect Viewer');
  const safeDsl = escapeScriptContent(dslText);
  const safeJson = escapeScriptContent(JSON.stringify(payload));

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${safeTitle} - DynamicArchitectViewer</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body {
      width: 100%;
      height: 100%;
      background: #0b0f19;
      color: #f1f5f9;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Hiragino Sans", "Noto Sans JP", sans-serif;
      overflow: hidden;
    }
    .app-shell {
      display: flex;
      flex-direction: column;
      width: 100vw;
      height: 100vh;
    }
    .topbar {
      height: 52px;
      background: rgba(15, 23, 42, 0.92);
      border-bottom: 1px solid #1e293b;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 20px;
      z-index: 20;
    }
    .topbar-left {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .brand-badge {
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      padding: 3px 8px;
      border-radius: 6px;
      background: rgba(59, 130, 246, 0.18);
      color: #60a5fa;
      border: 1px solid rgba(59, 130, 246, 0.35);
    }
    .diagram-title {
      font-size: 15px;
      font-weight: 600;
      color: #f8fafc;
    }
    .topbar-actions {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .btn {
      background: #1e293b;
      color: #e2e8f0;
      border: 1px solid #334155;
      border-radius: 6px;
      padding: 6px 11px;
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.15s ease;
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    .btn:hover {
      background: #334155;
      border-color: #475569;
    }
    .btn-primary {
      background: #2563eb;
      border-color: #3b82f6;
      color: #ffffff;
    }
    .btn-primary:hover {
      background: #1d4ed8;
    }
    .viewport {
      flex: 1;
      position: relative;
      overflow: hidden;
      cursor: grab;
      background-color: #0b0f19;
      background-image: radial-gradient(#1e293b 1px, transparent 1px);
      background-size: 24px 24px;
    }
    .viewport.dragging {
      cursor: grabbing;
    }
    .player-dock {
      background: rgba(15, 23, 42, 0.96);
      border-top: 1px solid #1e293b;
      padding: 14px 24px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      z-index: 20;
    }
    .step-info-row {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 20px;
    }
    .step-text-box {
      flex: 1;
    }
    .step-heading {
      font-size: 15px;
      font-weight: 700;
      color: #60a5fa;
      margin-bottom: 4px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .step-desc {
      font-size: 13px;
      color: #cbd5e1;
      line-height: 1.5;
      white-space: pre-line;
    }
    .controls-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      flex-wrap: wrap;
    }
    .step-pills {
      display: flex;
      align-items: center;
      gap: 6px;
      flex-wrap: wrap;
    }
    .step-pill {
      background: #1e293b;
      color: #94a3b8;
      border: 1px solid #334155;
      border-radius: 999px;
      padding: 5px 12px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.15s ease;
    }
    .step-pill:hover {
      color: #f8fafc;
      border-color: #475569;
    }
    .step-pill.active {
      background: rgba(37, 99, 235, 0.25);
      color: #60a5fa;
      border-color: #3b82f6;
      box-shadow: 0 0 12px rgba(59, 130, 246, 0.25);
    }
    .transport-controls {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .modal-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(2, 6, 23, 0.75);
      display: none;
      align-items: center;
      justify-content: center;
      z-index: 100;
      padding: 24px;
    }
    .modal-backdrop.open {
      display: flex;
    }
    .modal-card {
      background: #0f172a;
      border: 1px solid #334155;
      border-radius: 12px;
      width: min(820px, 100%);
      max-height: 82vh;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      box-shadow: 0 24px 48px rgba(0,0,0,0.5);
    }
    .modal-header {
      padding: 14px 18px;
      border-bottom: 1px solid #1e293b;
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-weight: 600;
      font-size: 14px;
    }
    .modal-pre {
      padding: 16px;
      overflow: auto;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 12px;
      line-height: 1.55;
      color: #e2e8f0;
      background: #020617;
      flex: 1;
    }
    ${VIEWER_SHARED_CSS}
  </style>
</head>
<body>
  <div class="app-shell">
    <header class="topbar">
      <div class="topbar-left">
        <span class="brand-badge">Dynamic Architect</span>
        <h1 class="diagram-title" id="ui-title">${safeTitle}</h1>
      </div>
      <div class="topbar-actions">
        <button class="btn" id="btn-zoom-out" title="縮小">－</button>
        <span id="ui-zoom-label" style="font-size:12px;color:#94a3b8;min-width:44px;text-align:center;">100%</span>
        <button class="btn" id="btn-zoom-in" title="拡大">＋</button>
        <button class="btn" id="btn-zoom-fit" title="全体を表示">全体フィット</button>
        <button class="btn" id="btn-show-dsl">DSLソース</button>
      </div>
    </header>

    <main class="viewport" id="viewport">
      <svg id="canvas-svg" class="dav-canvas-svg" width="100%" height="100%">
        <defs id="svg-defs"></defs>
        <g id="viewport-transform">
          <g id="layer-groups"></g>
          <g id="layer-edges"></g>
          <g id="layer-nodes"></g>
          <g id="layer-packets"></g>
        </g>
      </svg>
    </main>

    <footer class="player-dock">
      <div class="step-info-row">
        <div class="step-text-box">
          <div class="step-heading" id="ui-step-title">全体構成ビュー</div>
          <div class="step-desc" id="ui-step-desc">下部のステップボタンを押すか、再生ボタン（または ← / → キー）でデータの流れをステップ再生できます。</div>
        </div>
        <div class="transport-controls">
          <button class="btn" id="btn-prev">◀ 前へ</button>
          <button class="btn btn-primary" id="btn-play">▶ 自動再生</button>
          <button class="btn" id="btn-next">次へ ▶</button>
          <select class="btn" id="sel-speed" title="再生速度">
            <option value="0.7">0.7x</option>
            <option value="1" selected>1.0x</option>
            <option value="1.5">1.5x</option>
            <option value="2">2.0x</option>
          </select>
        </div>
      </div>
      <div class="controls-row">
        <div class="step-pills" id="ui-step-pills"></div>
        <div style="font-size:11px;color:#64748b;">ドラッグ: 画面移動 / ホイール: ズーム / キーボード: ← → Space</div>
      </div>
    </footer>
  </div>

  <div class="modal-backdrop" id="dsl-modal">
    <div class="modal-card">
      <div class="modal-header">
        <span>埋め込み DSL ソース（このHTMLファイルをEditorに読み込ませて再編集可能）</span>
        <div style="display:flex;gap:8px;">
          <button class="btn btn-primary" id="btn-copy-dsl">コピー</button>
          <button class="btn" id="btn-close-dsl">閉じる</button>
        </div>
      </div>
      <pre class="modal-pre" id="dsl-code-view"></pre>
    </div>
  </div>

  <script id="dav-dsl-source" type="text/plain">${safeDsl}</script>
  <script id="dav-model-json" type="application/json">${safeJson}</script>
  <script>
  (function() {
    var rawJson = document.getElementById('dav-model-json').textContent;
    var dslSource = document.getElementById('dav-dsl-source').textContent;
    var payload = JSON.parse(rawJson);
    var model = payload.model;
    var icons = payload.icons;

    var activeStepIndex = model.steps.length > 0 ? 0 : null;
    var isPlaying = true;
    var speed = 1.0;
    var phaseProgress = 0;
    var lastFrameTime = performance.now();

    var panX = 40;
    var panY = 30;
    var zoom = 1;
    var isDragging = false;
    var dragStartX = 0;
    var dragStartY = 0;

    var svgEl = document.getElementById('canvas-svg');
    var transformGroup = document.getElementById('viewport-transform');
    var layerGroups = document.getElementById('layer-groups');
    var layerEdges = document.getElementById('layer-edges');
    var layerNodes = document.getElementById('layer-nodes');
    var layerPackets = document.getElementById('layer-packets');
    var defsEl = document.getElementById('svg-defs');

    function esc(s) {
      return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function computeBezier(fromNode, toNode) {
      var fromCx = fromNode.x + fromNode.width / 2;
      var fromCy = fromNode.y + fromNode.height / 2;
      var toCx = toNode.x + toNode.width / 2;
      var toCy = toNode.y + toNode.height / 2;
      var dx = toCx - fromCx;
      var dy = toCy - fromCy;
      var p0, p1, p2, p3;
      if (Math.abs(dx) >= Math.abs(dy) * 0.85) {
        p0 = { x: dx >= 0 ? fromNode.x + fromNode.width : fromNode.x, y: fromCy };
        p3 = { x: dx >= 0 ? toNode.x : toNode.x + toNode.width, y: toCy };
        var offX = Math.max(48, Math.min(160, Math.abs(p3.x - p0.x) * 0.45)) * (dx >= 0 ? 1 : -1);
        p1 = { x: p0.x + offX, y: p0.y };
        p2 = { x: p3.x - offX, y: p3.y };
      } else {
        p0 = { x: fromCx, y: dy >= 0 ? fromNode.y + fromNode.height : fromNode.y };
        p3 = { x: toCx, y: dy >= 0 ? toNode.y : toNode.y + toNode.height };
        var offY = Math.max(40, Math.min(140, Math.abs(p3.y - p0.y) * 0.45)) * (dy >= 0 ? 1 : -1);
        p1 = { x: p0.x, y: p0.y + offY };
        p2 = { x: p3.x, y: p3.y - offY };
      }
      var svgPath = 'M ' + p0.x + ' ' + p0.y + ' C ' + p1.x + ' ' + p1.y + ', ' + p2.x + ' ' + p2.y + ', ' + p3.x + ' ' + p3.y;
      var mid = pointOnBezier(p0, p1, p2, p3, 0.5);
      return { p0: p0, p1: p1, p2: p2, p3: p3, svgPath: svgPath, midPoint: mid };
    }

    function pointOnBezier(p0, p1, p2, p3, t) {
      var c = Math.max(0, Math.min(1, t));
      var u = 1 - c;
      var tt = c * c, uu = u * u, uuu = uu * u, ttt = tt * c;
      return {
        x: uuu * p0.x + 3 * uu * c * p1.x + 3 * u * tt * p2.x + ttt * p3.x,
        y: uuu * p0.y + 3 * uu * c * p1.y + 3 * u * tt * p2.y + ttt * p3.y
      };
    }

    function resolveCurrentView() {
      var step = (activeStepIndex !== null && model.steps[activeStepIndex]) ? model.steps[activeStepIndex] : null;
      var stateMap = {};
      var focusedSet = {};
      if (step) {
        step.states.forEach(function(st) {
          stateMap[st.targetId] = Object.assign({}, stateMap[st.targetId] || {}, st);
          focusedSet[st.targetId] = true;
        });
        step.focusIds.forEach(function(id) { focusedSet[id] = true; });
        step.animations.forEach(function(a) {
          focusedSet[a.from] = true;
          focusedSet[a.to] = true;
        });
      }
      var hasFocus = step !== null && Object.keys(focusedSet).length > 0;
      var nodes = model.nodes.map(function(n) {
        var ov = stateMap[n.id] || {};
        var isF = step !== null && !!focusedSet[n.id];
        return Object.assign({}, n, {
          status: ov.status || n.status,
          badge: ov.badge !== undefined ? ov.badge : n.badge,
          visible: ov.visible !== undefined ? ov.visible : n.visible,
          color: ov.color || n.color,
          label: ov.label || n.label,
          sub: ov.sub || n.sub,
          isFocused: isF,
          isDimmed: hasFocus && !isF
        });
      });
      var nodeMap = {};
      nodes.forEach(function(n) { nodeMap[n.id] = n; });

      var phases = [];
      var pIdx = -1;
      if (step) {
        step.animations.forEach(function(a, i) {
          var fn = nodeMap[a.from], tn = nodeMap[a.to];
          if (!fn || !tn) return;
          fn.visible = true;
          tn.visible = true;
          if (i === 0 || !a.parallel) pIdx++;
          phases.push({
            phaseIndex: Math.max(0, pIdx),
            from: a.from,
            to: a.to,
            label: a.label,
            color: a.color || '#3b82f6',
            path: computeBezier(fn, tn)
          });
        });
      }

      var edges = [];
      model.edges.forEach(function(e) {
        var fn = nodeMap[e.from], tn = nodeMap[e.to];
        if (!fn || !tn) return;
        var ov = stateMap[e.id] || {};
        var matchAnim = phases.find(function(p) {
          return (p.from === e.from && p.to === e.to) || (e.direction === 'bidirectional' && p.from === e.to && p.to === e.from);
        });
        var vis = ov.visible !== undefined ? ov.visible : (matchAnim ? true : e.visible);
        var isF = step !== null && (!!focusedSet[e.id] || !!matchAnim || (!!focusedSet[e.from] && !!focusedSet[e.to]));
        edges.push(Object.assign({}, e, {
          visible: vis,
          color: ov.color || (matchAnim && matchAnim.color) || e.color,
          label: ov.label || e.label,
          path: computeBezier(fn, tn),
          isFocused: isF,
          isDimmed: hasFocus && !isF,
          isActiveFlow: !!matchAnim,
          activeFlowColor: (matchAnim && matchAnim.color) || ov.color || e.color || '#3b82f6'
        }));
      });

      return { nodes: nodes, edges: edges, phases: phases, totalPhases: pIdx + 1 };
    }

    var currentView = resolveCurrentView();

    function renderStaticScene() {
      currentView = resolveCurrentView();
      phaseProgress = 0;

      defsEl.innerHTML = [
        '<marker id="arrow-default" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">',
        '  <path d="M 0 1.5 L 8.5 5 L 0 8.5 z" fill="#64748b" />',
        '</marker>',
        '<marker id="arrow-active" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6.5" markerHeight="6.5" orient="auto-start-reverse">',
        '  <path d="M 0 1.5 L 8.5 5 L 0 8.5 z" fill="#60a5fa" />',
        '</marker>'
      ].join('');

      // Groups
      layerGroups.innerHTML = model.groups.map(function(g) {
        var stroke = g.color || '#334155';
        return [
          '<g class="dav-group-rect">',
          '  <rect x="' + g.x + '" y="' + g.y + '" width="' + g.width + '" height="' + g.height + '" rx="12" fill="rgba(15, 23, 42, 0.52)" stroke="' + esc(stroke) + '" stroke-width="1.5" stroke-dasharray="6 4"/>',
          '  <rect x="' + (g.x + 12) + '" y="' + (g.y - 11) + '" width="' + Math.min(g.width - 24, Math.max(90, g.label.length * 9 + 24)) + '" height="22" rx="6" fill="#1e293b" stroke="' + esc(stroke) + '" stroke-width="1"/>',
          '  <text x="' + (g.x + 22) + '" y="' + (g.y + 4) + '" fill="#cbd5e1" font-size="11.5" font-weight="600">' + esc(g.label) + '</text>',
          '</g>'
        ].join('');
      }).join('');

      // Edges
      layerEdges.innerHTML = currentView.edges.filter(function(e) { return e.visible; }).map(function(e) {
        var stroke = e.isActiveFlow ? e.activeFlowColor : (e.color || '#475569');
        var width = e.isActiveFlow ? 2.6 : 1.75;
        var dash = e.style === 'dashed' ? 'stroke-dasharray="6 5"' : '';
        var markerEnd = e.isActiveFlow ? 'url(#arrow-active)' : 'url(#arrow-default)';
        var markerStart = e.direction === 'bidirectional' ? ('marker-start="' + markerEnd + '"') : '';
        var dimClass = e.isDimmed ? ' dav-dimmed' : '';
        var flowOverlay = e.isActiveFlow
          ? '<path d="' + e.path.svgPath + '" fill="none" stroke="' + esc(e.activeFlowColor) + '" stroke-width="3" class="dav-edge-flow-active" />'
          : '';
        var labelMarkup = '';
        if (e.label) {
          var lw = Math.max(48, e.label.length * 7.2 + 16);
          labelMarkup = [
            '<rect x="' + (e.path.midPoint.x - lw / 2) + '" y="' + (e.path.midPoint.y - 10) + '" width="' + lw + '" height="20" rx="5" fill="#0f172a" stroke="#334155" stroke-width="1"/>',
            '<text x="' + e.path.midPoint.x + '" y="' + (e.path.midPoint.y + 3.5) + '" text-anchor="middle" fill="#94a3b8" font-size="10.5" font-weight="500">' + esc(e.label) + '</text>'
          ].join('');
        }
        return [
          '<g class="dav-edge-group' + dimClass + '">',
          '  <path d="' + e.path.svgPath + '" fill="none" stroke="' + esc(stroke) + '" stroke-width="' + width + '" ' + dash + ' marker-end="' + markerEnd + '" ' + markerStart + ' />',
          flowOverlay,
          labelMarkup,
          '</g>'
        ].join('');
      }).join('');

      // Nodes
      layerNodes.innerHTML = currentView.nodes.filter(function(n) { return n.visible; }).map(function(n) {
        var iconMeta = icons[n.icon] || icons.server;
        var accent = n.color || iconMeta.accentColor || '#3b82f6';
        var borderStroke = '#334155';
        var bgFill = '#0f172a';
        var glowFilter = '';
        var extraClass = n.isDimmed ? ' dav-dimmed' : '';

        if (n.status === 'active' || n.isFocused) {
          borderStroke = accent;
          glowFilter = 'filter: drop-shadow(0 0 10px ' + accent + '44);';
        }
        if (n.status === 'warning') {
          borderStroke = '#f59e0b';
          glowFilter = 'filter: drop-shadow(0 0 10px rgba(245,158,11,0.4));';
        } else if (n.status === 'error') {
          borderStroke = '#ef4444';
          extraClass += ' dav-node-error';
        } else if (n.status === 'muted') {
          borderStroke = '#1e293b';
          bgFill = 'rgba(15, 23, 42, 0.6)';
        }

        var isScreen = n.icon === 'screen' || n.icon === 'modal';
        var screenBar = isScreen ? [
          '<rect x="' + n.x + '" y="' + n.y + '" width="' + n.width + '" height="22" rx="10" fill="#1e293b"/>',
          '<circle cx="' + (n.x + 12) + '" cy="' + (n.y + 11) + '" r="3" fill="#ef4444"/>',
          '<circle cx="' + (n.x + 22) + '" cy="' + (n.y + 11) + '" r="3" fill="#f59e0b"/>',
          '<circle cx="' + (n.x + 32) + '" cy="' + (n.y + 11) + '" r="3" fill="#10b981"/>'
        ].join('') : '';

        var contentY = isScreen ? n.y + 28 : n.y + 14;
        var badgeMarkup = '';
        if (n.badge) {
          var badgeColor = n.status === 'error' ? '#ef4444' : n.status === 'warning' ? '#f59e0b' : '#10b981';
          var bw = Math.max(44, n.badge.length * 7 + 14);
          badgeMarkup = [
            '<rect x="' + (n.x + n.width - bw + 6) + '" y="' + (n.y - 10) + '" width="' + bw + '" height="18" rx="9" fill="' + badgeColor + '" />',
            '<text x="' + (n.x + n.width - bw / 2 + 6) + '" y="' + (n.y + 2) + '" text-anchor="middle" fill="#ffffff" font-size="9.5" font-weight="700">' + esc(n.badge) + '</text>'
          ].join('');
        }

        return [
          '<g class="dav-node-group' + extraClass + '" style="' + glowFilter + '">',
          '  <rect x="' + n.x + '" y="' + n.y + '" width="' + n.width + '" height="' + n.height + '" rx="10" fill="' + bgFill + '" stroke="' + esc(borderStroke) + '" stroke-width="' + (n.isFocused || n.status !== 'normal' ? '2.2' : '1.5') + '"/>',
          screenBar,
          '  <g transform="translate(' + (n.x + 12) + ', ' + contentY + ')">',
          '    <rect x="0" y="0" width="36" height="36" rx="8" fill="' + esc(accent) + '22" stroke="' + esc(accent) + '55" stroke-width="1"/>',
          '    <svg x="6" y="6" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="' + esc(accent) + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + iconMeta.svgInner + '</svg>',
          '  </g>',
          '  <text x="' + (n.x + 56) + '" y="' + (contentY + 15) + '" fill="#f8fafc" font-size="12.5" font-weight="600">' + esc(n.label) + '</text>',
          n.sub ? '  <text x="' + (n.x + 56) + '" y="' + (contentY + 32) + '" fill="#94a3b8" font-size="10.5">' + esc(n.sub) + '</text>' : '',
          badgeMarkup,
          '</g>'
        ].join('');
      }).join('');

      updateStepUi();
    }

    function updateStepUi() {
      var titleEl = document.getElementById('ui-step-title');
      var descEl = document.getElementById('ui-step-desc');
      var pillsEl = document.getElementById('ui-step-pills');
      var playBtn = document.getElementById('btn-play');

      if (activeStepIndex === null || !model.steps[activeStepIndex]) {
        titleEl.textContent = '全体構成ビュー (Overview)';
        descEl.textContent = '全ノード・エッジのベース構成を表示しています。ステップを選択すると動的なデータの流れを再生します。';
      } else {
        var st = model.steps[activeStepIndex];
        titleEl.textContent = 'Step ' + st.stepNumber + ': ' + st.title;
        descEl.textContent = st.description || '（説明なし）';
      }

      playBtn.textContent = isPlaying ? '⏸ 一時停止' : '▶ 自動再生';

      var pillsHtml = '<button class="step-pill ' + (activeStepIndex === null ? 'active' : '') + '" data-step="null">全体図</button>';
      model.steps.forEach(function(s, idx) {
        var active = activeStepIndex === idx ? 'active' : '';
        pillsHtml += '<button class="step-pill ' + active + '" data-step="' + idx + '">Step ' + s.stepNumber + ': ' + esc(s.title) + '</button>';
      });
      pillsEl.innerHTML = pillsHtml;

      Array.prototype.forEach.call(pillsEl.querySelectorAll('.step-pill'), function(btn) {
        btn.addEventListener('click', function() {
          var val = btn.getAttribute('data-step');
          activeStepIndex = val === 'null' ? null : Number(val);
          renderStaticScene();
        });
      });
    }

    function applyTransform() {
      transformGroup.setAttribute('transform', 'translate(' + panX + ',' + panY + ') scale(' + zoom + ')');
      document.getElementById('ui-zoom-label').textContent = Math.round(zoom * 100) + '%';
    }

    function fitToScreen() {
      if (model.nodes.length === 0) return;
      var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      model.nodes.forEach(function(n) {
        minX = Math.min(minX, n.x);
        minY = Math.min(minY, n.y);
        maxX = Math.max(maxX, n.x + n.width);
        maxY = Math.max(maxY, n.y + n.height);
      });
      model.groups.forEach(function(g) {
        minX = Math.min(minX, g.x);
        minY = Math.min(minY, g.y);
        maxX = Math.max(maxX, g.x + g.width);
        maxY = Math.max(maxY, g.y + g.height);
      });
      var vp = document.getElementById('viewport');
      var vw = vp.clientWidth || 1000;
      var vh = vp.clientHeight || 620;
      var contentW = Math.max(200, maxX - minX + 120);
      var contentH = Math.max(200, maxY - minY + 120);
      zoom = Math.max(0.35, Math.min(1.25, Math.min(vw / contentW, vh / contentH)));
      panX = Math.round((vw - (maxX - minX) * zoom) / 2 - minX * zoom);
      panY = Math.round((vh - (maxY - minY) * zoom) / 2 - minY * zoom);
      applyTransform();
    }

    function animateFrame(now) {
      var dt = (now - lastFrameTime) / 1000;
      lastFrameTime = now;

      if (currentView.totalPhases > 0) {
        var stepSpeed = 0.62 * speed;
        phaseProgress += dt * stepSpeed;
        if (phaseProgress >= currentView.totalPhases + 0.35) {
          if (isPlaying && model.steps.length > 0 && activeStepIndex !== null) {
            activeStepIndex = (activeStepIndex + 1) % model.steps.length;
            renderStaticScene();
          } else {
            phaseProgress = 0;
          }
        }

        var activePhaseIdx = Math.min(currentView.totalPhases - 1, Math.floor(phaseProgress));
        var localT = Math.min(1, phaseProgress - activePhaseIdx);

        var activePackets = currentView.phases.filter(function(p) {
          return p.phaseIndex === activePhaseIdx;
        });

        layerPackets.innerHTML = activePackets.map(function(pkt) {
          var pt = pointOnBezier(pkt.path.p0, pkt.path.p1, pkt.path.p2, pkt.path.p3, localT);
          var pill = '';
          if (pkt.label) {
            var pw = Math.max(64, pkt.label.length * 7.4 + 20);
            pill = [
              '<rect x="' + (pt.x - pw / 2) + '" y="' + (pt.y - 30) + '" width="' + pw + '" height="20" rx="10" fill="' + esc(pkt.color) + '" stroke="#ffffff" stroke-width="1"/>',
              '<text x="' + pt.x + '" y="' + (pt.y - 16.5) + '" text-anchor="middle" fill="#ffffff" font-size="11" font-weight="700">' + esc(pkt.label) + '</text>'
            ].join('');
          }
          return [
            '<g>',
            '  <circle cx="' + pt.x + '" cy="' + pt.y + '" r="8" fill="' + esc(pkt.color) + '" class="dav-packet-ring" />',
            '  <circle cx="' + pt.x + '" cy="' + pt.y + '" r="6" fill="#ffffff" stroke="' + esc(pkt.color) + '" stroke-width="3" />',
            pill,
            '</g>'
          ].join('');
        }).join('');
      } else {
        layerPackets.innerHTML = '';
      }

      requestAnimationFrame(animateFrame);
    }

    // Event bindings
    var vp = document.getElementById('viewport');
    vp.addEventListener('mousedown', function(e) {
      isDragging = true;
      dragStartX = e.clientX - panX;
      dragStartY = e.clientY - panY;
      vp.classList.add('dragging');
    });
    window.addEventListener('mousemove', function(e) {
      if (!isDragging) return;
      panX = e.clientX - dragStartX;
      panY = e.clientY - dragStartY;
      applyTransform();
    });
    window.addEventListener('mouseup', function() {
      isDragging = false;
      vp.classList.remove('dragging');
    });
    vp.addEventListener('wheel', function(e) {
      e.preventDefault();
      var factor = e.deltaY < 0 ? 1.1 : 0.9;
      zoom = Math.max(0.25, Math.min(2.5, zoom * factor));
      applyTransform();
    }, { passive: false });

    document.getElementById('btn-zoom-in').addEventListener('click', function() {
      zoom = Math.min(2.5, zoom * 1.15);
      applyTransform();
    });
    document.getElementById('btn-zoom-out').addEventListener('click', function() {
      zoom = Math.max(0.25, zoom / 1.15);
      applyTransform();
    });
    document.getElementById('btn-zoom-fit').addEventListener('click', fitToScreen);

    document.getElementById('btn-prev').addEventListener('click', function() {
      if (model.steps.length === 0) return;
      isPlaying = false;
      if (activeStepIndex === null || activeStepIndex <= 0) {
        activeStepIndex = model.steps.length - 1;
      } else {
        activeStepIndex--;
      }
      renderStaticScene();
    });
    document.getElementById('btn-next').addEventListener('click', function() {
      if (model.steps.length === 0) return;
      isPlaying = false;
      if (activeStepIndex === null || activeStepIndex >= model.steps.length - 1) {
        activeStepIndex = 0;
      } else {
        activeStepIndex++;
      }
      renderStaticScene();
    });
    document.getElementById('btn-play').addEventListener('click', function() {
      if (activeStepIndex === null && model.steps.length > 0) activeStepIndex = 0;
      isPlaying = !isPlaying;
      updateStepUi();
    });
    document.getElementById('sel-speed').addEventListener('change', function(e) {
      speed = Number(e.target.value) || 1;
    });

    window.addEventListener('keydown', function(e) {
      if (e.key === 'ArrowRight') document.getElementById('btn-next').click();
      if (e.key === 'ArrowLeft') document.getElementById('btn-prev').click();
      if (e.key === ' ') {
        e.preventDefault();
        document.getElementById('btn-play').click();
      }
    });

    var modal = document.getElementById('dsl-modal');
    document.getElementById('dsl-code-view').textContent = dslSource;
    document.getElementById('btn-show-dsl').addEventListener('click', function() {
      modal.classList.add('open');
    });
    document.getElementById('btn-close-dsl').addEventListener('click', function() {
      modal.classList.remove('open');
    });
    document.getElementById('btn-copy-dsl').addEventListener('click', function() {
      navigator.clipboard.writeText(dslSource);
      var b = document.getElementById('btn-copy-dsl');
      b.textContent = 'コピーしました';
      setTimeout(function() { b.textContent = 'コピー'; }, 1500);
    });

    renderStaticScene();
    fitToScreen();
    requestAnimationFrame(animateFrame);
  })();
  </script>
</body>
</html>`;
}
