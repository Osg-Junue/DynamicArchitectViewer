import { homedir } from 'node:os';
import * as vscode from 'vscode';
import { format, parse } from '../dsl';
import { exportHtml, exportSvg } from '../exporter';
import type { SvgCamera } from '../protocol/messages';
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

function defaultExportUri(doc: vscode.TextDocument, ext: 'html' | 'svg'): vscode.Uri {
  if (!doc.isUntitled) {
    return vscode.Uri.file(`${doc.uri.fsPath.replace(/\.dav$/i, '')}.${ext}`);
  }
  const base = vscode.workspace.workspaceFolders?.[0]?.uri ?? vscode.Uri.file(homedir());
  return vscode.Uri.joinPath(base, `diagram.${ext}`);
}

export async function exportDocumentToHtml(
  doc: vscode.TextDocument,
  overrideDsl?: string,
): Promise<void> {
  const dsl = overrideDsl ?? doc.getText();
  const html = await exportHtml(dsl, { locale: uiLocale() });
  const targetUri = await vscode.window.showSaveDialog({
    defaultUri: defaultExportUri(doc, 'html'),
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
 * following the steps or kept on the whole diagram, or a still picture of the whole diagram. The
 * preview's Export menu has already picked the kind and sends the text it shows; the command asks
 * for the kind.
 */
export async function exportDocumentToSvg(
  doc: vscode.TextDocument,
  picked?: { dsl: string; animate: boolean; camera: SvgCamera },
): Promise<void> {
  const { document } = parse(picked?.dsl ?? doc.getText());
  let options = { animate: picked?.animate ?? true, camera: picked?.camera ?? 'follow' };
  if (!picked && document.steps.length > 0) {
    const kind = await vscode.window.showQuickPick(
      [
        {
          label: t('アニメーション', 'Animated'),
          detail: t(
            'すべてのステップを繰り返し再生し、カメラが流れを追います',
            'Plays every step in a loop, with the camera following the flow',
          ),
          options: { animate: true, camera: 'follow' as const },
        },
        {
          label: t('アニメーション（全体固定）', 'Animated, whole diagram'),
          detail: t(
            '図全体を映したまま、すべてのステップを繰り返し再生します',
            'Plays every step in a loop with the whole diagram in view',
          ),
          options: { animate: true, camera: 'whole' as const },
        },
        {
          label: t('静止画', 'Still'),
          detail: t('図全体を 1 枚の画像にします', 'The whole diagram as one picture'),
          options: { animate: false, camera: 'follow' as const },
        },
      ],
      { placeHolder: t('書き出す SVG の種類', 'Kind of SVG to export') },
    );
    if (!kind) return;
    options = kind.options;
  }
  const svg = exportSvg(document, { locale: uiLocale(), ...options });
  const targetUri = await vscode.window.showSaveDialog({
    defaultUri: defaultExportUri(doc, 'svg'),
    filters: { SVG: ['svg'] },
  });
  if (!targetUri) return;
  await vscode.workspace.fs.writeFile(targetUri, new TextEncoder().encode(svg));
  void vscode.window.showInformationMessage(
    `${t('SVG を書き出しました', 'Exported SVG')}: ${targetUri.fsPath}`,
  );
}
