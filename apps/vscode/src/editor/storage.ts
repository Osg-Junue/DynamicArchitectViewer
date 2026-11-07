const DB_NAME = 'dav-editor-db';
const DB_VERSION = 1;
const STORE_NAME = 'workspace';
const CURRENT_KEY = 'current';
const FALLBACK_STORAGE_KEY = 'dav-editor-workspace-v1';

export interface SavedWorkspace {
  dsl: string;
  sampleId: string;
  updatedAt: number;
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('indexedDB unavailable'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('indexedDB open failed'));
  });
}

export async function loadWorkspace(): Promise<SavedWorkspace | null> {
  try {
    const db = await openDatabase();
    return await new Promise<SavedWorkspace | null>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(CURRENT_KEY);
      req.onsuccess = () => {
        db.close();
        const val = req.result as unknown;
        if (isValidWorkspace(val)) resolve(val);
        else resolve(null);
      };
      req.onerror = () => {
        db.close();
        reject(req.error ?? new Error('indexedDB get failed'));
      };
    });
  } catch {
    try {
      const raw =
        typeof localStorage !== 'undefined' ? localStorage.getItem(FALLBACK_STORAGE_KEY) : null;
      if (!raw) return null;
      const parsed = JSON.parse(raw) as unknown;
      return isValidWorkspace(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }
}

export async function saveWorkspace(workspace: SavedWorkspace): Promise<void> {
  try {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(workspace, CURRENT_KEY);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        reject(tx.error ?? new Error('indexedDB put failed'));
      };
    });
  } catch {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(FALLBACK_STORAGE_KEY, JSON.stringify(workspace));
      }
    } catch {
      // Ignore storage quota errors
    }
  }
}

function isValidWorkspace(v: unknown): v is SavedWorkspace {
  if (typeof v !== 'object' || v === null) return false;
  const r = v as Record<string, unknown>;
  return (
    typeof r.dsl === 'string' && typeof r.sampleId === 'string' && typeof r.updatedAt === 'number'
  );
}

export function safeFileName(title: string): string {
  const cleaned = Array.from(title, (ch) =>
    ch.charCodeAt(0) < 0x20 || /[\\/:*?"<>|]/.test(ch) ? '_' : ch,
  )
    .join('')
    .trim();
  return cleaned.length > 0 ? cleaned.slice(0, 80) : 'diagram';
}

export function downloadTextFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
