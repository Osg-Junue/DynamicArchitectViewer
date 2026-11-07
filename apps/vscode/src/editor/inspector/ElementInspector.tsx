import { useEffect, useState } from 'react';
import {
  applyChanges,
  removeElement,
  renameId,
  setAttribute,
  setLabel,
  setPlacement,
} from '../../dsl';
import type { Layout, Rect } from '../../layout';
import {
  type DavDocument,
  ICON_NAMES,
  type IconName,
  NODE_STATUSES,
  type NodeStatus,
} from '../../model/types';
import { type AlignMode, alignRects } from '../canvas/snap';
import type { PushOptions } from '../history';

export interface ElementInspectorProps {
  dsl: string;
  document: DavDocument;
  layout: Layout;
  locale: 'ja' | 'en';
  selectedIds: ReadonlySet<string>;
  onSelectIds: (ids: Set<string>) => void;
  onApplyDsl: (nextDsl: string, options?: PushOptions) => void;
  onJumpToElement: (id: string) => void;
}

const T = {
  ja: {
    emptyHint:
      'キャンバス上のノード・グループ・エッジをクリックして選択すると、ここで属性を編集できます（Shift+クリックやShift+ドラッグで複数選択）。',
    multiSelected: (n: number) => `${n} 個の要素を選択中`,
    align: '整列',
    alignLeft: '左揃え',
    alignCenter: '左右中央',
    alignRight: '右揃え',
    alignTop: '上揃え',
    alignMiddle: '上下中央',
    alignBottom: '下揃え',
    resetAuto: '自動配置に戻す',
    deleteAll: '選択要素を削除',
    id: 'ID',
    rename: '変更',
    label: 'ラベル',
    icon: 'アイコン',
    status: '状態 (status)',
    sub: 'サブラベル (sub)',
    badge: 'バッジ (badge)',
    color: 'カラー (color)',
    clearColor: 'クリア',
    active: '強調表示 (active)',
    placement: '座標・サイズ',
    jumpCode: 'コードへ移動',
    delete: '要素を削除',
  },
  en: {
    emptyHint:
      'Click a node, group, or edge on the canvas to edit its properties (Shift+Click or Shift+Drag for multi-select).',
    multiSelected: (n: number) => `${n} elements selected`,
    align: 'Align',
    alignLeft: 'Left',
    alignCenter: 'Center',
    alignRight: 'Right',
    alignTop: 'Top',
    alignMiddle: 'Middle',
    alignBottom: 'Bottom',
    resetAuto: 'Reset to Auto Layout',
    deleteAll: 'Delete Selected',
    id: 'ID',
    rename: 'Rename',
    label: 'Label',
    icon: 'Icon',
    status: 'Status',
    sub: 'Sublabel (sub)',
    badge: 'Badge',
    color: 'Color',
    clearColor: 'Clear',
    active: 'Active Highlight',
    placement: 'Position & Size',
    jumpCode: 'Jump to Code',
    delete: 'Delete Element',
  },
} as const;

export function ElementInspector({
  dsl,
  document,
  layout,
  locale,
  selectedIds,
  onSelectIds,
  onApplyDsl,
  onJumpToElement,
}: ElementInspectorProps) {
  const s = T[locale];
  const ids = Array.from(selectedIds);
  const singleId = ids.length === 1 ? (ids[0] ?? null) : null;

  const node = singleId ? document.nodes.find((n) => n.id === singleId) : undefined;
  const group = singleId ? document.groups.find((g) => g.id === singleId) : undefined;
  const edge = singleId ? document.edges.find((e) => e.id === singleId) : undefined;

  const [idDraft, setIdDraft] = useState(singleId ?? '');
  const [renameError, setRenameError] = useState<string | null>(null);

  useEffect(() => {
    setIdDraft(singleId ?? '');
    setRenameError(null);
  }, [singleId]);

  if (ids.length === 0) {
    return (
      <div className="inspector-section">
        <p className="inspector-hint">{s.emptyHint}</p>
      </div>
    );
  }

  if (ids.length > 1) {
    const items: Array<{ id: string; rect: Rect }> = [];
    for (const id of ids) {
      const r = layout.nodes[id] ?? layout.groups[id];
      if (r) items.push({ id, rect: r });
    }

    const handleAlign = (mode: AlignMode) => {
      const aligned = alignRects(items, mode);
      let nextDsl = dsl;
      for (const [id, pos] of aligned) {
        try {
          nextDsl = applyChanges(nextDsl, setPlacement(nextDsl, id, { pos }));
        } catch {
          // Ignore non-placeable items
        }
      }
      onApplyDsl(nextDsl);
    };

    const handleResetPlacement = () => {
      let nextDsl = dsl;
      for (const id of ids) {
        try {
          nextDsl = applyChanges(nextDsl, setPlacement(nextDsl, id, { pos: null, size: null }));
        } catch {
          // Ignore edges
        }
      }
      onApplyDsl(nextDsl);
    };

    const handleDeleteAll = () => {
      let nextDsl = dsl;
      for (const id of ids) {
        try {
          nextDsl = applyChanges(nextDsl, removeElement(nextDsl, id));
        } catch {
          // Ignore already removed children
        }
      }
      onApplyDsl(nextDsl);
      onSelectIds(new Set());
    };

    return (
      <div className="inspector-section" data-testid="multi-inspector">
        <div className="inspector-title">{s.multiSelected(ids.length)}</div>
        {items.length >= 2 && (
          <div className="inspector-field">
            <span className="field-label">{s.align}</span>
            <div className="align-grid">
              <button
                type="button"
                className="tool-btn"
                onClick={() => handleAlign('left')}
                data-testid="align-left"
              >
                {s.alignLeft}
              </button>
              <button
                type="button"
                className="tool-btn"
                onClick={() => handleAlign('center')}
                data-testid="align-center"
              >
                {s.alignCenter}
              </button>
              <button
                type="button"
                className="tool-btn"
                onClick={() => handleAlign('right')}
                data-testid="align-right"
              >
                {s.alignRight}
              </button>
              <button
                type="button"
                className="tool-btn"
                onClick={() => handleAlign('top')}
                data-testid="align-top"
              >
                {s.alignTop}
              </button>
              <button
                type="button"
                className="tool-btn"
                onClick={() => handleAlign('middle')}
                data-testid="align-middle"
              >
                {s.alignMiddle}
              </button>
              <button
                type="button"
                className="tool-btn"
                onClick={() => handleAlign('bottom')}
                data-testid="align-bottom"
              >
                {s.alignBottom}
              </button>
            </div>
          </div>
        )}
        <div className="inspector-actions">
          <button type="button" className="tool-btn" onClick={handleResetPlacement}>
            {s.resetAuto}
          </button>
          <button type="button" className="tool-btn danger" onClick={handleDeleteAll}>
            {s.deleteAll}
          </button>
        </div>
      </div>
    );
  }

  const target = node ?? group ?? edge;
  if (!target || !singleId) {
    return (
      <div className="inspector-section">
        <p className="inspector-hint">{s.emptyHint}</p>
      </div>
    );
  }

  const kindLabel = node ? 'Node' : group ? 'Group' : 'Edge';
  const currentLabel = node ? node.label : group ? group.label : (edge?.label ?? '');
  const currentColor = target.color ?? '';

  const handleRename = () => {
    const trimmed = idDraft.trim();
    if (!trimmed || trimmed === singleId) return;
    try {
      const changes = renameId(dsl, singleId, trimmed);
      onApplyDsl(applyChanges(dsl, changes));
      onSelectIds(new Set([trimmed]));
      setRenameError(null);
    } catch (err) {
      setRenameError(err instanceof Error ? err.message : 'Invalid ID');
    }
  };

  const handleLabelChange = (value: string) => {
    try {
      const changes = setLabel(dsl, singleId, value.length > 0 ? value : undefined);
      onApplyDsl(applyChanges(dsl, changes), { coalesceKey: `label-${singleId}` });
    } catch {
      // Ignore transient edit error
    }
  };

  const handleAttrChange = (key: string, value: string | boolean | null) => {
    try {
      const changes = setAttribute(dsl, singleId, key, value === null ? undefined : value);
      onApplyDsl(applyChanges(dsl, changes), { coalesceKey: `attr-${singleId}-${key}` });
    } catch {
      // Ignore invalid color until 7 chars
    }
  };

  const handleResetPlacement = () => {
    try {
      const changes = setPlacement(dsl, singleId, { pos: null, size: null });
      onApplyDsl(applyChanges(dsl, changes));
    } catch {
      // Ignore
    }
  };

  const handleDelete = () => {
    try {
      const changes = removeElement(dsl, singleId);
      onApplyDsl(applyChanges(dsl, changes));
      onSelectIds(new Set());
    } catch {
      // Ignore
    }
  };

  const rect = layout.nodes[singleId] ?? layout.groups[singleId];

  return (
    <div className="inspector-section" data-testid="element-inspector">
      <div className="inspector-header-row">
        <span className="inspector-badge">{kindLabel}</span>
        <code className="inspector-id">{singleId}</code>
      </div>

      {/* Rename ID (for nodes and groups) */}
      {(node || group) && (
        <div className="inspector-field">
          <label className="field-label" htmlFor="inspector-id-input">
            {s.id}
          </label>
          <div className="field-row">
            <input
              id="inspector-id-input"
              className="field-input"
              type="text"
              value={idDraft}
              onChange={(e) => setIdDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleRename();
              }}
              data-testid="inspector-id-input"
            />
            <button
              type="button"
              className="tool-btn"
              onClick={handleRename}
              disabled={idDraft.trim() === singleId}
              data-testid="inspector-rename-btn"
            >
              {s.rename}
            </button>
          </div>
          {renameError && <div className="field-error">{renameError}</div>}
        </div>
      )}

      {/* Label */}
      <div className="inspector-field">
        <label className="field-label" htmlFor="inspector-label-input">
          {s.label}
        </label>
        <input
          id="inspector-label-input"
          className="field-input"
          type="text"
          value={currentLabel}
          onChange={(e) => handleLabelChange(e.target.value)}
          data-testid="inspector-label-input"
        />
      </div>

      {/* Node-specific attributes */}
      {node && (
        <>
          <div className="inspector-field">
            <label className="field-label" htmlFor="inspector-icon-select">
              {s.icon}
            </label>
            <select
              id="inspector-icon-select"
              className="field-select"
              value={node.icon}
              onChange={(e) => handleAttrChange('icon', e.target.value as IconName)}
              data-testid="inspector-icon-select"
            >
              {ICON_NAMES.map((icon) => (
                <option key={icon} value={icon}>
                  {icon}
                </option>
              ))}
            </select>
          </div>

          <div className="inspector-field">
            <label className="field-label" htmlFor="inspector-status-select">
              {s.status}
            </label>
            <select
              id="inspector-status-select"
              className="field-select"
              value={node.status}
              onChange={(e) =>
                handleAttrChange(
                  'status',
                  e.target.value === 'normal' ? null : (e.target.value as NodeStatus),
                )
              }
              data-testid="inspector-status-select"
            >
              {NODE_STATUSES.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
          </div>

          <div className="inspector-field">
            <label className="field-label" htmlFor="inspector-sub-input">
              {s.sub}
            </label>
            <input
              id="inspector-sub-input"
              className="field-input"
              type="text"
              value={node.sub ?? ''}
              onChange={(e) => handleAttrChange('sub', e.target.value || null)}
              data-testid="inspector-sub-input"
            />
          </div>

          <div className="inspector-field">
            <label className="field-label" htmlFor="inspector-badge-input">
              {s.badge}
            </label>
            <input
              id="inspector-badge-input"
              className="field-input"
              type="text"
              value={node.badge ?? ''}
              onChange={(e) => handleAttrChange('badge', e.target.value || null)}
              data-testid="inspector-badge-input"
            />
          </div>
        </>
      )}

      {/* Color */}
      <div className="inspector-field">
        <label className="field-label" htmlFor="inspector-color-input">
          {s.color}
        </label>
        <div className="field-row">
          <input
            id="inspector-color-input"
            className="field-color"
            type="color"
            value={/^#[0-9a-fA-F]{6}$/.test(currentColor) ? currentColor : '#3b82f6'}
            onChange={(e) => handleAttrChange('color', e.target.value)}
            data-testid="inspector-color-input"
          />
          <code className="color-code">{currentColor || 'auto'}</code>
          {currentColor && (
            <button
              type="button"
              className="tool-btn"
              onClick={() => handleAttrChange('color', null)}
            >
              {s.clearColor}
            </button>
          )}
        </div>
      </div>

      {/* Visible toggle for node or edge */}
      {(node || edge) && (
        <div className="inspector-field">
          <label className="field-checkbox">
            <input
              type="checkbox"
              checked={Boolean((node ?? edge)?.visible)}
              onChange={(e) => handleAttrChange('visible', e.target.checked ? null : false)}
              data-testid="inspector-visible-checkbox"
            />
            <span>{s.active}</span>
          </label>
        </div>
      )}

      {/* Placement summary and reset */}
      {(node || group) && rect && (
        <div className="inspector-field">
          <span className="field-label">{s.placement}</span>
          <div className="placement-row">
            <code>
              ({Math.round(rect.x)}, {Math.round(rect.y)}) · {Math.round(rect.width)}×
              {Math.round(rect.height)}
            </code>
            {((node ?? group)?.pos || (node ?? group)?.size) && (
              <button
                type="button"
                className="tool-btn"
                onClick={handleResetPlacement}
                data-testid="inspector-reset-placement"
              >
                {s.resetAuto}
              </button>
            )}
          </div>
        </div>
      )}

      <div className="inspector-actions">
        <button
          type="button"
          className="tool-btn"
          onClick={() => onJumpToElement(singleId)}
          data-testid="inspector-jump-btn"
        >
          {s.jumpCode}
        </button>
        <button
          type="button"
          className="tool-btn danger"
          onClick={handleDelete}
          data-testid="inspector-delete-btn"
        >
          {s.delete}
        </button>
      </div>
    </div>
  );
}
