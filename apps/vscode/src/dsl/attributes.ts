import type { SyntaxNode } from '@lezer/common';
import {
  COLOR_NAMES,
  COLOR_RESET,
  type ColorName,
  ICON_NAMES,
  type IconName,
  isColorName,
  isIconName,
} from '../model/types';
import type { DiagnosticCode, Severity } from './diagnostics';
import {
  ATTRIBUTE_SCHEMA,
  type AttrOwner,
  type AttrType,
  type AttrValueByType,
  type OwnerAttrs,
} from './schema';
import type { SourceRange } from './sourceMap';
import { closestMatch } from './suggest';
import { attributeValueNode, sliceOf, unescapeString } from './syntax';

export type DiagnosticReporter = (
  code: DiagnosticCode,
  severity: Severity,
  range: SourceRange,
  args?: Record<string, string>,
) => void;

export interface ValidAttr<V = AttrValueByType[AttrType]> {
  value: V;
  node: SyntaxNode;
}

export interface ParsedAttrs<O extends AttrOwner> {
  get<K extends keyof OwnerAttrs<O> & string>(key: K): ValidAttr<OwnerAttrs<O>[K]> | undefined;
  value<K extends keyof OwnerAttrs<O> & string>(key: K): OwnerAttrs<O>[K] | undefined;
  readonly entries: ReadonlyMap<string, ValidAttr>;
}

const EXPECTED_BY_TYPE: Record<AttrType, string> = {
  string: '"..."',
  bool: 'true | false',
  color: COLOR_NAMES.join(' | '),
  stateColor: [...COLOR_NAMES, COLOR_RESET].join(' | '),
  icon: ICON_NAMES.join(' | '),
  ident: 'identifier',
};

/** Decodes a `"..."` syntax node and reports any invalid escape sequences. */
export function readStringLiteral(
  text: string,
  node: SyntaxNode,
  report: DiagnosticReporter,
): string {
  const { value, invalid } = unescapeString(sliceOf(text, node));
  for (const esc of invalid) {
    const from = node.from + esc.offset;
    report(
      'invalid-escape',
      'error',
      { from, to: from + esc.sequence.length },
      { sequence: esc.sequence },
    );
  }
  return value;
}

/** Reads and validates an attribute list. Invalid entries are reported and omitted. */
export function readAttributes<O extends AttrOwner>(
  text: string,
  node: SyntaxNode | null,
  owner: O,
  report: DiagnosticReporter,
): ParsedAttrs<O> {
  const entries = new Map<string, ValidAttr>();
  if (node) {
    const schema = ATTRIBUTE_SCHEMA[owner];
    const seen = new Set<string>();

    for (const attr of node.getChildren('Attribute')) {
      const nameNode = attr.getChild('AttrName');
      const valueNode = attributeValueNode(attr);
      if (!nameNode || !valueNode) continue;
      const name = sliceOf(text, nameNode);

      const type = Object.hasOwn(schema, name) ? schema[name] : undefined;
      if (!type) {
        report('unknown-attribute', 'warning', nameNode, { name, owner });
        continue;
      }
      if (seen.has(name)) {
        report('duplicate-attribute', 'warning', nameNode, { name });
      }
      seen.add(name);

      const value = convertValue(text, name, type, valueNode, report);
      if (value !== undefined) entries.set(name, { value, node: valueNode });
    }
  }
  return {
    entries,
    get: <K extends keyof OwnerAttrs<O> & string>(key: K) =>
      entries.get(key) as ValidAttr<OwnerAttrs<O>[K]> | undefined,
    value: <K extends keyof OwnerAttrs<O> & string>(key: K) =>
      entries.get(key)?.value as OwnerAttrs<O>[K] | undefined,
  };
}

export function convertValue(
  text: string,
  name: string,
  type: AttrType,
  node: SyntaxNode,
  report: DiagnosticReporter,
): AttrValueByType[AttrType] | undefined {
  const raw = sliceOf(text, node);
  const invalid = () => {
    report('invalid-attribute-value', 'error', node, {
      name,
      expected: EXPECTED_BY_TYPE[type],
    });
    return undefined;
  };

  switch (type) {
    case 'string':
      return node.name === 'String' ? readStringLiteral(text, node, report) : invalid();
    case 'bool':
      return node.name === 'Boolean' ? raw === 'true' : invalid();
    case 'ident':
      return node.name === 'Identifier' ? raw : invalid();
    case 'color':
    case 'stateColor':
      if (node.name !== 'Identifier' && node.name !== 'Color') return invalid();
      return coerceColor(raw, node, type === 'stateColor', report);
    case 'icon':
      if (node.name !== 'Identifier') return invalid();
      return coerceIcon(raw, node, report);
  }
}

function coerceColor(
  raw: string,
  node: SyntaxNode,
  allowsReset: boolean,
  report: DiagnosticReporter,
): ColorName | typeof COLOR_RESET | undefined {
  const colorName = raw.toLowerCase();
  if (isColorName(colorName)) return colorName;
  if (allowsReset && colorName === COLOR_RESET) return COLOR_RESET;
  const suggestion = node.name === 'Color' ? undefined : closestMatch(raw, COLOR_NAMES);
  report('invalid-color', 'error', node, {
    value: raw,
    suggestion: suggestion ?? '',
    names: (allowsReset ? [...COLOR_NAMES, COLOR_RESET] : COLOR_NAMES).join(', '),
  });
  return undefined;
}

function coerceIcon(
  raw: string,
  node: SyntaxNode,
  report: DiagnosticReporter,
): IconName | undefined {
  const iconName = raw.toLowerCase();
  if (isIconName(iconName)) return iconName;
  report('unknown-icon', 'error', node, {
    icon: raw,
    suggestion: closestMatch(raw, ICON_NAMES) ?? '',
  });
  return undefined;
}
