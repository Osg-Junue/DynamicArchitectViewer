import { buildAiPrompt } from '../../prompt';
import { html } from '../../runtime/dom';
import { type DocContext, type DocPage, h2, list, note, p, pageLink } from './elements';
import { copyButton, copyWithFeedback, type Translate } from './figures';

function commandLine(t: Translate, command: string): HTMLElement {
  return html('div', { class: 'doc-command' }, html('span', {}, command), copyButton(command, t));
}

function renderSkill(ctx: DocContext): Node[] {
  const { t } = ctx;
  return [
    h2(t('スキルでできること', 'What the skill does')),
    list([
      t(
        '`.dav` に関する依頼を受けると、エージェントが自動で読み込みます。言語ルール、レイアウトの決まり方、ステップの組み立て方に沿って図を書きます。',
        'Agents load it automatically for `.dav` tasks, then follow the language rules, how layout works and how to structure steps.',
      ),
      t(
        '同梱の `dav-check` が、エディタと同じパーサで診断と整形を実行します。エージェントは診断がなくなるまで自分で修正します（Node.js 18 以降が必要）。',
        'The bundled `dav-check` runs the same parser and formatter as the editor, so the agent can fix its own diagnostics until none remain (needs Node.js 18 or later).',
      ),
      t(
        '`--detail` を付けると、説明やコードが足りない箇所と、長すぎて途中で切れる文字も報告します。エージェントは見えない図を、指摘がなくなるまで詳しくできます。図の大きさ、列と行の数、線の交差といったレイアウトの要約も出します。',
        'With `--detail` it also reports missing descriptions and code, and text too long to be shown in full, so that the agent can add detail to a diagram it cannot see. It describes the layout as well: the size of the diagram, its columns and rows, and connections that cross.',
      ),
      t(
        '仕様書と7つのサンプルを同梱しており、必要なときだけ参照します。',
        'It includes the specification and seven examples, which are read only when needed.',
      ),
      t(
        'もう1つのスキル `dav-reading` は、`.dav` を読んで構成やデータの流れを説明するためのものです。同梱の `dav-outline` が、参照を解決した構成と、各ステップのパケットを進む順に出力します。',
        'A second skill, `dav-reading`, is for explaining the architecture and the data flows a `.dav` file describes. Its bundled `dav-outline` prints the structure with every reference resolved, and the packets of each step in the order they travel.',
      ),
    ]),
    h2(t('VS Code からインストール', 'Install from VS Code')),
    p(
      t(
        'コマンドパレットで `DynamicArchitectViewer: AI エージェントスキルをインストール...` を実行し、Claude Code / GitHub Copilot / Codex と、インストール先（このワークスペース / すべてのプロジェクト）を選びます。',
        'Run `DynamicArchitectViewer: Install AI Agent Skill...` from the Command Palette, then choose Claude Code, GitHub Copilot or Codex, and either this workspace or all projects.',
      ),
    ),
    note(
      t(
        'ワークスペースにインストールしたスキルは、コミットするとチームで共有できます。拡張機能を更新したら、同じコマンドでスキルも更新してください。',
        'Commit a workspace installation to share it with your team. After updating the extension, run the command again to update the skill.',
      ),
    ),
    h2(t('Claude Code のプラグインとしてインストール', 'Install as a Claude Code plugin')),
    p(
      t(
        'シェルで次を順に実行します。プラグインとして更新を受け取れます。',
        'Run these in your shell. The plugin can then receive updates.',
      ),
    ),
    html(
      'div',
      { class: 'doc-commands', 'data-testid': 'doc-skill-commands' },
      commandLine(t, 'claude plugin marketplace add Osg-Junue/DynamicArchitectViewer'),
      commandLine(t, 'claude plugin install dynamic-architect-viewer@osg-junue'),
    ),
    h2(t('その他のエージェント', 'Other agents')),
    p(
      t(
        'Agent Skills 形式に対応したエージェントには、サードパーティ製の `skills` CLI でインストールできます。`-a` で対象のエージェントを、`-g` ですべてのプロジェクトを指定します。',
        'For other agents that support the Agent Skills format, use the third-party `skills` CLI. Add `-a` to choose an agent, or `-g` for all projects.',
      ),
    ),
    html(
      'div',
      { class: 'doc-commands' },
      commandLine(t, 'npx skills add Osg-Junue/DynamicArchitectViewer --skill dav-diagrams'),
      commandLine(t, 'npx skills add Osg-Junue/DynamicArchitectViewer --skill dav-reading'),
    ),
    h2(t('使い方', 'Using it')),
    p(
      t(
        'インストール後は、エージェントに普通に依頼します。例: 「このリポジトリの認証フローを auth.dav に図示して」。明示的に呼び出す場合、Claude Code では `/dav-diagrams`、プラグインでは `/dynamic-architect-viewer:dav-diagrams` です。',
        'Then ask your agent as usual, such as "Diagram this repository’s login flow in auth.dav". To invoke it explicitly in Claude Code, use `/dav-diagrams`, or `/dynamic-architect-viewer:dav-diagrams` for the plugin.',
      ),
    ),
  ];
}

function renderPrompt(ctx: DocContext): Node[] {
  const { t, locale } = ctx;
  const promptText = () =>
    buildAiPrompt({
      locale,
      currentDsl: ctx.currentDsl,
      includeCurrentDsl: ctx.prompt.includeCurrent,
    });
  const checkbox = html('input', { type: 'checkbox', 'data-testid': 'chk-include-current-dsl' });
  checkbox.checked = ctx.prompt.includeCurrent;
  checkbox.addEventListener('change', () => {
    ctx.prompt.includeCurrent = checkbox.checked;
    textarea.value = promptText();
  });
  const label = t('プロンプトをコピー', 'Copy prompt');
  const copy = html(
    'button',
    { type: 'button', class: 'btn primary', 'data-testid': 'btn-copy-ai-prompt' },
    label,
  );
  copy.addEventListener('click', () => {
    void copyWithFeedback(promptText(), copy, label, t, {
      copiedLabel: t('コピーしました', 'Copied'),
    });
  });
  const textarea = html('textarea', {
    class: 'doc-prompt-text',
    'aria-label': t('AI生成プロンプト', 'AI prompt'),
    readonly: true,
    'data-testid': 'ai-prompt-textarea',
  });
  textarea.value = promptText();
  return [
    html(
      'p',
      { class: 'doc-note' },
      t(
        'エージェントで繰り返し使うなら、貼り付けが不要で検証もできるスキルが便利です: ',
        'For repeated use in a coding agent, a skill needs no pasting and can validate its output: ',
      ),
      pageLink(ctx, 'skill', t('AIエージェントスキル', 'AI agent skill')),
    ),
    html(
      'div',
      { class: 'doc-prompt-tools' },
      html(
        'label',
        { class: 'doc-checkbox' },
        checkbox,
        html(
          'span',
          {},
          t(
            '現在のDSLをプロンプトに含める（既存図の修正用）',
            'Include the current DSL (to modify an existing diagram)',
          ),
        ),
      ),
      copy,
    ),
    textarea,
  ];
}

export const TOOLS_PAGES: readonly DocPage[] = [
  {
    id: 'skill',
    group: 'tools',
    title: ['AIエージェントスキル', 'AI agent skill'],
    lead: [
      'Claude Code や GitHub Copilot などのコーディングエージェントに、`.dav` の書き方・検証方法と読み解き方を教えるスキルです。',
      'Skills that teach coding agents such as Claude Code and GitHub Copilot to write, validate and explain `.dav` files.',
    ],
    render: renderSkill,
  },
  {
    id: 'prompt',
    group: 'tools',
    title: ['AI生成プロンプト', 'AI prompt'],
    lead: [
      'ChatGPT / Claude / Gemini などに貼り付けて、`.dav` を生成・修正するためのプロンプトです。',
      'Paste this into ChatGPT, Claude or Gemini to generate or modify `.dav` diagrams.',
    ],
    render: renderPrompt,
  },
];
