import { ICON_META } from '../model/icons';
import { COLOR_NAMES, ICON_NAMES } from '../model/types';
import { buildAiPrompt, PROMPT_EXAMPLE_DSL } from '../prompt';
import { clear, html, svg } from '../runtime/dom';
import type { ViewerLocale } from '../runtime/i18n';
import { ICON_SHAPES } from '../scene/icons';

interface HelpStrings {
  title: string;
  tabPrompt: string;
  tabRef: string;
  close: string;
  promptDesc: string;
  includeCurrent: string;
  copyPrompt: string;
  copiedPrompt: string;
  refSyntaxTitle: string;
  refIconsTitle: string;
  refTokensTitle: string;
  refExampleTitle: string;
}

const STRINGS: Record<ViewerLocale, HelpStrings> = {
  ja: {
    title: 'DSL v1 リファレンス & AI生成プロンプト',
    tabPrompt: 'AI生成プロンプト',
    tabRef: '構文 & アイコン一覧',
    close: '閉じる',
    promptDesc:
      'ChatGPT / Claude / Gemini 等に貼り付けるだけで、構文エラーのない `.dav` コードを生成・編集できるプロンプトです。',
    includeCurrent: '現在のDSLコードをプロンプトに含める（既存図の改修用）',
    copyPrompt: 'AIプロンプトをコピー',
    copiedPrompt: 'コピーしました',
    refSyntaxTitle: '基本構文 (dav 1)',
    refIconsTitle: '利用可能なアイコン (全18種)',
    refTokensTitle: '色と矢印トークン',
    refExampleTitle: '記述サンプル',
  },
  en: {
    title: 'DSL v1 Reference & AI Prompt',
    tabPrompt: 'AI Prompt',
    tabRef: 'Syntax & Icon Catalog',
    close: 'Close',
    promptDesc:
      'Copy and paste this prompt into ChatGPT, Claude, or Gemini to generate or modify `.dav` diagrams without syntax errors.',
    includeCurrent: 'Include current DSL code in prompt (for editing existing diagram)',
    copyPrompt: 'Copy AI Prompt',
    copiedPrompt: 'Copied!',
    refSyntaxTitle: 'Core Syntax (dav 1)',
    refIconsTitle: 'Available Icons (18)',
    refTokensTitle: 'Colors & Arrow Tokens',
    refExampleTitle: 'Reference Example',
  },
};

export class HelpModal {
  readonly element: HTMLDialogElement;
  private locale: ViewerLocale;
  private currentDsl: string;
  private tab: 'prompt' | 'ref' = 'prompt';
  private includeCurrent = false;
  private copied = false;
  private readonly bodyEl: HTMLElement;
  private readonly titleEl: HTMLElement;
  private readonly tabPromptBtn: HTMLButtonElement;
  private readonly tabRefBtn: HTMLButtonElement;
  private readonly closeBtn: HTMLButtonElement;

  constructor(locale: ViewerLocale, currentDsl: string) {
    this.locale = locale;
    this.currentDsl = currentDsl;

    this.titleEl = html('span', { class: 'help-title' });
    this.tabPromptBtn = html('button', {
      type: 'button',
      class: 'help-tab active',
      'data-testid': 'help-tab-prompt',
    });
    this.tabRefBtn = html('button', {
      type: 'button',
      class: 'help-tab',
      'data-testid': 'help-tab-ref',
    });
    this.closeBtn = html('button', {
      type: 'button',
      class: 'btn',
      'data-testid': 'help-close-btn',
    });
    this.bodyEl = html('div', { class: 'help-body' });

    this.tabPromptBtn.addEventListener('click', () => {
      this.tab = 'prompt';
      this.render();
    });
    this.tabRefBtn.addEventListener('click', () => {
      this.tab = 'ref';
      this.render();
    });
    this.closeBtn.addEventListener('click', () => this.close());

    this.element = html(
      'dialog',
      { class: 'help-dialog', 'data-testid': 'help-dialog' },
      html(
        'header',
        { class: 'help-header' },
        html(
          'div',
          { class: 'help-header-left' },
          this.titleEl,
          html('div', { class: 'help-tabs' }, this.tabPromptBtn, this.tabRefBtn),
        ),
        this.closeBtn,
      ),
      this.bodyEl,
    );

    this.element.addEventListener('click', (e) => {
      if (e.target === this.element) this.close();
    });

    this.render();
  }

  open(locale: ViewerLocale, currentDsl: string): void {
    this.locale = locale;
    this.currentDsl = currentDsl;
    this.render();
    if (!this.element.open) {
      this.element.showModal();
    }
  }

  close(): void {
    if (this.element.open) {
      this.element.close();
    }
  }

  update(locale: ViewerLocale, currentDsl: string): void {
    this.locale = locale;
    this.currentDsl = currentDsl;
    if (this.element.open) {
      this.render();
    }
  }

  private render(): void {
    const s = STRINGS[this.locale];
    this.titleEl.textContent = s.title;
    this.tabPromptBtn.textContent = s.tabPrompt;
    this.tabRefBtn.textContent = s.tabRef;
    this.closeBtn.textContent = s.close;
    this.tabPromptBtn.classList.toggle('active', this.tab === 'prompt');
    this.tabRefBtn.classList.toggle('active', this.tab === 'ref');

    clear(this.bodyEl);
    if (this.tab === 'prompt') {
      this.bodyEl.append(this.renderPromptPane(s));
    } else {
      this.bodyEl.append(this.renderRefPane(s));
    }
  }

  private renderPromptPane(s: HelpStrings): HTMLElement {
    const promptText = buildAiPrompt({
      locale: this.locale,
      currentDsl: this.currentDsl,
      includeCurrentDsl: this.includeCurrent,
    });

    const checkbox = html('input', {
      type: 'checkbox',
      'data-testid': 'chk-include-current-dsl',
    });
    checkbox.checked = this.includeCurrent;
    checkbox.addEventListener('change', () => {
      this.includeCurrent = checkbox.checked;
      this.render();
    });

    const copyBtn = html(
      'button',
      {
        type: 'button',
        class: 'btn primary',
        'data-testid': 'btn-copy-ai-prompt',
      },
      this.copied ? s.copiedPrompt : s.copyPrompt,
    );
    copyBtn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(promptText);
        this.copied = true;
        copyBtn.textContent = s.copiedPrompt;
        setTimeout(() => {
          this.copied = false;
          copyBtn.textContent = s.copyPrompt;
        }, 1600);
      } catch {
        // Ignore clipboard errors in non-secure test contexts
      }
    });

    const textarea = html('textarea', {
      class: 'help-prompt-text',
      readonly: true,
      'data-testid': 'ai-prompt-textarea',
    });
    textarea.value = promptText;

    return html(
      'div',
      { class: 'help-pane' },
      html('p', { class: 'help-lead' }, s.promptDesc),
      html(
        'div',
        { class: 'help-prompt-toolbar' },
        html('label', { class: 'help-checkbox' }, checkbox, html('span', {}, s.includeCurrent)),
        copyBtn,
      ),
      textarea,
    );
  }

  private renderRefPane(s: HelpStrings): HTMLElement {
    const iconGrid = html('div', { class: 'icon-grid', 'data-testid': 'ref-icon-catalog' });
    for (const icon of ICON_NAMES) {
      const meta = ICON_META[icon];
      const shapes = ICON_SHAPES[icon];
      const svgIcon = svg('svg', {
        width: 22,
        height: 22,
        viewBox: '0 0 24 24',
        fill: 'none',
        stroke: 'currentColor',
        'stroke-width': 2,
        'stroke-linecap': 'round',
        'stroke-linejoin': 'round',
      });
      for (const [tag, attrs] of shapes) {
        svgIcon.append(svg(tag as keyof SVGElementTagNameMap, attrs));
      }
      iconGrid.append(
        html(
          'div',
          { class: 'icon-card' },
          svgIcon,
          html(
            'div',
            { class: 'icon-card-meta' },
            html('code', {}, icon),
            html('span', {}, meta.category),
          ),
        ),
      );
    }

    return html(
      'div',
      { class: 'help-pane help-ref-grid' },
      html('section', { class: 'help-section' }, html('h3', {}, s.refIconsTitle), iconGrid),
      html(
        'section',
        { class: 'help-section' },
        html('h3', {}, s.refTokensTitle),
        html(
          'div',
          { class: 'ref-kv-list' },
          html(
            'div',
            {},
            html('strong', {}, 'color: '),
            html('code', {}, `${COLOR_NAMES.join(' | ')} (state only: none)`),
          ),
          html(
            'div',
            {},
            html('strong', {}, 'arrows: '),
            html('code', {}, '--> (solid) | -.-> (dashed) | <--> (bi-solid) | <-.-> (bi-dashed)'),
          ),
          html(
            'div',
            {},
            html('strong', {}, 'step statements: '),
            html(
              'code',
              {},
              'desc "..." | focus id1, id2 | state id [...] | animate a --> b : "..."',
            ),
          ),
        ),
        html('h3', {}, s.refSyntaxTitle),
        html(
          'pre',
          { class: 'help-code' },
          `dav 1
title "Diagram Title"

group <id> "Label" [color: blue] {
  node <id> "Label" [icon: server, sub: "Sublabel", badge: "v1"]
}

<from_id> --> <to_id> : "Edge Label" [id: <edge_id>, color: gray]

step "Step Title" {
  desc "Narrative shown in player dock"
  focus <id1>, <id2>
  state <id> [badge: "OK", visible: true]
  animate <from_id> --> <to_id> : "Packet" [color: blue, desc: "Action explanation", parallel: true]
}`,
        ),
        html('h3', {}, s.refExampleTitle),
        html('pre', { class: 'help-code' }, PROMPT_EXAMPLE_DSL),
      ),
    );
  }
}
