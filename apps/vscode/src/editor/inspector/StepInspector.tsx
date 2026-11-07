import { useState } from 'react';
import {
  addStep,
  applyChanges,
  insertStepStatement,
  listStepStatements,
  moveStep,
  removeStep,
  removeStepStatement,
  replaceStepStatement,
  setStepTitle,
} from '../../dsl';
import { type DavDocument, NODE_STATUSES, type NodeStatus } from '../../model/types';
import type { PushOptions } from '../history';

export interface StepInspectorProps {
  dsl: string;
  document: DavDocument;
  locale: 'ja' | 'en';
  activeStepIndex: number | null;
  onActiveStepChange: (stepIndex: number | null) => void;
  onApplyDsl: (nextDsl: string, options?: PushOptions) => void;
  onJumpToStep: (stepIndex: number) => void;
}

const T = {
  ja: {
    stepsHeader: 'ステップ・タイムライン',
    addStep: '+ ステップ追加',
    overview: '全体ビュー',
    title: 'ステップ名',
    desc: '説明文 (desc)',
    focus: 'フォーカス対象 (focus)',
    states: '状態オーバーライド (state)',
    addState: '+ 状態変更を追加',
    animations: 'アニメーション (animate)',
    addAnim: '+ アニメーション追加',
    parallel: '並列 (parallel)',
    moveUp: '↑',
    moveDown: '↓',
    jumpCode: 'コードへ移動',
    deleteStep: 'ステップ削除',
    noStepSelected: 'ステップを選択するか「+ ステップ追加」を押して時系列シナリオを編集します。',
  },
  en: {
    stepsHeader: 'Steps & Timeline',
    addStep: '+ Add Step',
    overview: 'Overview',
    title: 'Step Title',
    desc: 'Description (desc)',
    focus: 'Focus Targets (focus)',
    states: 'State Overrides (state)',
    addState: '+ Add State Override',
    animations: 'Packet Animations (animate)',
    addAnim: '+ Add Animation',
    parallel: 'Parallel',
    moveUp: '↑',
    moveDown: '↓',
    jumpCode: 'Jump to Code',
    deleteStep: 'Delete Step',
    noStepSelected: 'Select a step or click "+ Add Step" to author time-stepped scenarios.',
  },
} as const;

export function StepInspector({
  dsl,
  document,
  locale,
  activeStepIndex,
  onActiveStepChange,
  onApplyDsl,
  onJumpToStep,
}: StepInspectorProps) {
  const s = T[locale];
  const steps = document.steps;
  const activeStep = activeStepIndex !== null ? steps[activeStepIndex] : undefined;

  const allTargets = [
    ...document.nodes.map((n) => ({ id: n.id, label: n.label })),
    ...document.groups.map((g) => ({ id: g.id, label: g.label })),
  ];
  const nodeIds = document.nodes.map((n) => n.id);

  const [newStateTarget, setNewStateTarget] = useState('');
  const [newStateStatus, setNewStateStatus] = useState<NodeStatus>('active');
  const [newStateBadge, setNewStateBadge] = useState('');

  const [newAnimFrom, setNewAnimFrom] = useState('');
  const [newAnimTo, setNewAnimTo] = useState('');
  const [newAnimLabel, setNewAnimLabel] = useState('');
  const [newAnimParallel, setNewAnimParallel] = useState(false);

  const handleAddStep = () => {
    const nextNum = steps.length + 1;
    try {
      const changes = addStep(dsl, {
        title: `Step ${nextNum}`,
        statements: [{ kind: 'desc', text: `Step ${nextNum} description` }],
      });
      onApplyDsl(applyChanges(dsl, changes));
      onActiveStepChange(steps.length);
    } catch {
      // Ignore if syntax error blocks insertion
    }
  };

  if (activeStepIndex === null || !activeStep) {
    return (
      <div className="inspector-section" data-testid="step-inspector">
        <div className="inspector-header-row">
          <span className="inspector-title">{s.stepsHeader}</span>
          <button
            type="button"
            className="tool-btn primary"
            onClick={handleAddStep}
            data-testid="btn-add-step"
          >
            {s.addStep}
          </button>
        </div>
        <div className="step-chip-list">
          <button
            type="button"
            className="step-chip active"
            onClick={() => onActiveStepChange(null)}
          >
            {s.overview}
          </button>
          {steps.map((st) => (
            <button
              key={`step-chip-${st.index}`}
              type="button"
              className="step-chip"
              onClick={() => onActiveStepChange(st.index)}
              data-testid={`step-chip-${st.index}`}
            >
              {st.index + 1}. {st.title}
            </button>
          ))}
        </div>
        <p className="inspector-hint">{s.noStepSelected}</p>
      </div>
    );
  }

  const indexedStatements = listStepStatements(dsl, activeStepIndex);
  const descStmt = indexedStatements.find((st) => st.kind === 'desc');
  const focusStmt = indexedStatements.find((st) => st.kind === 'focus');
  const stateStmts = indexedStatements.filter((st) => st.kind === 'state');
  const animStmts = indexedStatements.filter((st) => st.kind === 'animate');

  const handleTitleChange = (title: string) => {
    try {
      const changes = setStepTitle(dsl, activeStepIndex, title);
      onApplyDsl(applyChanges(dsl, changes), { coalesceKey: `step-title-${activeStepIndex}` });
    } catch {
      // Ignore
    }
  };

  const handleDescChange = (text: string) => {
    try {
      if (descStmt) {
        if (text.length === 0) {
          onApplyDsl(
            applyChanges(dsl, removeStepStatement(dsl, activeStepIndex, descStmt.statementIndex)),
          );
        } else {
          onApplyDsl(
            applyChanges(
              dsl,
              replaceStepStatement(dsl, activeStepIndex, descStmt.statementIndex, {
                kind: 'desc',
                text,
              }),
            ),
            { coalesceKey: `step-desc-${activeStepIndex}` },
          );
        }
      } else if (text.length > 0) {
        onApplyDsl(
          applyChanges(dsl, insertStepStatement(dsl, activeStepIndex, { kind: 'desc', text })),
          { coalesceKey: `step-desc-${activeStepIndex}` },
        );
      }
    } catch {
      // Ignore
    }
  };

  const handleToggleFocus = (targetId: string) => {
    const current = new Set(activeStep.focus);
    if (current.has(targetId)) current.delete(targetId);
    else current.add(targetId);
    const nextIds = Array.from(current);

    try {
      if (focusStmt) {
        if (nextIds.length === 0) {
          onApplyDsl(
            applyChanges(dsl, removeStepStatement(dsl, activeStepIndex, focusStmt.statementIndex)),
          );
        } else {
          onApplyDsl(
            applyChanges(
              dsl,
              replaceStepStatement(dsl, activeStepIndex, focusStmt.statementIndex, {
                kind: 'focus',
                ids: nextIds,
              }),
            ),
          );
        }
      } else if (nextIds.length > 0) {
        onApplyDsl(
          applyChanges(
            dsl,
            insertStepStatement(dsl, activeStepIndex, { kind: 'focus', ids: nextIds }),
          ),
        );
      }
    } catch {
      // Ignore
    }
  };

  const handleAddStateOverride = () => {
    const target = newStateTarget || allTargets[0]?.id;
    if (!target) return;
    const attrs: Record<string, string | boolean> = { status: newStateStatus };
    if (newStateBadge.trim()) attrs.badge = newStateBadge.trim();
    try {
      const changes = insertStepStatement(dsl, activeStepIndex, {
        kind: 'state',
        target,
        attrs,
      });
      onApplyDsl(applyChanges(dsl, changes));
      setNewStateBadge('');
    } catch {
      // Ignore
    }
  };

  const handleAddAnimation = () => {
    const from = newAnimFrom || nodeIds[0];
    const to = newAnimTo || nodeIds[1] || nodeIds[0];
    if (!from || !to) return;
    const attrs: Record<string, string | boolean> = {};
    if (newAnimParallel) attrs.parallel = true;
    try {
      const changes = insertStepStatement(dsl, activeStepIndex, {
        kind: 'animate',
        from,
        to,
        ...(newAnimLabel.trim() ? { label: newAnimLabel.trim() } : {}),
        ...(Object.keys(attrs).length > 0 ? { attrs } : {}),
      });
      onApplyDsl(applyChanges(dsl, changes));
      setNewAnimLabel('');
    } catch {
      // Ignore
    }
  };

  const handleMoveStep = (delta: -1 | 1) => {
    const to = activeStepIndex + delta;
    if (to < 0 || to >= steps.length) return;
    try {
      const changes = moveStep(dsl, activeStepIndex, to);
      onApplyDsl(applyChanges(dsl, changes));
      onActiveStepChange(to);
    } catch {
      // Ignore
    }
  };

  const handleDeleteStep = () => {
    try {
      const changes = removeStep(dsl, activeStepIndex);
      onApplyDsl(applyChanges(dsl, changes));
      onActiveStepChange(steps.length > 1 ? Math.max(0, activeStepIndex - 1) : null);
    } catch {
      // Ignore
    }
  };

  return (
    <div className="inspector-section" data-testid="step-inspector">
      <div className="inspector-header-row">
        <span className="inspector-title">{s.stepsHeader}</span>
        <button
          type="button"
          className="tool-btn primary"
          onClick={handleAddStep}
          data-testid="btn-add-step"
        >
          {s.addStep}
        </button>
      </div>

      {/* Step selector chips */}
      <div className="step-chip-list">
        <button type="button" className="step-chip" onClick={() => onActiveStepChange(null)}>
          {s.overview}
        </button>
        {steps.map((st) => (
          <button
            key={`step-chip-${st.index}`}
            type="button"
            className={`step-chip ${st.index === activeStepIndex ? 'active' : ''}`}
            onClick={() => onActiveStepChange(st.index)}
            data-testid={`step-chip-${st.index}`}
          >
            {st.index + 1}. {st.title}
          </button>
        ))}
      </div>

      {/* Step title & ordering */}
      <div className="inspector-field">
        <div className="field-header-row">
          <label className="field-label" htmlFor="step-title-input">
            {s.title} ({activeStepIndex + 1}/{steps.length})
          </label>
          <div className="field-row">
            <button
              type="button"
              className="tool-btn"
              disabled={activeStepIndex === 0}
              onClick={() => handleMoveStep(-1)}
              title="Move up"
              data-testid="btn-step-up"
            >
              {s.moveUp}
            </button>
            <button
              type="button"
              className="tool-btn"
              disabled={activeStepIndex === steps.length - 1}
              onClick={() => handleMoveStep(1)}
              title="Move down"
              data-testid="btn-step-down"
            >
              {s.moveDown}
            </button>
          </div>
        </div>
        <input
          id="step-title-input"
          className="field-input"
          type="text"
          value={activeStep.title}
          onChange={(e) => handleTitleChange(e.target.value)}
          data-testid="step-title-input"
        />
      </div>

      {/* Step description */}
      <div className="inspector-field">
        <label className="field-label" htmlFor="step-desc-input">
          {s.desc}
        </label>
        <input
          id="step-desc-input"
          className="field-input"
          type="text"
          value={activeStep.description ?? ''}
          onChange={(e) => handleDescChange(e.target.value)}
          data-testid="step-desc-input"
        />
      </div>

      {/* Focus targets */}
      {allTargets.length > 0 && (
        <div className="inspector-field">
          <span className="field-label">{s.focus}</span>
          <div className="focus-chip-grid">
            {allTargets.map((item) => {
              const focused = activeStep.focus.includes(item.id);
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`focus-chip ${focused ? 'active' : ''}`}
                  aria-pressed={focused}
                  onClick={() => handleToggleFocus(item.id)}
                  data-testid={`focus-chip-${item.id}`}
                >
                  {item.id}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* State overrides */}
      <div className="inspector-field">
        <span className="field-label">{s.states}</span>
        <ul className="stmt-list">
          {activeStep.states.map((st, idx) => {
            const stmtInfo = stateStmts[idx];
            return (
              <li key={`state-${stmtInfo?.statementIndex ?? st.target}`} className="stmt-item">
                <code>
                  {st.target}: {st.status ?? ''} {st.badge ? `[${st.badge}]` : ''}
                </code>
                {stmtInfo && (
                  <button
                    type="button"
                    className="stmt-del-btn"
                    onClick={() =>
                      onApplyDsl(
                        applyChanges(
                          dsl,
                          removeStepStatement(dsl, activeStepIndex, stmtInfo.statementIndex),
                        ),
                      )
                    }
                    aria-label={`Remove state ${st.target}`}
                  >
                    ×
                  </button>
                )}
              </li>
            );
          })}
        </ul>
        {allTargets.length > 0 && (
          <div className="stmt-add-box">
            <div className="field-row">
              <select
                className="field-select"
                value={newStateTarget || allTargets[0]?.id || ''}
                onChange={(e) => setNewStateTarget(e.target.value)}
                aria-label="State target"
                data-testid="new-state-target"
              >
                {allTargets.map((tItem) => (
                  <option key={tItem.id} value={tItem.id}>
                    {tItem.id}
                  </option>
                ))}
              </select>
              <select
                className="field-select"
                value={newStateStatus}
                onChange={(e) => setNewStateStatus(e.target.value as NodeStatus)}
                aria-label="State status"
                data-testid="new-state-status"
              >
                {NODE_STATUSES.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </div>
            <div className="field-row">
              <input
                className="field-input"
                type="text"
                placeholder="Badge (optional)"
                value={newStateBadge}
                onChange={(e) => setNewStateBadge(e.target.value)}
                data-testid="new-state-badge"
              />
              <button
                type="button"
                className="tool-btn"
                onClick={handleAddStateOverride}
                data-testid="btn-add-state"
              >
                {s.addState}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Animations */}
      <div className="inspector-field">
        <span className="field-label">{s.animations}</span>
        <ul className="stmt-list">
          {activeStep.animations.map((anim, idx) => {
            const stmtInfo = animStmts[idx];
            return (
              <li
                key={`anim-${stmtInfo?.statementIndex ?? `${anim.from}-${anim.to}`}`}
                className="stmt-item"
              >
                <code>
                  {anim.from} → {anim.to} {anim.label ? `"${anim.label}"` : ''}{' '}
                  {anim.parallel ? '(parallel)' : ''}
                </code>
                {stmtInfo && (
                  <button
                    type="button"
                    className="stmt-del-btn"
                    onClick={() =>
                      onApplyDsl(
                        applyChanges(
                          dsl,
                          removeStepStatement(dsl, activeStepIndex, stmtInfo.statementIndex),
                        ),
                      )
                    }
                    aria-label={`Remove animation ${anim.from} to ${anim.to}`}
                  >
                    ×
                  </button>
                )}
              </li>
            );
          })}
        </ul>
        {nodeIds.length > 0 && (
          <div className="stmt-add-box">
            <div className="field-row">
              <select
                className="field-select"
                value={newAnimFrom || nodeIds[0] || ''}
                onChange={(e) => setNewAnimFrom(e.target.value)}
                aria-label="Animation from"
                data-testid="new-anim-from"
              >
                {nodeIds.map((id) => (
                  <option key={id} value={id}>
                    {id}
                  </option>
                ))}
              </select>
              <span>→</span>
              <select
                className="field-select"
                value={newAnimTo || nodeIds[1] || nodeIds[0] || ''}
                onChange={(e) => setNewAnimTo(e.target.value)}
                aria-label="Animation to"
                data-testid="new-anim-to"
              >
                {nodeIds.map((id) => (
                  <option key={id} value={id}>
                    {id}
                  </option>
                ))}
              </select>
            </div>
            <div className="field-row">
              <input
                className="field-input"
                type="text"
                placeholder="Packet label"
                value={newAnimLabel}
                onChange={(e) => setNewAnimLabel(e.target.value)}
                data-testid="new-anim-label"
              />
              <label className="field-checkbox">
                <input
                  type="checkbox"
                  checked={newAnimParallel}
                  onChange={(e) => setNewAnimParallel(e.target.checked)}
                />
                <span>{s.parallel}</span>
              </label>
              <button
                type="button"
                className="tool-btn"
                onClick={handleAddAnimation}
                data-testid="btn-add-anim"
              >
                {s.addAnim}
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="inspector-actions">
        <button
          type="button"
          className="tool-btn"
          onClick={() => onJumpToStep(activeStepIndex)}
          data-testid="btn-jump-step-code"
        >
          {s.jumpCode}
        </button>
        <button
          type="button"
          className="tool-btn danger"
          onClick={handleDeleteStep}
          data-testid="btn-delete-step"
        >
          {s.deleteStep}
        </button>
      </div>
    </div>
  );
}
