import * as vscode from 'vscode';
import { format, parse } from '../dsl';
import { exportHtml, exportSvg } from '../exporter';
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

/**
 * Exports an SVG image for places that run no script, such as a README: animated with the camera
 * following the steps, or a still picture of the whole diagram.
 */
export async function exportDocumentToSvg(doc: vscode.TextDocument): Promise<void> {
  const dsl = doc.getText();
  let animate = true;
  if (parse(dsl).document.steps.length > 0) {
    const picked = await vscode.window.showQuickPick(
      [
        {
          label: t('アニメーション', 'Animated'),
          detail: t(
            'すべてのステップを繰り返し再生し、カメラが流れを追います',
            'Plays every step in a loop, with the camera following the flow',
          ),
          animate: true,
        },
        {
          label: t('静止画', 'Still'),
          detail: t('図全体を 1 枚の画像にします', 'The whole diagram as one picture'),
          animate: false,
        },
      ],
      { placeHolder: t('書き出す SVG の種類', 'Kind of SVG to export') },
    );
    if (!picked) return;
    animate = picked.animate;
  }
  const svg = exportSvg(dsl, { locale: uiLocale(), animate });
  const defaultPath = `${doc.uri.fsPath.replace(/\.dav$/i, '')}.svg`;
  const targetUri = await vscode.window.showSaveDialog({
    defaultUri: doc.isUntitled ? vscode.Uri.file('diagram.svg') : vscode.Uri.file(defaultPath),
    filters: { SVG: ['svg'] },
  });
  if (!targetUri) return;
  await vscode.workspace.fs.writeFile(targetUri, new TextEncoder().encode(svg));
  void vscode.window.showInformationMessage(
    `${t('SVG を書き出しました', 'Exported SVG')}: ${targetUri.fsPath}`,
  );
}
