import React, { useState } from 'react';
import { AI_AGENT_PROMPT_GUIDE } from '../core/samples';
import { DiagramParseDiagnostic } from '../core/types';

interface DslEditorPaneProps {
  dslText: string;
  diagnostics: DiagramParseDiagnostic[];
  onChangeDsl: (nextDsl: string) => void;
  onApplyAutoLayout: () => void;
}

export const DslEditorPane: React.FC<DslEditorPaneProps> = ({
  dslText,
  diagnostics,
  onChangeDsl,
  onApplyAutoLayout,
}) => {
  const [copiedAiGuide, setCopiedAiGuide] = useState(false);

  const handleCopyAiGuide = async () => {
    const promptText = `${AI_AGENT_PROMPT_GUIDE}\n## 現在のDSLコード\n\`\`\`text\n${dslText.trim()}\n\`\`\`\n`;
    await navigator.clipboard.writeText(promptText);
    setCopiedAiGuide(true);
    setTimeout(() => setCopiedAiGuide(false), 1800);
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: '#0f172a',
        borderRight: '1px solid #1e293b',
      }}
    >
      {/* Pane Header */}
      <div
        style={{
          padding: '10px 14px',
          borderBottom: '1px solid #1e293b',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          background: '#0b1120',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0' }}>
            DSL コードエディタ (双方向同期)
          </span>
          <span
            style={{
              fontSize: 10,
              padding: '2px 6px',
              borderRadius: 4,
              background:
                diagnostics.length === 0
                  ? 'rgba(16, 185, 129, 0.15)'
                  : 'rgba(245, 158, 11, 0.2)',
              color: diagnostics.length === 0 ? '#34d399' : '#fbbf24',
              fontWeight: 600,
            }}
          >
            {diagnostics.length === 0 ? 'SYNC OK' : `${diagnostics.length} 件の通知`}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            className="dav-toolbar-btn"
            onClick={onApplyAutoLayout}
            title="全ノード・グループの座標を自動計算してDSLに反映します"
          >
            自動整列
          </button>
          <button
            className="dav-toolbar-btn"
            onClick={handleCopyAiGuide}
            title="Cursor等のAIエージェントに指示するためのDSL仕様＋現在のコードをコピーします"
            style={{
              borderColor: copiedAiGuide ? '#10b981' : '#3b82f6',
              color: copiedAiGuide ? '#34d399' : '#93c5fd',
            }}
          >
            {copiedAiGuide ? '✓ コピー完了' : 'AI用プロンプトコピー'}
          </button>
        </div>
      </div>

      {/* Textarea */}
      <div style={{ position: 'relative', flex: 1, display: 'flex' }}>
        <textarea
          value={dslText}
          onChange={(e) => onChangeDsl(e.target.value)}
          spellCheck={false}
          placeholder="ここに構成図・画面遷移図のDSLを入力..."
          style={{
            width: '100%',
            height: '100%',
            resize: 'none',
            border: 'none',
            outline: 'none',
            background: '#020617',
            color: '#e2e8f0',
            padding: '14px 16px',
            fontFamily:
              'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace',
            fontSize: 12.5,
            lineHeight: 1.6,
            tabSize: 2,
          }}
        />
      </div>

      {/* Diagnostics Footer */}
      {diagnostics.length > 0 && (
        <div
          style={{
            maxHeight: 110,
            overflowY: 'auto',
            background: '#1e1b4b',
            borderTop: '1px solid #312e81',
            padding: '8px 12px',
            fontSize: 11.5,
          }}
        >
          {diagnostics.map((d, idx) => (
            <div
              key={idx}
              style={{
                color: d.severity === 'error' ? '#fca5a5' : '#fde68a',
                marginBottom: 4,
              }}
            >
              <strong>Line {d.line}:</strong> {d.message}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
