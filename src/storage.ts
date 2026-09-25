export interface RecentDocument {
  id: string; // Google Doc ID
  url: string; // Google Doc URL
  title: string;
  attribution?: string;
  date?: string;
  updatedAt: number; // Timestamp
}

export const RECENT_DOCS_STORAGE_KEY = "wordcloudy_recent_docs";
export const SAMPLE_DOC_ID = "1qFBWFmyFPxTn3cqXgMqXFX4zyzUWSzM2uCTp9PyXPtc";
export const SAMPLE_DOC_TITLE = "The Constitution of the United States";
export const SAMPLE_DOC_ATTRIBUTION = "Independence Hall, Philadelphia";
export const SAMPLE_DOC_DATE = "September 1787";
export const MAX_RECENT_DOCS = 20;

interface SimpleStorage {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
}

const fallbackStorage: Record<string, string> = {};

function getStorage(): SimpleStorage {
  try {
    if (typeof window !== "undefined") {
      const storage = window.localStorage;
      if (storage) return storage;
    }
  } catch {
    // Blocked storage or SecurityError
  }

  try {
    if (typeof globalThis !== "undefined") {
      const candidate = globalThis as { localStorage?: SimpleStorage };
      if (candidate.localStorage) {
        return candidate.localStorage;
      }
    }
  } catch {
    // Blocked storage or SecurityError
  }

  return {
    getItem: (key: string) => fallbackStorage[key] ?? null,
    setItem: (key: string, value: string) => {
      fallbackStorage[key] = value;
    },
    removeItem: (key: string) => {
      delete fallbackStorage[key];
    },
  };
}

function isRecentDocument(item: unknown): item is RecentDocument {
  if (!item || typeof item !== "object") return false;
  if (!("id" in item) || typeof item.id !== "string" || !item.id.trim()) return false;
  if (!("url" in item) || typeof item.url !== "string") return false;
  if (!("title" in item) || typeof item.title !== "string") return false;
  return true;
}

export function getRecentDocuments(): RecentDocument[] {
  try {
    const storage = getStorage();
    const raw = storage.getItem(RECENT_DOCS_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isRecentDocument);
  } catch (err) {
    console.error("Failed to read recent documents from localStorage:", err);
    return [];
  }
}

export function saveRecentDocument(doc: {
  id: string;
  url?: string;
  title?: string;
  attribution?: string;
  date?: string;
}): RecentDocument[] {
  const cleanId = doc.id?.trim();
  if (!cleanId || cleanId === SAMPLE_DOC_ID) {
    return getRecentDocuments();
  }

  try {
    const storage = getStorage();
    const existing = getRecentDocuments();
    const cleanUrl = doc.url?.trim();
    const isHttpUrl =
      Boolean(cleanUrl) && (cleanUrl!.startsWith("https://") || cleanUrl!.startsWith("http://"));
    const gdocUrl = isHttpUrl ? cleanUrl! : `https://docs.google.com/document/d/${cleanId}/edit`;

    const newEntry: RecentDocument = {
      id: cleanId,
      url: gdocUrl,
      title: doc.title?.trim() || "Untitled Google Doc",
      attribution: doc.attribution?.trim() || undefined,
      date: doc.date?.trim() || undefined,
      updatedAt: Date.now(),
    };

    // Filter out previous entry with the same ID, prepend new entry, and limit size
    const filtered = existing.filter((item) => item.id !== cleanId);
    const updated = [newEntry, ...filtered].slice(0, MAX_RECENT_DOCS);
    storage.setItem(RECENT_DOCS_STORAGE_KEY, JSON.stringify(updated));
    return updated;
  } catch (err) {
    console.error("Failed to save recent document to localStorage:", err);
    return getRecentDocuments();
  }
}

export function removeRecentDocument(id: string): RecentDocument[] {
  try {
    const storage = getStorage();
    const existing = getRecentDocuments();
    const updated = existing.filter((item) => item.id !== id);
    storage.setItem(RECENT_DOCS_STORAGE_KEY, JSON.stringify(updated));
    return updated;
  } catch (err) {
    console.error("Failed to remove recent document from localStorage:", err);
    return getRecentDocuments();
  }
}

export function clearRecentDocuments(): void {
  try {
    const storage = getStorage();
    storage.removeItem(RECENT_DOCS_STORAGE_KEY);
  } catch (err) {
    console.error("Failed to clear recent documents from localStorage:", err);
  }
}
