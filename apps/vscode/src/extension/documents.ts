import { homedir } from 'node:os';
import * as vscode from 'vscode';
import { hasFatalError, type ParseResult, parse } from '../dsl';
import { exportHtml, exportSvg } from '../exporter';
import type { SvgCamera } from '../protocol/messages';
import { t, uiLocale } from './locale';

export const LANGUAGE_ID = 'dav';

export interface PickedSvgExport {
  dsl: string;
  animate: boolean;
  camera: SvgCamera;
  step: number | null;
}

interface SvgKindOption {
  animate: boolean;
  camera: SvgCamera;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function toRange(
  doc: vscode.TextDocument,
  from: number,
  to: number,
  textLength = doc.getText().length,
): vscode.Range {
  const safeFrom = clamp(from, 0, textLength);
  const safeTo = clamp(to, safeFrom, textLength);
  return new vscode.Range(doc.positionAt(safeFrom), doc.positionAt(safeTo));
}

/** Next to the diagram, by the same name; `suffix` tells apart an export of part of it. */
function defaultExportUri(doc: vscode.TextDocument, ext: 'html' | 'svg', suffix = ''): vscode.Uri {
  if (!doc.isUntitled) {
    return vscode.Uri.file(`${doc.uri.fsPath.replace(/\.dav$/i, '')}${suffix}.${ext}`);
  }
  const base = vscode.workspace.workspaceFolders?.[0]?.uri ?? vscode.Uri.file(homedir());
  return vscode.Uri.joinPath(base, `diagram${suffix}.${ext}`);
}

/** Says why nothing is exported while the text cannot be drawn; `true` when that is the case. */
function refuseFatal(parsed: ParseResult): boolean {
  if (!hasFatalError(parsed)) return false;
  void vscode.window.showWarningMessage(
    t(
      '構文エラーがあり描ける図がないため、書き出しませんでした。エラーを直してから書き出してください。',
      'Nothing was exported: the diagram has a syntax error and nothing to draw. Fix the error, then export.',
    ),
  );
  return true;
}

async function saveExportedFile(
  defaultUri: vscode.Uri,
  filters: Record<string, string[]>,
  content: string,
  doneLabel: string,
): Promise<void> {
  const targetUri = await vscode.window.showSaveDialog({ defaultUri, filters });
  if (!targetUri) return;
  await vscode.workspace.fs.writeFile(targetUri, new TextEncoder().encode(content));
  void vscode.window.showInformationMessage(`${doneLabel}: ${targetUri.fsPath}`);
}

export async function exportDocumentToHtml(
  doc: vscode.TextDocument,
  overrideDsl?: string,
): Promise<void> {
  const dsl = overrideDsl ?? doc.getText();
  if (refuseFatal(parse(dsl))) return;
  const html = await exportHtml(dsl, { locale: uiLocale() });
  await saveExportedFile(
    defaultExportUri(doc, 'html'),
    { [t('スタンドアロン HTML', 'Standalone HTML')]: ['html'] },
    html,
    t('HTML を書き出しました', 'Exported standalone HTML'),
  );
}

async function pickSvgKind(): Promise<SvgKindOption | undefined> {
  const items: Array<vscode.QuickPickItem & { options: SvgKindOption }> = [
    {
      label: t('アニメーション', 'Animated'),
      detail: t(
        'すべてのステップを繰り返し再生し、カメラが流れを追います',
        'Plays every step in a loop, with the camera following the flow',
      ),
      options: { animate: true, camera: 'follow' },
    },
    {
      label: t('アニメーション（全体固定）', 'Animated, whole diagram'),
      detail: t(
        '図全体を映したまま、すべてのステップを繰り返し再生します',
        'Plays every step in a loop with the whole diagram in view',
      ),
      options: { animate: true, camera: 'whole' },
    },
    {
      label: t('静止画', 'Still'),
      detail: t('図全体を 1 枚の画像にします', 'The whole diagram as one picture'),
      options: { animate: false, camera: 'follow' },
    },
  ];
  const kind = await vscode.window.showQuickPick(items, {
    placeHolder: t('書き出す SVG の種類', 'Kind of SVG to export'),
  });
  return kind?.options;
}

/**
 * Exports an SVG image for places that run no script, such as a README: animated with the camera
 * following the steps or kept on the whole diagram, or a still picture of the whole diagram. The
 * preview's Export menu has already picked the kind, and maybe the one step it shows, and sends
 * the text it shows; the command asks for the kind and exports every step.
 */
export async function exportDocumentToSvg(
  doc: vscode.TextDocument,
  picked?: PickedSvgExport,
): Promise<void> {
  const parsed = parse(picked?.dsl ?? doc.getText());
  if (refuseFatal(parsed)) return;
  const { document } = parsed;
  let options: SvgKindOption = {
    animate: picked?.animate ?? true,
    camera: picked?.camera ?? 'follow',
  };
  if (!picked && document.steps.length > 0) {
    const chosen = await pickSvgKind();
    if (!chosen) return;
    options = chosen;
  }
  const step = picked?.step ?? null;
  if (step !== null && (!Number.isInteger(step) || step < 0 || step >= document.steps.length)) {
    void vscode.window.showWarningMessage(
      t(
        `ステップ ${step + 1} は存在しません（全 ${document.steps.length} ステップ）。`,
        `Step ${step + 1} does not exist (${document.steps.length} steps in diagram).`,
      ),
    );
    return;
  }
  const svg = exportSvg(document, {
    locale: uiLocale(),
    ...options,
    ...(step === null ? {} : { step }),
  });
  await saveExportedFile(
    defaultExportUri(doc, 'svg', step === null ? '' : `-step${step + 1}`),
    { SVG: ['svg'] },
    svg,
    t('SVG を書き出しました', 'Exported SVG'),
  );
}
