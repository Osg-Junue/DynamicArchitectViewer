import React, { useCallback, useMemo, useRef, useState } from 'react';
import { applyAutoLayout } from '../core/layout';
import { parseDsl } from '../core/parser';
import { SAMPLE_TEMPLATES } from '../core/samples';
import { patchPositionsInDsl, serializeModelToDsl } from '../core/serializer';
import { DiagramModel } from '../core/types';
import { generateStandaloneHtml } from '../exporter/htmlExporter';
import { extractDslFromImportedContent } from '../exporter/htmlImporter';
import { VIEWER_SHARED_CSS } from '../viewer/viewerStyles';
import { CanvasPane, SelectedElement } from './CanvasPane';
import { DslEditorPane } from './DslEditorPane';
import { StepInspector } from './StepInspector';

export const App: React.FC = () => {
  const [dslText, setDslText] = useState<string>(SAMPLE_TEMPLATES[0].dsl);
  const [activeStepIndex, setActiveStepIndex] = useState<number | null>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);
  const [selected, setSelected] = useState<SelectedElement>(null);
  const [showDslPane, setShowDslPane] = useState<boolean>(true);
  const [showInspectorPane, setShowInspectorPane] = useState<boolean>(true);
  const [importStatus, setImportStatus] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const model = useMemo<DiagramModel>(() => parseDsl(dslText), [dslText]);

  // Clamp activeStepIndex if steps count shrinks
  const effectiveStepIndex =
    activeStepIndex !== null && activeStepIndex < model.steps.length
      ? activeStepIndex
      : model.steps.length > 0 && activeStepIndex !== null
        ? model.steps.length - 1
        : null;

  // Two-way sync: GUI drag updates DSL @pos / @size in-place
  const handleMoveNodesAndGroups = useCallback(
    (
      nodeUpdates: Array<{ id: string; x: number; y: number }>,
      groupUpdates: Array<{
        id: string;
        x: number;
        y: number;
        width?: number;
        height?: number;
      }> = []
    ) => {
      setDslText((prev) => patchPositionsInDsl(prev, nodeUpdates, groupUpdates));
    },
    []
  );

  // Two-way sync: GUI structural edit updates Model -> DSL
  const handleUpdateModel = useCallback((nextModel: DiagramModel) => {
    setDslText(serializeModelToDsl(nextModel));
  }, []);

  // GUI drag-to-connect edge creation
  const handleCreateEdge = useCallback(
    (fromId: string, toId: string) => {
      const nextModel: DiagramModel = {
        ...model,
        edges: [
          ...model.edges,
          {
            id: `e_${fromId}_${toId}_${model.edges.length + 1}`,
            from: fromId,
            to: toId,
            label: 'Flow',
            style: 'solid',
            direction: 'forward',
            visible: true,
          },
        ],
      };
      setDslText(serializeModelToDsl(nextModel));
    },
    [model]
  );

  // Auto-layout all elements and write back to DSL
  const handleApplyAutoLayout = useCallback(() => {
    const laidOut = applyAutoLayout(model, true);
    setDslText(serializeModelToDsl(laidOut));
  }, [model]);

  // Advance step during auto-playback
  const handleAdvanceStep = useCallback(() => {
    if (model.steps.length === 0) return;
    setActiveStepIndex((prev) => {
      if (prev === null) return 0;
      return (prev + 1) % model.steps.length;
    });
  }, [model.steps.length]);

  // Export single-file standalone HTML
  const handleExportStandaloneHtml = () => {
    const htmlContent = generateStandaloneHtml(model, dslText);
    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const safeFileName =
      (model.title || 'dynamic-architecture')
        .replace(/[\\/:*?"<>|\s]+/g, '_')
        .slice(0, 50) + '.html';

    const a = document.createElement('a');
    a.href = url;
    a.download = safeFileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Import from previously exported HTML or DSL text file
  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const content = String(reader.result ?? '');
      const extracted = extractDslFromImportedContent(content);
      if (extracted) {
        setDslText(extracted);
        setActiveStepIndex(0);
        setImportStatus(`"${file.name}" を読み込みました`);
      } else {
        setImportStatus('ファイル内に有効なDSLデータが見つかりませんでした');
      }
      setTimeout(() => setImportStatus(null), 3000);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const activeStep =
    effectiveStepIndex !== null ? model.steps[effectiveStepIndex] : null;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100vw',
        height: '100vh',
        background: '#0b0f19',
        color: '#f1f5f9',
        overflow: 'hidden',
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Hiragino Sans", "Noto Sans JP", sans-serif',
      }}
    >
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        .dav-toolbar-btn {
          background: #1e293b;
          color: #e2e8f0;
          border: 1px solid #334155;
          border-radius: 6px;
          padding: 5px 10px;
          font-size: 11.5px;
          font-weight: 500;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 5px;
          transition: all 0.15s ease;
        }
        .dav-toolbar-btn:hover {
          background: #334155;
          border-color: #475569;
        }
        .dav-btn-primary {
          background: #2563eb;
          color: #ffffff;
          border: 1px solid #3b82f6;
          border-radius: 6px;
          padding: 6px 12px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          transition: background 0.15s ease;
        }
        .dav-btn-primary:hover {
          background: #1d4ed8;
        }
        .dav-input {
          width: 100%;
          background: #020617;
          color: #f1f5f9;
          border: 1px solid #334155;
          border-radius: 5px;
          padding: 5px 8px;
          font-size: 12px;
          outline: none;
        }
        .dav-input:focus {
          border-color: #3b82f6;
        }
        ${VIEWER_SHARED_CSS}
      `}</style>

      {/* Top Navigation Bar */}
      <header
        style={{
          height: 52,
          background: '#0f172a',
          borderBottom: '1px solid #1e293b',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 16px',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              background: 'linear-gradient(135deg, #2563eb, #7c3aed)',
              color: '#fff',
              fontWeight: 800,
              fontSize: 12,
              padding: '4px 9px',
              borderRadius: 6,
              letterSpacing: '0.04em',
            }}
          >
            DYNAMIC ARCHITECT
          </div>
          <span style={{ fontWeight: 700, fontSize: 14, color: '#f8fafc' }}>
            {model.title}
          </span>

          {/* Sample Selector */}
          <select
            className="dav-input"
            style={{ width: 310, marginLeft: 8 }}
            onChange={(e) => {
              const found = SAMPLE_TEMPLATES.find((t) => t.id === e.target.value);
              if (found) {
                setDslText(found.dsl);
                setActiveStepIndex(0);
                setSelected(null);
              }
            }}
            defaultValue={SAMPLE_TEMPLATES[0].id}
          >
            {SAMPLE_TEMPLATES.map((tpl) => (
              <option key={tpl.id} value={tpl.id}>
                テンプレート: {tpl.name}
              </option>
            ))}
          </select>

          {importStatus && (
            <span
              style={{
                fontSize: 11.5,
                color: '#34d399',
                background: 'rgba(16, 185, 129, 0.14)',
                padding: '3px 8px',
                borderRadius: 5,
              }}
            >
              {importStatus}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            className="dav-toolbar-btn"
            onClick={() => setShowDslPane((v) => !v)}
            style={{ opacity: showDslPane ? 1 : 0.6 }}
          >
            {showDslPane ? '◀ DSLエディタ非表示' : '▶ DSLエディタ表示'}
          </button>
          <button
            className="dav-toolbar-btn"
            onClick={() => setShowInspectorPane((v) => !v)}
            style={{ opacity: showInspectorPane ? 1 : 0.6 }}
          >
            {showInspectorPane ? 'GUIパネル非表示 ▶' : '◀ GUIパネル表示'}
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept=".html,.htm,.dav,.txt"
            style={{ display: 'none' }}
            onChange={handleImportFile}
          />
          <button
            className="dav-toolbar-btn"
            onClick={() => fileInputRef.current?.click()}
            title="出力した1ペラHTMLまたはDSLファイルを読み込んで再編集します"
          >
            📂 HTML/DSL読込
          </button>

          <button
            className="dav-btn-primary"
            onClick={handleExportStandaloneHtml}
            title="CSS/JS/データをすべて1ファイルに埋め込んだスタンドアロンHTMLを出力します"
          >
            ⬇ 1ペラHTML出力 (Standalone)
          </button>
        </div>
      </header>

      {/* Main Workspace */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        {/* Left: DSL Code Editor */}
        {showDslPane && (
          <div style={{ width: 410, height: '100%' }}>
            <DslEditorPane
              dslText={dslText}
              diagnostics={model.diagnostics}
              onChangeDsl={setDslText}
              onApplyAutoLayout={handleApplyAutoLayout}
            />
          </div>
        )}

        {/* Center: Interactive Canvas + Bottom Step Timeline Player */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            minWidth: 0,
            height: '100%',
          }}
        >
          <div style={{ flex: 1, minHeight: 0 }}>
            <CanvasPane
              model={model}
              activeStepIndex={effectiveStepIndex}
              isPlaying={isPlaying}
              playbackSpeed={playbackSpeed}
              selected={selected}
              onSelect={setSelected}
              onMoveNodesAndGroups={handleMoveNodesAndGroups}
              onCreateEdge={handleCreateEdge}
              onAdvanceStep={handleAdvanceStep}
            />
          </div>

          {/* Bottom Step Player Dock */}
          <div
            style={{
              background: '#0f172a',
              borderTop: '1px solid #1e293b',
              padding: '12px 18px',
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: 16,
              }}
            >
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    fontSize: 13.5,
                    fontWeight: 700,
                    color: '#60a5fa',
                    marginBottom: 3,
                  }}
                >
                  {activeStep
                    ? `Step ${activeStep.stepNumber}: ${activeStep.title}`
                    : '全体構成ビュー (Overview)'}
                </div>
                <div style={{ fontSize: 12, color: '#cbd5e1', lineHeight: 1.45 }}>
                  {activeStep
                    ? activeStep.description
                    : '全要素を表示しています。下のStepタブを選択するか「自動再生」を押すと、ステップごとの通信・状態変化を可視化します。'}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <button
                  className="dav-toolbar-btn"
                  onClick={() => {
                    if (model.steps.length === 0) return;
                    setIsPlaying(false);
                    setActiveStepIndex((prev) =>
                      prev === null || prev <= 0 ? model.steps.length - 1 : prev - 1
                    );
                  }}
                >
                  ◀ 前へ
                </button>
                <button
                  className="dav-btn-primary"
                  onClick={() => {
                    if (effectiveStepIndex === null && model.steps.length > 0) {
                      setActiveStepIndex(0);
                    }
                    setIsPlaying((p) => !p);
                  }}
                >
                  {isPlaying ? '⏸ 一時停止' : '▶ 自動再生'}
                </button>
                <button
                  className="dav-toolbar-btn"
                  onClick={() => {
                    if (model.steps.length === 0) return;
                    setIsPlaying(false);
                    setActiveStepIndex((prev) =>
                      prev === null || prev >= model.steps.length - 1 ? 0 : prev + 1
                    );
                  }}
                >
                  次へ ▶
                </button>
                <select
                  className="dav-input"
                  style={{ width: 68 }}
                  value={playbackSpeed}
                  onChange={(e) => setPlaybackSpeed(Number(e.target.value))}
                >
                  <option value={0.7}>0.7x</option>
                  <option value={1}>1.0x</option>
                  <option value={1.5}>1.5x</option>
                  <option value={2}>2.0x</option>
                </select>
              </div>
            </div>

            {/* Step Selector Pills */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <button
                className="dav-toolbar-btn"
                style={{
                  borderRadius: 999,
                  background:
                    effectiveStepIndex === null ? 'rgba(37, 99, 235, 0.25)' : '#1e293b',
                  borderColor: effectiveStepIndex === null ? '#3b82f6' : '#334155',
                  color: effectiveStepIndex === null ? '#60a5fa' : '#94a3b8',
                }}
                onClick={() => {
                  setIsPlaying(false);
                  setActiveStepIndex(null);
                }}
              >
                全体図
              </button>
              {model.steps.map((st, idx) => {
                const isAct = effectiveStepIndex === idx;
                return (
                  <button
                    key={st.id}
                    className="dav-toolbar-btn"
                    style={{
                      borderRadius: 999,
                      background: isAct ? 'rgba(37, 99, 235, 0.25)' : '#1e293b',
                      borderColor: isAct ? '#3b82f6' : '#334155',
                      color: isAct ? '#60a5fa' : '#cbd5e1',
                    }}
                    onClick={() => setActiveStepIndex(idx)}
                  >
                    Step {st.stepNumber}: {st.title}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right: GUI Element & Step Inspector */}
        {showInspectorPane && (
          <StepInspector
            model={model}
            activeStepIndex={effectiveStepIndex}
            selected={selected}
            onSelectStep={setActiveStepIndex}
            onUpdateModel={handleUpdateModel}
            onClearSelection={() => setSelected(null)}
          />
        )}
      </div>
    </div>
  );
};
