import { clear, html } from './dom';

export interface MenuItem {
  value: string;
  label: string;
}

export interface MenuOptions {
  /** The menu's accessible name. */
  label: string;
  /** `data-testid` of each item: `<prefix>-<value>`. */
  testIdPrefix: string;
  /** Which edge of the host the list lines up with. */
  align: 'start' | 'end';
  /** A choice among values, the current one marked as on; otherwise a list of actions. */
  choice: boolean;
  onChoose(value: string): void;
}

/**
 * The one dropdown of the bar: a button that opens a list under it. The list takes the keys of a
 * menu (arrows, Home, End, Escape, Tab) and closes on a choice, a click elsewhere or Escape.
 * The step list, the speed and the arrow of the play button are all one of these.
 */
export class Menu {
  readonly list: HTMLElement;
  readonly #toggle: HTMLButtonElement;
  readonly #host: HTMLElement;
  readonly #options: MenuOptions;
  #items: HTMLButtonElement[] = [];
  #onOutside: ((e: PointerEvent) => void) | null = null;

  /** `host` is the positioned element the list hangs from; a click inside it keeps it open. */
  constructor(toggle: HTMLButtonElement, host: HTMLElement, options: MenuOptions) {
    this.#toggle = toggle;
    this.#host = host;
    this.#options = options;
    this.list = html('div', {
      class: options.align === 'start' ? 'dav-menu is-start' : 'dav-menu',
      role: 'menu',
      'aria-label': options.label,
    });
    this.list.hidden = true;
    host.append(this.list);
    toggle.setAttribute('aria-haspopup', 'menu');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.addEventListener('click', () => (this.list.hidden ? this.open() : this.close(false)));
    toggle.addEventListener('keydown', (e) => {
      if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && this.list.hidden && !toggle.disabled) {
        e.preventDefault();
        this.open();
      }
    });
    // Handled keys are marked as handled, so that the player's step keys leave them alone.
    this.list.addEventListener('keydown', (e) => {
      const at = this.#items.indexOf(e.target as HTMLButtonElement);
      const last = this.#items.length - 1;
      if (e.key === 'ArrowDown') this.#items[at < last ? at + 1 : 0]?.focus();
      else if (e.key === 'ArrowUp') this.#items[at > 0 ? at - 1 : last]?.focus();
      else if (e.key === 'Home') this.#items[0]?.focus();
      else if (e.key === 'End') this.#items[last]?.focus();
      else if (e.key === 'Escape') this.close(true);
      else if (e.key === 'Tab') {
        this.close(false);
        return;
      } else if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      e.preventDefault();
    });
  }

  setItems(items: readonly MenuItem[]): void {
    const { testIdPrefix, choice, onChoose } = this.#options;
    clear(this.list);
    this.#items = items.map(({ value, label }) => {
      const item = html(
        'button',
        {
          type: 'button',
          role: choice ? 'menuitemradio' : 'menuitem',
          class: 'dav-btn',
          tabindex: '-1',
          'data-value': value,
          'data-testid': `${testIdPrefix}-${value}`,
          ...(choice ? { 'aria-checked': 'false' } : {}),
        },
        html('span', {}, label),
      );
      item.addEventListener('click', () => {
        this.close(true);
        onChoose(value);
      });
      return item;
    });
    this.list.append(...this.#items);
  }

  /** Marks the current value of a choice. */
  setChecked(value: string | null): void {
    for (const item of this.#items) {
      item.setAttribute('aria-checked', String(item.dataset.value === value));
    }
  }

  open(): void {
    this.list.hidden = false;
    this.#toggle.setAttribute('aria-expanded', 'true');
    const current =
      this.#items.find((item) => item.getAttribute('aria-checked') === 'true') ?? this.#items[0];
    current?.focus();
    current?.scrollIntoView({ block: 'nearest' });
    this.#onOutside = (e) => {
      if (!(e.target instanceof Node && this.#host.contains(e.target))) this.close(false);
    };
    document.addEventListener('pointerdown', this.#onOutside, true);
  }

  close(focusToggle: boolean): void {
    if (this.list.hidden) return;
    this.list.hidden = true;
    this.#toggle.setAttribute('aria-expanded', 'false');
    if (this.#onOutside) document.removeEventListener('pointerdown', this.#onOutside, true);
    this.#onOutside = null;
    if (focusToggle) this.#toggle.focus();
  }
}
