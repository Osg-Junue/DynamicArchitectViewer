import * as vscode from 'vscode';
import type { DavLocale } from '../model/types';

export type Locale = DavLocale;

/** VS Code's display language, narrowed to the languages this extension is written in. */
export function uiLocale(): Locale {
  return vscode.env.language.toLowerCase().startsWith('ja') ? 'ja' : 'en';
}

export const t = (ja: string, en: string): string => (uiLocale() === 'ja' ? ja : en);
