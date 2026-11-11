import { html, svg } from '../runtime/dom';
import type { ViewerLocale } from '../runtime/i18n';

/** What the preview's Export menu offers. */
export type ExportFormat = 'html' | 'svg-animated' | 'svg-whole' | 'svg-still';

/** What the menu needs to know about the diagram each time it opens. */
export interface ExportContext {
  hasSteps: boolean;
  /** The step the preview shows; `null` on the overview. */
  step: { index: number; title: string; animates: boolean } | null;
}

type Scope = 'all' | 'step';

const STRINGS = {
  ja: {
    button: '書き出す',
    menu: '書き出す形式',
    scope: '範囲',
    allSteps: 'すべてのステップ',
    thisStep: (n: number, title: string) =>
      title ? `このステップ: ${n}. ${title}` : `このステップ: ${n}`,
    noSteps: 'ステップのない図は静止画になります',
    stillStep: '何も動かないステップです',
    htmlAll: 'HTML にはすべてのステップが入ります',
    blocked: '構文エラーを直すと書き出せます',
    html: ['単一 HTML', '操作できる 1 ファイル。オフラインで動きます'],
    animated: ['アニメーション SVG', 'README 用。カメラが流れを追います'],
    whole: ['アニメーション SVG（全体固定）', '図全体を映したまま再生します'],
    still: ['静止画 SVG', '全体図を 1 枚の画像にします', 'このステップを 1 枚の画像にします'],
  },
  en: {
    button: 'Export',
    menu: 'Export format',
    scope: 'Range',
    allSteps: 'All steps',
    thisStep: (n: number, title: string) =>
      title ? `This step: ${n}. ${title}` : `This step: ${n}`,
    noSteps: 'A diagram without steps exports as a still picture',
    stillStep: 'Nothing moves in this step',
    htmlAll: 'An HTML file always holds every step',
    blocked: 'Fix the syntax error to export',
    html: ['Standalone HTML', 'One interactive file that works offline'],
    animated: ['Animated SVG', 'For READMEs: the camera follows the flow'],
    whole: ['Animated SVG, whole diagram', 'Plays with the whole diagram in view'],
    still: ['Still SVG', 'The overview as one picture', 'This step as one picture'],
  },
} as const;

function menuButton(
  role: string,
  className: string,
  testId: string,
  ...children: Array<Node | string>
): HTMLButtonElement {
  return html(
    'button',
    { type: 'button', role, class: className, tabindex: '-1', 'data-testid': testId },
    ...children,
  );
}

function itemContent(label: string, detail: string): [HTMLElement, HTMLElement] {
  return [
    html('span', { class: 'export-item-label' }, label),
    html('span', { class: 'export-item-detail' }, detail),
  ];
}

/**
 * The toolbar's Export button and its menu: a choice between every step and the step the
 * preview shows, then the formats.
 */
export class ExportMenu {
  readonly element: HTMLElement;
  readonly #strings: (typeof STRINGS)[ViewerLocale];
  readonly #context: () => ExportContext;
  readonly #button: HTMLButtonElement;
  readonly #list: HTMLElement;
  readonly #scopeGroup: HTMLElement;
  readonly #separator: HTMLElement;
  readonly #scopes: Record<Scope, HTMLButtonElement>;
  readonly #formats: Record<ExportFormat, HTMLButtonElement>;
  readonly #stillDetail: HTMLElement;
  #scope: Scope = 'all';
  #scopeStepIndex: number | null = null;
  #shown: ExportContext = { hasSteps: false, step: null };
  #listening = false;
  #blocked = false;
  readonly #onPointerDown = (e: PointerEvent): void => {
    if (!this.element.contains(e.target as Node | null)) this.close(false);
  };
  readonly #onWindowBlur = (): void => {
    this.close(false);
  };

  constructor(
    locale: ViewerLocale,
    context: () => ExportContext,
    onPick: (format: ExportFormat, step: number | null) => void,
  ) {
    const s = STRINGS[locale];
    this.#strings = s;
    this.#context = context;
    this.#button = html(
      'button',
      {
        type: 'button',
        class: 'btn primary export-button',
        'aria-haspopup': 'menu',
        'aria-expanded': 'false',
        'aria-controls': 'export-menu-list',
        'data-testid': 'btn-export',
      },
      s.button,
      svg(
        'svg',
        {
          class: 'export-caret',
          viewBox: '0 0 10 10',
          width: 10,
          height: 10,
          'aria-hidden': 'true',
        },
        svg('path', { d: 'M 2 3.5 L 5 6.5 L 8 3.5', fill: 'none', stroke: 'currentColor' }),
      ),
    );

    this.#scopes = {
      all: menuButton('menuitemradio', 'export-item export-scope', 'export-scope-all', s.allSteps),
      step: menuButton('menuitemradio', 'export-item export-scope', 'export-scope-step'),
    };
    for (const [scope, el] of Object.entries(this.#scopes) as Array<[Scope, HTMLButtonElement]>) {
      el.addEventListener('click', () => {
        this.#scope = scope;
        this.#refresh();
        el.focus();
      });
    }
    this.#scopeGroup = html(
      'div',
      { class: 'export-scope-group', role: 'group', 'aria-label': s.scope },
      this.#scopes.all,
      this.#scopes.step,
    );
    this.#separator = html('div', { class: 'export-separator', role: 'separator' });

    const [stillLabel, stillDetail] = itemContent(s.still[0], s.still[1]);
    this.#stillDetail = stillDetail;
    this.#formats = {
      html: menuButton(
        'menuitem',
        'export-item',
        'export-html',
        ...itemContent(s.html[0], s.html[1]),
      ),
      'svg-animated': menuButton(
        'menuitem',
        'export-item',
        'export-svg-animated',
        ...itemContent(s.animated[0], s.animated[1]),
      ),
      'svg-whole': menuButton(
        'menuitem',
        'export-item',
        'export-svg-whole',
        ...itemContent(s.whole[0], s.whole[1]),
      ),
      'svg-still': menuButton(
        'menuitem',
        'export-item',
        'export-svg-still',
        stillLabel,
        stillDetail,
      ),
    };
    for (const [format, el] of Object.entries(this.#formats) as Array<
      [ExportFormat, HTMLButtonElement]
    >) {
      el.addEventListener('click', () => {
        if (el.disabled) return;
        const step = this.#scope === 'step' ? (this.#shown.step?.index ?? null) : null;
        this.close(true);
        onPick(format, step);
      });
    }

    this.#list = html(
      'div',
      { id: 'export-menu-list', class: 'export-menu-list', role: 'menu', 'aria-label': s.menu },
      this.#scopeGroup,
      this.#separator,
      ...Object.values(this.#formats),
    );
    this.#list.hidden = true;
    this.element = html('div', { class: 'export-menu' }, this.#button, this.#list);

    this.#button.addEventListener('click', () => {
      if (this.#list.hidden) this.open();
      else this.close(false);
    });
    this.#button.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
      e.preventDefault();
      this.open(e.key === 'ArrowUp' ? 'last' : 'first');
    });
    // Keeps pressing disabled buttons (which suppress mousedown in Blink), separators, or menu
    // padding from blurring the active item while leaving click activation intact.
    this.#list.addEventListener('pointerdown', (e) => e.preventDefault());
    this.#list.addEventListener('mousedown', (e) => e.preventDefault());
    this.#list.addEventListener('keydown', (e) => this.#onKey(e));
    this.element.addEventListener('focusout', (e) => {
      if (
        !this.#list.hidden &&
        e.relatedTarget !== null &&
        !this.element.contains(e.relatedTarget as Node)
      ) {
        this.close(false);
      }
    });
  }

  /** Opens on the diagram as it is now; the range stays as last chosen while that step shows. */
  open(focus: 'first' | 'last' = 'first'): void {
    if (this.#blocked) return;
    this.#loadContext();
    this.#list.hidden = false;
    this.#button.setAttribute('aria-expanded', 'true');
    if (!this.#listening) {
      document.addEventListener('pointerdown', this.#onPointerDown);
      window.addEventListener('blur', this.#onWindowBlur);
      this.#listening = true;
    }
    const enabled = this.#enabled();
    (focus === 'first' ? enabled[0] : enabled[enabled.length - 1])?.focus();
  }

  close(returnFocus: boolean): void {
    if (this.#listening) {
      document.removeEventListener('pointerdown', this.#onPointerDown);
      window.removeEventListener('blur', this.#onWindowBlur);
      this.#listening = false;
    }
    this.#list.hidden = true;
    this.#button.setAttribute('aria-expanded', 'false');
    if (returnFocus) this.#button.focus();
  }

  /** Refreshes the open menu when the diagram or its active step changes underneath it. */
  sync(): void {
    if (this.#list.hidden) return;
    const hadFocusInList = this.#list.contains(document.activeElement);
    this.#loadContext();
    if (hadFocusInList) {
      const enabled = this.#enabled();
      if (!enabled.includes(document.activeElement as HTMLButtonElement)) {
        enabled[0]?.focus();
      }
    }
  }

  /**
   * While the text has a fatal syntax error, the button stays focusable and says why it does
   * nothing: a disabled button could neither take focus nor show its tooltip.
   */
  setBlocked(blocked: boolean): void {
    this.#blocked = blocked;
    if (blocked) {
      this.close(false);
      this.#button.setAttribute('aria-disabled', 'true');
      this.#button.title = this.#strings.blocked;
    } else {
      this.#button.removeAttribute('aria-disabled');
      this.#button.removeAttribute('title');
    }
  }

  /** Clears all per-document menu state when switching to another document. */
  reset(): void {
    this.close(false);
    this.#scope = 'all';
    this.#scopeStepIndex = null;
  }

  #loadContext(): void {
    this.#shown = this.#context();
    const stepIndex = this.#shown.step?.index ?? null;
    if (stepIndex === null || stepIndex !== this.#scopeStepIndex) {
      this.#scope = 'all';
    }
    this.#scopeStepIndex = stepIndex;
    this.#refresh();
  }

  #refresh(): void {
    const s = this.#strings;
    const { hasSteps, step } = this.#shown;
    this.#scopeGroup.hidden = !step;
    this.#separator.hidden = !step;
    if (step) this.#scopes.step.textContent = s.thisStep(step.index + 1, step.title);
    for (const [scope, el] of Object.entries(this.#scopes) as Array<[Scope, HTMLButtonElement]>) {
      el.setAttribute('aria-checked', String(scope === this.#scope));
    }
    const oneStep = this.#scope === 'step';
    const noMotion = !hasSteps ? s.noSteps : oneStep && !step?.animates ? s.stillStep : null;
    this.#setEnabled(this.#formats.html, oneStep ? s.htmlAll : null);
    this.#setEnabled(this.#formats['svg-animated'], noMotion);
    this.#setEnabled(this.#formats['svg-whole'], noMotion);
    this.#stillDetail.textContent = oneStep ? s.still[2] : s.still[1];
  }

  /** Disables an item with the reason as its tooltip, or enables it again with `null`. */
  #setEnabled(el: HTMLButtonElement, reason: string | null): void {
    el.disabled = reason !== null;
    if (reason === null) el.removeAttribute('title');
    else el.title = reason;
  }

  #enabled(): HTMLButtonElement[] {
    const scopes = this.#scopeGroup.hidden ? [] : Object.values(this.#scopes);
    return [...scopes, ...Object.values(this.#formats)].filter((item) => !item.disabled);
  }

  #onKey(e: KeyboardEvent): void {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    const enabled = this.#enabled();
    const index = enabled.indexOf(document.activeElement as HTMLButtonElement);
    let next: HTMLButtonElement | undefined;
    if (e.key === 'ArrowDown') next = enabled[(index + 1) % enabled.length];
    else if (e.key === 'ArrowUp') {
      next =
        index < 0
          ? enabled[enabled.length - 1]
          : enabled[(index - 1 + enabled.length) % enabled.length];
    } else if (e.key === 'Home') next = enabled[0];
    else if (e.key === 'End') next = enabled[enabled.length - 1];
    else if (e.key === 'Escape') {
      e.preventDefault();
      // Keeps the player's global keyboard shortcuts from also acting on this key.
      e.stopPropagation();
      this.close(true);
      return;
    } else if (e.key === 'Tab') {
      this.close(false);
      return;
    } else return;
    e.preventDefault();
    e.stopPropagation();
    next?.focus();
  }
}
