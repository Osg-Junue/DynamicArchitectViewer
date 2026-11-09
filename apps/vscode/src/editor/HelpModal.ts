import { clear, html } from '../runtime/dom';
import type { ViewerLocale } from '../runtime/i18n';
import type { Translate } from './docs/figures';
import { DOC_GROUPS, DOC_PAGES, type DocContext, rich } from './docs/pages';

function initialLocale(): ViewerLocale {
  return navigator.language.toLowerCase().startsWith('ja') ? 'ja' : 'en';
}

const LOCALE_LABELS: ReadonlyArray<readonly [ViewerLocale, string]> = [
  ['ja', '日本語'],
  ['en', 'English'],
];

/** The viewer's documentation: a page per topic, with live examples on the active page only. */
export class HelpModal {
  readonly element: HTMLDialogElement;
  private locale: ViewerLocale = initialLocale();
  private currentDsl = '';
  private pageId: string = DOC_PAGES[0]?.id ?? '';
  private readonly promptState = { includeCurrent: false };
  private cleanups: Array<() => void> = [];
  private readonly navEl: HTMLElement;
  private readonly contentEl: HTMLElement;
  private readonly titleEl: HTMLElement;
  private readonly closeBtn: HTMLButtonElement;
  private readonly localeButtons = new Map<ViewerLocale, HTMLButtonElement>();

  constructor() {
    this.titleEl = html('span', { class: 'doc-title' });
    this.navEl = html('nav', { class: 'doc-nav' });
    this.contentEl = html('main', { class: 'doc-content' });
    this.closeBtn = html('button', {
      type: 'button',
      class: 'btn',
      'data-testid': 'help-close-btn',
    });
    this.closeBtn.addEventListener('click', () => this.close());

    const localeSwitch = html('div', {
      class: 'doc-locale',
      role: 'group',
      'aria-label': 'Language',
    });
    for (const [locale, label] of LOCALE_LABELS) {
      const button = html(
        'button',
        { type: 'button', class: 'doc-locale-btn', 'data-testid': `doc-locale-${locale}` },
        label,
      );
      button.addEventListener('click', () => {
        this.locale = locale;
        this.render();
      });
      this.localeButtons.set(locale, button);
      localeSwitch.append(button);
    }

    this.element = html(
      'dialog',
      { class: 'doc-dialog', 'data-testid': 'help-dialog' },
      html(
        'header',
        { class: 'doc-header' },
        this.titleEl,
        html('div', { class: 'doc-header-tools' }, localeSwitch, this.closeBtn),
      ),
      html('div', { class: 'doc-layout' }, this.navEl, this.contentEl),
    );

    // A drag that starts on the page and ends outside it also clicks the dialog.
    let pressedBackdrop = false;
    this.element.addEventListener('pointerdown', (e) => {
      pressedBackdrop = e.target === this.element;
    });
    this.element.addEventListener('click', (e) => {
      if (e.target === this.element && pressedBackdrop) this.close();
    });
    this.element.addEventListener('close', () => this.disposePage());
  }

  open(): void {
    if (!this.element.open) this.element.showModal();
    this.render();
  }

  close(): void {
    this.element.close();
  }

  /** Only a prompt that embeds the diagram depends on it, so other pages keep playing undisturbed. */
  update(currentDsl: string): void {
    this.currentDsl = currentDsl;
    if (this.element.open && this.pageId === 'prompt' && this.promptState.includeCurrent) {
      this.render();
    }
  }

  private readonly t: Translate = (ja, en) => (this.locale === 'ja' ? ja : en);

  private disposePage(): void {
    for (const cleanup of this.cleanups) cleanup();
    this.cleanups = [];
  }

  private go(pageId: string): void {
    this.pageId = pageId;
    this.render();
    this.contentEl.scrollTop = 0;
    // Rendering replaced the nav buttons, including the one that held the focus.
    this.navEl.querySelector<HTMLElement>('[aria-current="page"]')?.focus();
  }

  private render(): void {
    const { t } = this;
    this.disposePage();
    this.titleEl.textContent = t('ドキュメント', 'Documentation');
    this.closeBtn.textContent = t('閉じる', 'Close');
    for (const [locale, button] of this.localeButtons) {
      button.classList.toggle('active', locale === this.locale);
      button.setAttribute('aria-pressed', String(locale === this.locale));
    }
    this.renderNav();

    const page = DOC_PAGES.find((candidate) => candidate.id === this.pageId);
    clear(this.contentEl);
    if (!page) return;
    const ctx: DocContext = {
      t,
      locale: this.locale,
      currentDsl: this.currentDsl,
      prompt: this.promptState,
      go: (id) => this.go(id),
      track: (cleanup) => this.cleanups.push(cleanup),
    };
    this.contentEl.append(
      html(
        'article',
        { class: 'doc-page' },
        html('h1', {}, t(...page.title)),
        html('p', { class: 'doc-lead' }, ...rich(t(...page.lead))),
        ...page.render(ctx),
      ),
    );
  }

  private renderNav(): void {
    clear(this.navEl);
    for (const [group, ja, en] of DOC_GROUPS) {
      const pages = DOC_PAGES.filter((page) => page.group === group);
      this.navEl.append(
        html(
          'div',
          { class: 'doc-nav-group' },
          html('div', { class: 'doc-nav-title' }, this.t(ja, en)),
          ...pages.map((page) => {
            const current = page.id === this.pageId;
            const button = html(
              'button',
              {
                type: 'button',
                class: current ? 'doc-nav-item active' : 'doc-nav-item',
                'data-testid': `doc-nav-${page.id}`,
                'aria-current': current ? 'page' : undefined,
              },
              this.t(...page.title),
            );
            button.addEventListener('click', () => this.go(page.id));
            return button;
          }),
        ),
      );
    }
  }
}
