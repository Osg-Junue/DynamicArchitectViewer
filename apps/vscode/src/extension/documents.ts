import * as vscode from 'vscode';
import { format } from '../dsl';
import { exportHtml } from '../exporter';
import { t, uiLocale } from './locale';

export const LANGUAGE_ID = 'dav';

export function toRange(doc: vscode.TextDocument, from: number, to: number): vscode.Range {
  const len = doc.getText().length;
  const safeFrom = Math.max(0, Math.min(from, len));
  const safeTo = Math.max(safeFrom, Math.min(to, len));
  return new vscode.Range(doc.positionAt(safeFrom), doc.positionAt(safeTo));
}

/** The edit that formats a whole document; `undefined` when it is already formatted. */
export function formattingEdit(
  doc: vscode.TextDocument,
): { range: vscode.Range; text: string } | undefined {
  const text = doc.getText();
  const formatted = format(text);
  return formatted === text ? undefined : { range: toRange(doc, 0, text.length), text: formatted };
}

export async function exportDocumentToHtml(
  doc: vscode.TextDocument,
  overrideDsl?: string,
): Promise<void> {
  const dsl = overrideDsl ?? doc.getText();
  const html = await exportHtml(dsl, { locale: uiLocale() });
  const defaultPath = `${doc.uri.fsPath.replace(/\.dav$/i, '')}.html`;
  const targetUri = await vscode.window.showSaveDialog({
    defaultUri: doc.isUntitled ? vscode.Uri.file('diagram.html') : vscode.Uri.file(defaultPath),
    filters: { [t('スタンドアロン HTML', 'Standalone HTML')]: ['html'] },
  });
  if (!targetUri) return;
  await vscode.workspace.fs.writeFile(targetUri, new TextEncoder().encode(html));
  void vscode.window.showInformationMessage(
    `${t('HTML を書き出しました', 'Exported standalone HTML')}: ${targetUri.fsPath}`,
  );
}
