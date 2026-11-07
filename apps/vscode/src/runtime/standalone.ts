import { EXPORT_DATA_ELEMENT_ID } from './constants';
import { Player, type PlayerData } from './player';

/**
 * Entry point of the runtime bundle inlined into exported HTML files.
 * Reads the embedded payload and mounts the player on <body>.
 */
function boot(): void {
  const source = document.getElementById(EXPORT_DATA_ELEMENT_ID);
  if (!source?.textContent) return;
  const payload = JSON.parse(source.textContent) as PlayerData & { locale?: 'ja' | 'en' };
  const options = payload.locale
    ? { locale: payload.locale, globalKeyboard: true }
    : { globalKeyboard: true };
  const player = new Player(document.body, payload, options);
  // Expose for debugging and automated tests.
  (window as unknown as { davPlayer?: Player }).davPlayer = player;
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
