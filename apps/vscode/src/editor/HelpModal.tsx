import { useEffect, useRef, useState } from 'react';
import { ICON_META } from '../model/icons';
import { ICON_NAMES, NODE_STATUSES } from '../model/types';
import { buildAiPrompt } from '../prompt';

export interface HelpModalProps {
  open: boolean;
  locale: 'ja' | 'en';
  currentDsl: string;
  onClose: () => void;
}

const STRINGS = {
  ja: {
    title: 'AI プロンプト & DSL v1 リファレンス',
    tabPrompt: 'AIプロンプト生成',
    tabRef: 'DSL リファレンス & 操作方法',
    includeCurrent: '編集中の DSL コードをプロンプト末尾に含める',
    copyPrompt: 'プロンプトをコピー',
    copied: 'コピーしました！',
    close: '閉じる',
    promptDesc:
      'Claude Code / Antigravity / ChatGPT / Copilot 等の AI エージェントにこのプロンプトを貼り付けると、文法エラーのない dav 1 コードを一発で生成・修正できます。',
    secSyntax: '基本構文チートシート',
    secIcons: '内蔵アイコン一覧（18種）',
    secStatuses: 'ステータス値（status）と矢印（arrow）',
    secShortcuts: 'キャンバス・プレイヤー操作方法',
    shortcuts: [
      ['クリック / ドラッグ', 'ノード・グループの選択と座標移動（グループ移動時は配下要素も追従）'],
      [
        'Shift + クリック / ドラッグ',
        '複数選択・矩形範囲選択（インスペクタで左/中央/右/上/下揃え）',
      ],
      ['ノード外周の青丸ドラッグ', '別ノードへドロップしてエッジ（-->）を接続'],
      ['選択枠の四角ハンドル', 'ノード・グループのサイズ変更 (@size)'],
      ['ダブルクリック', '該当する DSL 定義行へジャンプ'],
      ['← / → / Space / Home', 'ステップ移動・自動再生/一時停止・全体ビュー'],
    ],
  },
  en: {
    title: 'AI Prompt & DSL v1 Reference',
    tabPrompt: 'AI Prompt Generator',
    tabRef: 'DSL Reference & Shortcuts',
    includeCurrent: 'Include current DSL code at the end of the prompt',
    copyPrompt: 'Copy Prompt',
    copied: 'Copied!',
    close: 'Close',
    promptDesc:
      'Paste this prompt into Claude Code, Antigravity, ChatGPT, or Copilot so the AI generates valid dav 1 diagrams on the first try.',
    secSyntax: 'Syntax Cheat Sheet',
    secIcons: 'Built-in Icons (18)',
    secStatuses: 'Node Statuses & Edge Arrows',
    secShortcuts: 'Canvas & Player Controls',
    shortcuts: [
      ['Click / Drag', 'Select and move nodes or groups (moving a group moves its children)'],
      ['Shift + Click / Drag', 'Multi-select or marquee select (align in Inspector)'],
      ['Drag blue port dot', 'Drop onto another node to create an edge (-->)'],
      ['Resize handles', 'Resize selected node or group (@size)'],
      ['Double-click element', 'Jump to DSL definition in editor'],
      ['← / → / Space / Home', 'Prev/Next step, Play/Pause, Overview'],
    ],
  },
} as const;

export function HelpModal({ open, locale, currentDsl, onClose }: HelpModalProps) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [tab, setTab] = useState<'prompt' | 'ref'>('prompt');
  const [includeCurrent, setIncludeCurrent] = useState(false);
  const [copied, setCopied] = useState(false);

  const s = STRINGS[locale];
  const promptText = buildAiPrompt({
    locale,
    currentDsl,
    includeCurrentDsl: includeCurrent,
  });

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(promptText);
    } catch {
      textareaRef.current?.select();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  return (
    <dialog
      ref={dialogRef}
      className="help-dialog"
      aria-label={s.title}
      onClose={onClose}
      data-testid="help-dialog"
    >
      <div className="help-dialog-header">
        <strong>{s.title}</strong>
        <div className="help-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'prompt'}
            className={`tool-btn ${tab === 'prompt' ? 'active' : ''}`}
            onClick={() => setTab('prompt')}
            data-testid="help-tab-prompt"
          >
            {s.tabPrompt}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'ref'}
            className={`tool-btn ${tab === 'ref' ? 'active' : ''}`}
            onClick={() => setTab('ref')}
            data-testid="help-tab-ref"
          >
            {s.tabRef}
          </button>
        </div>
        <button type="button" className="tool-btn" onClick={onClose} data-testid="help-close-btn">
          {s.close}
        </button>
      </div>

      {tab === 'prompt' ? (
        <div className="help-dialog-body">
          <p className="inspector-hint">{s.promptDesc}</p>
          <div className="help-prompt-controls">
            <label className="field-checkbox">
              <input
                type="checkbox"
                checked={includeCurrent}
                onChange={(e) => setIncludeCurrent(e.target.checked)}
                data-testid="chk-include-current-dsl"
              />
              <span>{s.includeCurrent}</span>
            </label>
            <button
              type="button"
              className="tool-btn primary"
              onClick={handleCopy}
              data-testid="btn-copy-ai-prompt"
            >
              {copied ? s.copied : s.copyPrompt}
            </button>
          </div>
          <textarea
            ref={textareaRef}
            className="help-prompt-textarea"
            readOnly
            value={promptText}
            data-testid="ai-prompt-textarea"
          />
        </div>
      ) : (
        <div className="help-dialog-body help-ref-body">
          <section className="ref-block">
            <h4>{s.secSyntax}</h4>
            <pre className="ref-code">{`dav 1
title "Diagram Title"

group vpc "VPC" [color: #3b82f6] {
  node api "API" [icon: container, sub: "ECS", status: normal]
  node db  "DB"  [icon: database, badge: "PRIMARY"]
}

api --> db : "SQL" [color: #10b981]

step "1. Normal Request" {
  desc "Description shown in dock"
  focus vpc
  state api [status: active, badge: "200 OK"]
  animate api --> db : "SELECT" [color: #3b82f6, parallel: true]
}`}</pre>
          </section>

          <section className="ref-block">
            <h4>{s.secIcons}</h4>
            <div className="icon-catalog" data-testid="ref-icon-catalog">
              {ICON_NAMES.map((icon) => {
                const meta = ICON_META[icon];
                return (
                  <div key={icon} className="icon-card">
                    <span className="icon-dot" style={{ backgroundColor: meta.accentColor }} />
                    <code>{icon}</code>
                    <span className="icon-meta-label">{meta.category}</span>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="ref-block">
            <h4>{s.secStatuses}</h4>
            <p className="ref-inline-list">
              <strong>status:</strong>{' '}
              {NODE_STATUSES.map((st) => (
                <code key={st} className="ref-pill">
                  {st}
                </code>
              ))}
            </p>
            <p className="ref-inline-list">
              <strong>arrow:</strong>{' '}
              {(['-->', '-.->', '<-->', '<-.->'] as const).map((arr) => (
                <code key={arr} className="ref-pill">
                  {arr}
                </code>
              ))}
            </p>
          </section>

          <section className="ref-block">
            <h4>{s.secShortcuts}</h4>
            <table className="ref-table">
              <tbody>
                {s.shortcuts.map(([key, desc]) => (
                  <tr key={key}>
                    <td>
                      <code>{key}</code>
                    </td>
                    <td>{desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>
      )}
    </dialog>
  );
}
