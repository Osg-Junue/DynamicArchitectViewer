import type { ExportFormat } from '../protocol/messages';
import { html, svg } from '../runtime/dom';
import type { ViewerLocale } from '../runtime/i18n';

interface Item {
  format: ExportFormat;
  testId: string;
  label: string;
  detail: string;
}

const STRINGS = {
  ja: {
    button: '書き出す',
    menu: '書き出す形式',
    noSteps: 'ステップのない図は静止画になります',
    items: [
      ['html', '単一 HTML', '操作できる 1 ファイル。オフラインで動きます'],
      ['svg-animated', 'アニメーション SVG', 'README 用。すべてのステップを繰り返し再生します'],
      ['svg-still', '静止画 SVG', '図全体を 1 枚の画像にします'],
    ],
  },
  en: {
    button: 'Export',
    menu: 'Export format',
    noSteps: 'A diagram without steps exports as a still picture',
    items: [
      ['html', 'Standalone HTML', 'One interactive file that works offline'],
      ['svg-animated', 'Animated SVG', 'For READMEs: plays every step in a loop'],
      ['svg-still', 'Still SVG', 'The whole diagram as one picture'],
    ],
  },
} as const satisfies Record<
  ViewerLocale,
  {
    button: string;
    menu: string;
    noSteps: string;
    items: ReadonlyArray<readonly [ExportFormat, string, string]>;
  }
>;

/** The toolbar's Export button and the menu of formats it opens. */
export class ExportMenu {
  readonly element: HTMLElement;
  readonly #button: HTMLButtonElement;
  readonly #list: HTMLElement;
  readonly #items: HTMLButtonElement[];
  readonly #animated: HTMLButtonElement | undefined;
  readonly #noStepsHint: string;

  constructor(locale: ViewerLocale, onPick: (format: ExportFormat) => void) {
    const s = STRINGS[locale];
    this.#noStepsHint = s.noSteps;
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
    );
    this.#button.append(
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

    const items: Item[] = s.items.map(([format, label, detail]) => ({
      format,
      testId: `export-${format}`,
      label,
      detail,
    }));
    this.#items = items.map((item) => {
      const el = html(
        'button',
        { type: 'button', role: 'menuitem', class: 'export-item', 'data-testid': item.testId },
        html('span', { class: 'export-item-label' }, item.label),
        html('span', { class: 'export-item-detail' }, item.detail),
      );
      el.tabIndex = -1;
      el.addEventListener('click', () => {
        if (el.disabled) return;
        this.close(true);
        onPick(item.format);
      });
      return el;
    });
    this.#animated = this.#items[items.findIndex((item) => item.format === 'svg-animated')];

    this.#list = html(
      'div',
      { id: 'export-menu-list', class: 'export-menu-list', role: 'menu', 'aria-label': s.menu },
      ...this.#items,
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
    this.#list.addEventListener('keydown', (e) => this.#onKey(e));
    // Clicking or focusing anywhere else closes the menu, as a native one would.
    document.addEventListener('pointerdown', (e) => {
      if (!this.#list.hidden && !this.element.contains(e.target as Node)) this.close(false);
    });
    this.element.addEventListener('focusout', (e) => {
      if (!this.#list.hidden && !this.element.contains(e.relatedTarget as Node | null)) {
        this.close(false);
      }
    });
  }

  /** An animated SVG needs steps to play; without them only the still picture makes sense. */
  setHasSteps(hasSteps: boolean): void {
    if (!this.#animated) return;
    this.#animated.disabled = !hasSteps;
    if (hasSteps) this.#animated.removeAttribute('title');
    else this.#animated.title = this.#noStepsHint;
  }

  open(focus: 'first' | 'last' = 'first'): void {
    this.#list.hidden = false;
    this.#button.setAttribute('aria-expanded', 'true');
    const enabled = this.#enabled();
    (focus === 'first' ? enabled[0] : enabled[enabled.length - 1])?.focus();
  }

  close(returnFocus: boolean): void {
    this.#list.hidden = true;
    this.#button.setAttribute('aria-expanded', 'false');
    if (returnFocus) this.#button.focus();
  }

  #enabled(): HTMLButtonElement[] {
    return this.#items.filter((item) => !item.disabled);
  }

  #onKey(e: KeyboardEvent): void {
    const enabled = this.#enabled();
    const index = enabled.indexOf(document.activeElement as HTMLButtonElement);
    let next: HTMLButtonElement | undefined;
    if (e.key === 'ArrowDown') next = enabled[(index + 1) % enabled.length];
    else if (e.key === 'ArrowUp') next = enabled[(index - 1 + enabled.length) % enabled.length];
    else if (e.key === 'Home') next = enabled[0];
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
