import React, { useState } from 'react';
import { ALL_ICON_TYPES, ICON_META_MAP } from '../core/icons';
import {
  DiagramModel,
  EdgeDirection,
  EdgeStyle,
  getDefaultNodeSize,
  NodeIconType,
  NodeStatus,
} from '../core/types';
import { SelectedElement } from './CanvasPane';

interface StepInspectorProps {
  model: DiagramModel;
  activeStepIndex: number | null;
  selected: SelectedElement;
  onSelectStep: (idx: number | null) => void;
  onUpdateModel: (nextModel: DiagramModel) => void;
  onClearSelection: () => void;
}

export const StepInspector: React.FC<StepInspectorProps> = ({
  model,
  activeStepIndex,
  selected,
  onSelectStep,
  onUpdateModel,
  onClearSelection,
}) => {
  const [newNodeIcon, setNewNodeIcon] = useState<NodeIconType>('server');
  const [newNodeLabel, setNewNodeLabel] = useState('');
  const [newNodeGroup, setNewNodeGroup] = useState('');

  // New animation form state inside current step
  const [animFrom, setAnimFrom] = useState('');
  const [animTo, setAnimTo] = useState('');
  const [animLabel, setAnimLabel] = useState('HTTP Request');
  const [animColor, setAnimColor] = useState('#3b82f6');

  const activeStep =
    activeStepIndex !== null && model.steps[activeStepIndex]
      ? model.steps[activeStepIndex]
      : null;

  const selectedNode =
    selected?.kind === 'node' ? model.nodes.find((n) => n.id === selected.id) : undefined;
  const selectedGroup =
    selected?.kind === 'group' ? model.groups.find((g) => g.id === selected.id) : undefined;
  const selectedEdge =
    selected?.kind === 'edge' ? model.edges.find((e) => e.id === selected.id) : undefined;

  // Add Node via GUI
  const handleAddNode = () => {
    const id = `node_${model.nodes.length + 1}`;
    const meta = ICON_META_MAP[newNodeIcon];
    const size = getDefaultNodeSize(newNodeIcon);
    const label = newNodeLabel.trim() || meta.label;

    const nextModel: DiagramModel = {
      ...model,
      nodes: [
        ...model.nodes,
        {
          id,
          label,
          icon: newNodeIcon,
          groupId: newNodeGroup || undefined,
          x: 120 + (model.nodes.length % 4) * 200,
          y: 120 + Math.floor(model.nodes.length / 4) * 120,
          width: size.width,
          height: size.height,
          hasExplicitPos: true,
          status: 'normal',
          visible: true,
        },
      ],
    };
    setNewNodeLabel('');
    onUpdateModel(nextModel);
  };

  // Add Group via GUI
  const handleAddGroup = () => {
    const id = `group_${model.groups.length + 1}`;
    const nextModel: DiagramModel = {
      ...model,
      groups: [
        ...model.groups,
        {
          id,
          label: `新規グループ ${model.groups.length + 1}`,
          x: 80 + model.groups.length * 40,
          y: 60 + model.groups.length * 40,
          width: 420,
          height: 260,
          hasExplicitPos: true,
          hasExplicitSize: true,
        },
      ],
    };
    onUpdateModel(nextModel);
  };

  // Add Step via GUI
  const handleAddStep = () => {
    const nextNum =
      model.steps.length > 0
        ? Math.max(...model.steps.map((s) => s.stepNumber)) + 1
        : 1;
    const firstNode = model.nodes[0]?.id;
    const secondNode = model.nodes[1]?.id;

    const nextStep = {
      id: String(nextNum),
      stepNumber: nextNum,
      title: `新規ステップ ${nextNum}`,
      description: 'このステップでのデータの流れや画面遷移を入力してください。',
      focusIds: [firstNode, secondNode].filter(Boolean) as string[],
      states: [],
      animations:
        firstNode && secondNode
          ? [{ from: firstNode, to: secondNode, label: 'Data Flow', color: '#3b82f6' }]
          : [],
    };

    const nextSteps = [...model.steps, nextStep];
    onUpdateModel({ ...model, steps: nextSteps });
    onSelectStep(nextSteps.length - 1);
  };

  const handleDeleteStep = (idx: number) => {
    const nextSteps = model.steps.filter((_, i) => i !== idx);
    onUpdateModel({ ...model, steps: nextSteps });
    onSelectStep(nextSteps.length > 0 ? Math.max(0, idx - 1) : null);
  };

  return (
    <aside
      style={{
        width: 330,
        background: '#0f172a',
        borderLeft: '1px solid #1e293b',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflowY: 'auto',
        fontSize: 12,
        color: '#e2e8f0',
      }}
    >
      {/* 1. Quick Add Toolbar */}
      <div style={{ padding: '12px 14px', borderBottom: '1px solid #1e293b' }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: '#94a3b8',
            textTransform: 'uppercase',
            marginBottom: 8,
          }}
        >
          GUI 要素追加
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', gap: 6 }}>
            <select
              className="dav-input"
              value={newNodeIcon}
              onChange={(e) => setNewNodeIcon(e.target.value as NodeIconType)}
              style={{ flex: 1 }}
            >
              <optgroup label="インフラ要素">
                {ALL_ICON_TYPES.filter((k) => ICON_META_MAP[k].category === 'infra').map((k) => (
                  <option key={k} value={k}>
                    {ICON_META_MAP[k].label} ({k})
                  </option>
                ))}
              </optgroup>
              <optgroup label="画面遷移・クライアント要素">
                {ALL_ICON_TYPES.filter((k) => ICON_META_MAP[k].category === 'screen').map((k) => (
                  <option key={k} value={k}>
                    {ICON_META_MAP[k].label} ({k})
                  </option>
                ))}
              </optgroup>
            </select>
            <select
              className="dav-input"
              value={newNodeGroup}
              onChange={(e) => setNewNodeGroup(e.target.value)}
              style={{ width: 105 }}
            >
              <option value="">(グループなし)</option>
              {model.groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.label}
                </option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              className="dav-input"
              placeholder="表示名 (省略時は標準名)"
              value={newNodeLabel}
              onChange={(e) => setNewNodeLabel(e.target.value)}
              style={{ flex: 1 }}
            />
            <button className="dav-btn-primary" onClick={handleAddNode}>
              ＋ ノード
            </button>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              className="dav-toolbar-btn"
              style={{ flex: 1, justifyContent: 'center' }}
              onClick={handleAddGroup}
            >
              ＋ グループ枠追加
            </button>
            <button
              className="dav-toolbar-btn"
              style={{ flex: 1, justifyContent: 'center', borderColor: '#3b82f6', color: '#93c5fd' }}
              onClick={handleAddStep}
            >
              ＋ 動的ステップ追加
            </button>
          </div>
        </div>
      </div>

      {/* 2. Selected Element Property Inspector */}
      {selectedNode && (
        <div style={{ padding: '12px 14px', borderBottom: '1px solid #1e293b', background: '#131c31' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 8,
            }}
          >
            <span style={{ fontWeight: 700, color: '#60a5fa' }}>
              選択ノード: {selectedNode.id}
            </span>
            <button
              className="dav-toolbar-btn"
              style={{ color: '#fca5a5', borderColor: '#7f1d1d' }}
              onClick={() => {
                onUpdateModel({
                  ...model,
                  nodes: model.nodes.filter((n) => n.id !== selectedNode.id),
                  edges: model.edges.filter(
                    (e) => e.from !== selectedNode.id && e.to !== selectedNode.id
                  ),
                });
                onClearSelection();
              }}
            >
              削除
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            <label>
              <span style={{ color: '#94a3b8', fontSize: 11 }}>ラベル名</span>
              <input
                className="dav-input"
                value={selectedNode.label}
                onChange={(e) =>
                  onUpdateModel({
                    ...model,
                    nodes: model.nodes.map((n) =>
                      n.id === selectedNode.id ? { ...n, label: e.target.value } : n
                    ),
                  })
                }
              />
            </label>
            <label>
              <span style={{ color: '#94a3b8', fontSize: 11 }}>サブテキスト (sub)</span>
              <input
                className="dav-input"
                value={selectedNode.sub ?? ''}
                onChange={(e) =>
                  onUpdateModel({
                    ...model,
                    nodes: model.nodes.map((n) =>
                      n.id === selectedNode.id
                        ? { ...n, sub: e.target.value || undefined }
                        : n
                    ),
                  })
                }
              />
            </label>
            <div style={{ display: 'flex', gap: 6 }}>
              <label style={{ flex: 1 }}>
                <span style={{ color: '#94a3b8', fontSize: 11 }}>アイコン種別</span>
                <select
                  className="dav-input"
                  value={selectedNode.icon}
                  onChange={(e) => {
                    const icon = e.target.value as NodeIconType;
                    const sz = getDefaultNodeSize(icon);
                    onUpdateModel({
                      ...model,
                      nodes: model.nodes.map((n) =>
                        n.id === selectedNode.id
                          ? { ...n, icon, width: sz.width, height: sz.height }
                          : n
                      ),
                    });
                  }}
                >
                  {ALL_ICON_TYPES.map((k) => (
                    <option key={k} value={k}>
                      {k}
                    </option>
                  ))}
                </select>
              </label>
              <label style={{ flex: 1 }}>
                <span style={{ color: '#94a3b8', fontSize: 11 }}>初期ステータス</span>
                <select
                  className="dav-input"
                  value={selectedNode.status}
                  onChange={(e) =>
                    onUpdateModel({
                      ...model,
                      nodes: model.nodes.map((n) =>
                        n.id === selectedNode.id
                          ? { ...n, status: e.target.value as NodeStatus }
                          : n
                      ),
                    })
                  }
                >
                  <option value="normal">normal</option>
                  <option value="active">active</option>
                  <option value="muted">muted</option>
                  <option value="warning">warning</option>
                  <option value="error">error</option>
                </select>
              </label>
            </div>
          </div>
        </div>
      )}

      {selectedGroup && (
        <div style={{ padding: '12px 14px', borderBottom: '1px solid #1e293b', background: '#131c31' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontWeight: 700, color: '#60a5fa' }}>
              選択グループ: {selectedGroup.id}
            </span>
            <button
              className="dav-toolbar-btn"
              style={{ color: '#fca5a5', borderColor: '#7f1d1d' }}
              onClick={() => {
                onUpdateModel({
                  ...model,
                  groups: model.groups.filter((g) => g.id !== selectedGroup.id),
                  nodes: model.nodes.map((n) =>
                    n.groupId === selectedGroup.id ? { ...n, groupId: undefined } : n
                  ),
                });
                onClearSelection();
              }}
            >
              削除
            </button>
          </div>
          <label>
            <span style={{ color: '#94a3b8', fontSize: 11 }}>グループ表示名</span>
            <input
              className="dav-input"
              value={selectedGroup.label}
              onChange={(e) =>
                onUpdateModel({
                  ...model,
                  groups: model.groups.map((g) =>
                    g.id === selectedGroup.id ? { ...g, label: e.target.value } : g
                  ),
                })
              }
            />
          </label>
        </div>
      )}

      {selectedEdge && (
        <div style={{ padding: '12px 14px', borderBottom: '1px solid #1e293b', background: '#131c31' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontWeight: 700, color: '#60a5fa' }}>
              接続線: {selectedEdge.from} → {selectedEdge.to}
            </span>
            <button
              className="dav-toolbar-btn"
              style={{ color: '#fca5a5', borderColor: '#7f1d1d' }}
              onClick={() => {
                onUpdateModel({
                  ...model,
                  edges: model.edges.filter((e) => e.id !== selectedEdge.id),
                });
                onClearSelection();
              }}
            >
              削除
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            <label>
              <span style={{ color: '#94a3b8', fontSize: 11 }}>エッジラベル</span>
              <input
                className="dav-input"
                value={selectedEdge.label ?? ''}
                onChange={(e) =>
                  onUpdateModel({
                    ...model,
                    edges: model.edges.map((ed) =>
                      ed.id === selectedEdge.id
                        ? { ...ed, label: e.target.value || undefined }
                        : ed
                    ),
                  })
                }
              />
            </label>
            <div style={{ display: 'flex', gap: 6 }}>
              <select
                className="dav-input"
                value={selectedEdge.style}
                onChange={(e) =>
                  onUpdateModel({
                    ...model,
                    edges: model.edges.map((ed) =>
                      ed.id === selectedEdge.id
                        ? { ...ed, style: e.target.value as EdgeStyle }
                        : ed
                    ),
                  })
                }
              >
                <option value="solid">{'実線 (-->)'}</option>
                <option value="dashed">{'破線 (-.->)'}</option>
              </select>
              <select
                className="dav-input"
                value={selectedEdge.direction}
                onChange={(e) =>
                  onUpdateModel({
                    ...model,
                    edges: model.edges.map((ed) =>
                      ed.id === selectedEdge.id
                        ? { ...ed, direction: e.target.value as EdgeDirection }
                        : ed
                    ),
                  })
                }
              >
                <option value="forward">片方向</option>
                <option value="bidirectional">双方向</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* 3. Active Step Authoring Inspector */}
      <div style={{ padding: '12px 14px', flex: 1 }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: '#94a3b8',
            textTransform: 'uppercase',
            marginBottom: 8,
          }}
        >
          ステップ動作インスペクタ
        </div>

        {!activeStep ? (
          <div
            style={{
              padding: 12,
              background: '#0b1120',
              borderRadius: 8,
              border: '1px solid #1e293b',
              color: '#94a3b8',
              lineHeight: 1.5,
            }}
          >
            現在「全体図」モードです。下部のステップバーから編集したいStepを選択するか、「＋ 動的ステップ追加」を押してください。
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 700, color: '#60a5fa' }}>
                Step {activeStep.stepNumber} の設定
              </span>
              <button
                className="dav-toolbar-btn"
                style={{ color: '#fca5a5', borderColor: '#7f1d1d' }}
                onClick={() => handleDeleteStep(activeStepIndex!)}
              >
                このStepを削除
              </button>
            </div>

            <label>
              <span style={{ color: '#94a3b8', fontSize: 11 }}>ステップタイトル</span>
              <input
                className="dav-input"
                value={activeStep.title}
                onChange={(e) => {
                  const nextSteps = model.steps.map((s, idx) =>
                    idx === activeStepIndex ? { ...s, title: e.target.value } : s
                  );
                  onUpdateModel({ ...model, steps: nextSteps });
                }}
              />
            </label>

            <label>
              <span style={{ color: '#94a3b8', fontSize: 11 }}>説明テキスト (desc)</span>
              <textarea
                className="dav-input"
                rows={3}
                value={activeStep.description}
                onChange={(e) => {
                  const nextSteps = model.steps.map((s, idx) =>
                    idx === activeStepIndex ? { ...s, description: e.target.value } : s
                  );
                  onUpdateModel({ ...model, steps: nextSteps });
                }}
              />
            </label>

            {/* Animations inside this step */}
            <div
              style={{
                background: '#0b1120',
                padding: 10,
                borderRadius: 8,
                border: '1px solid #1e293b',
              }}
            >
              <div style={{ fontWeight: 600, marginBottom: 6, color: '#cbd5e1' }}>
                データフロー / 画面遷移アニメーション ({activeStep.animations.length})
              </div>
              {activeStep.animations.map((anim, aIdx) => (
                <div
                  key={aIdx}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '4px 6px',
                    background: '#1e293b',
                    borderRadius: 5,
                    marginBottom: 4,
                    fontSize: 11,
                  }}
                >
                  <span>
                    <strong style={{ color: anim.color || '#60a5fa' }}>
                      {anim.from} → {anim.to}
                    </strong>{' '}
                    {anim.label ? `"${anim.label}"` : ''}
                  </span>
                  <button
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#fca5a5',
                      cursor: 'pointer',
                    }}
                    onClick={() => {
                      const nextSteps = model.steps.map((s, idx) =>
                        idx === activeStepIndex
                          ? {
                              ...s,
                              animations: s.animations.filter((_, i) => i !== aIdx),
                            }
                          : s
                      );
                      onUpdateModel({ ...model, steps: nextSteps });
                    }}
                  >
                    ✕
                  </button>
                </div>
              ))}

              {/* Add animation form */}
              <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
                <select
                  className="dav-input"
                  value={animFrom}
                  onChange={(e) => setAnimFrom(e.target.value)}
                >
                  <option value="">始点...</option>
                  {model.nodes.map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.label} ({n.id})
                    </option>
                  ))}
                </select>
                <select
                  className="dav-input"
                  value={animTo}
                  onChange={(e) => setAnimTo(e.target.value)}
                >
                  <option value="">終点...</option>
                  {model.nodes.map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.label} ({n.id})
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                <input
                  className="dav-input"
                  placeholder="流れるデータ名"
                  value={animLabel}
                  onChange={(e) => setAnimLabel(e.target.value)}
                  style={{ flex: 1 }}
                />
                <input
                  type="color"
                  value={animColor}
                  onChange={(e) => setAnimColor(e.target.value)}
                  style={{
                    width: 28,
                    height: 28,
                    border: 'none',
                    background: 'transparent',
                    cursor: 'pointer',
                  }}
                />
                <button
                  className="dav-btn-primary"
                  onClick={() => {
                    if (!animFrom || !animTo) return;
                    const nextSteps = model.steps.map((s, idx) =>
                      idx === activeStepIndex
                        ? {
                            ...s,
                            animations: [
                              ...s.animations,
                              {
                                from: animFrom,
                                to: animTo,
                                label: animLabel || undefined,
                                color: animColor,
                              },
                            ],
                          }
                        : s
                    );
                    onUpdateModel({ ...model, steps: nextSteps });
                  }}
                >
                  追加
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};
