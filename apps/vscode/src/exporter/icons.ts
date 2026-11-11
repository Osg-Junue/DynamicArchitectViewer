import type { DavDocument, IconName } from '../model/types';
import { ICON_SHAPES, type IconShapes } from '../scene/icons';

/** Collects the subset of icon artwork referenced by a document's nodes and packet animations. */
export function collectUsedIcons(
  document: DavDocument,
  iconShapes: IconShapes = ICON_SHAPES,
): IconShapes {
  const names = new Set<IconName>(document.nodes.map((node) => node.icon));
  for (const step of document.steps) {
    for (const animation of step.animations) {
      if (animation.icon !== undefined) names.add(animation.icon);
    }
  }
  const icons: IconShapes = {};
  for (const name of names) {
    const shapes = iconShapes[name];
    if (shapes !== undefined) icons[name] = shapes;
  }
  return icons;
}
