import { serializeModelToDsl } from '../core/serializer';
import { DiagramModel } from '../core/types';

/**
 * Extracts DSL text from an exported standalone HTML file or raw DSL text file.
 */
export function extractDslFromImportedContent(content: string): string | null {
  const trimmed = content.trim();

  // Case 1: Exported standalone HTML containing <script id="dav-dsl-source" type="text/plain">
  const dslTagMatch = trimmed.match(
    /<script\s+id=["']dav-dsl-source["'][^>]*>([\s\S]*?)<\/script>/i
  );
  if (dslTagMatch) {
    return dslTagMatch[1].replace(/<\\\/script/gi, '</script');
  }

  // Case 2: Exported HTML containing only <script id="dav-model-json" type="application/json">
  const jsonTagMatch = trimmed.match(
    /<script\s+id=["']dav-model-json["'][^>]*>([\s\S]*?)<\/script>/i
  );
  if (jsonTagMatch) {
    try {
      const raw = jsonTagMatch[1].replace(/<\\\/script/gi, '</script');
      const parsed = JSON.parse(raw) as { model?: DiagramModel };
      if (parsed.model) {
        return serializeModelToDsl(parsed.model);
      }
    } catch {
      return null;
    }
  }

  // Case 3: Plain DSL file
  if (!trimmed.toLowerCase().startsWith('<!doctype html') && !trimmed.toLowerCase().startsWith('<html')) {
    return content;
  }

  return null;
}
