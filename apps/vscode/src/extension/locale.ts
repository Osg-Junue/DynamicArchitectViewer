import * as vscode from 'vscode';

/** VS Code's display language, narrowed to the languages this extension is written in. */
export function uiLocale(): 'ja' | 'en' {
  return vscode.env.language.toLowerCase().startsWith('ja') ? 'ja' : 'en';
}

export const t = (ja: string, en: string): string => (uiLocale() === 'ja' ? ja : en);
