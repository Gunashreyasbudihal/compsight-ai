import { Competitor } from '../types';
import { INITIAL_COMPETITORS } from '../logic';
import {
  buildCompetitorFromSnapshot,
  normalizeCompetitorInput,
  safeParseCompetitorDossier,
} from './intelligenceService';

const STORAGE_KEY = 'compsight_v3_intelligence_store';

/**
 * Sanitizes any stored competitor record from localStorage so outdated or partial
 * schemas never cause undefined crashes on page load.
 */
export function sanitizeStoredCompetitor(raw: unknown): Competitor | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return null;
  }
  const obj = raw as Record<string, unknown>;
  const rawDomain =
    typeof obj.domain === 'string' && obj.domain.trim()
      ? obj.domain.trim()
      : typeof obj.url === 'string' && obj.url.trim()
        ? obj.url.trim()
        : typeof obj.name === 'string' && obj.name.trim()
          ? obj.name.trim()
          : '';

  const normalized = normalizeCompetitorInput(rawDomain);
  if (!normalized.valid) {
    return null;
  }

  const brandName =
    typeof obj.name === 'string' && obj.name.trim()
      ? obj.name.trim()
      : normalized.brandName;
  const target = {
    brandName,
    domain: normalized.domain,
    url: normalized.url,
  };

  const rawSnapshots = Array.isArray(obj.snapshots) ? obj.snapshots : [];
  let rebuilt: Competitor | undefined;

  if (rawSnapshots.length > 0) {
    for (const rawSnap of rawSnapshots) {
      const sanitizedSnap = safeParseCompetitorDossier(rawSnap, target);
      if (
        rawSnap &&
        typeof rawSnap === 'object' &&
        typeof (rawSnap as Record<string, unknown>).capturedAtLabel === 'string'
      ) {
        sanitizedSnap.capturedAtLabel = String(
          (rawSnap as Record<string, unknown>).capturedAtLabel,
        );
      }
      rebuilt = buildCompetitorFromSnapshot(target, sanitizedSnap, rebuilt)
        .competitor;
    }
  } else {
    const fallbackSnap = safeParseCompetitorDossier(obj, target);
    rebuilt = buildCompetitorFromSnapshot(target, fallbackSnap).competitor;
  }

  if (!rebuilt) return null;

  if (typeof obj.id === 'string' && obj.id.trim()) {
    rebuilt.id = obj.id.trim();
  }
  if (typeof obj.lastScannedAt === 'string' && obj.lastScannedAt.trim()) {
    rebuilt.lastScannedAt = obj.lastScannedAt.trim();
  }
  if (Array.isArray(obj.chatHistory)) {
    rebuilt.chatHistory = obj.chatHistory
      .filter((m) => m && typeof m === 'object')
      .map((m, i) => {
        const rec = m as Record<string, unknown>;
        const role: 'assistant' | 'user' =
          rec.role === 'assistant' ? 'assistant' : 'user';
        return {
          id: typeof rec.id === 'string' ? rec.id : `msg-${i}`,
          role,
          content: typeof rec.content === 'string' ? rec.content : '',
          timestamp:
            typeof rec.timestamp === 'string' ? rec.timestamp : 'Just now',
        };
      })
      .filter((m) => m.content.trim().length > 0);
  }

  return rebuilt;
}

export class StorageService {
  /**
   * Loads all tracked competitors and their timestamped snapshots from localStorage.
   * Safely handles corrupted or outdated localStorage schemas without crashing.
   */
  static loadCompetitors(): Competitor[] {
    if (typeof window === 'undefined' || !window.localStorage) {
      return [...INITIAL_COMPETITORS];
    }
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw === null) {
        this.saveCompetitors(INITIAL_COMPETITORS);
        return [...INITIAL_COMPETITORS];
      }

      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        window.localStorage.removeItem(STORAGE_KEY);
        return [...INITIAL_COMPETITORS];
      }

      // If the user explicitly deleted all competitors, preserve the empty array
      if (parsed.length === 0) {
        return [];
      }

      const sanitized = parsed
        .map((item) => sanitizeStoredCompetitor(item))
        .filter((item): item is Competitor => item !== null);

      if (sanitized.length === 0) {
        window.localStorage.removeItem(STORAGE_KEY);
        return [...INITIAL_COMPETITORS];
      }

      return sanitized;
    } catch {
      try {
        window.localStorage.removeItem(STORAGE_KEY);
      } catch {
        // Ignore storage access errors
      }
      return [...INITIAL_COMPETITORS];
    }
  }

  /**
   * Persists the full list of competitors, snapshots, diff timelines, and chat history to localStorage.
   */
  static saveCompetitors(competitors: Competitor[]): void {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(competitors));
    } catch {
      // Ignore quota exceeded errors
    }
  }

  /**
   * Inserts or updates a competitor by ID or domain and saves to localStorage.
   */
  static upsertCompetitor(
    competitors: Competitor[],
    updated: Competitor,
  ): Competitor[] {
    const idx = competitors.findIndex(
      (c) =>
        c.id === updated.id ||
        c.domain.toLowerCase() === updated.domain.toLowerCase(),
    );
    let next: Competitor[];
    if (idx >= 0) {
      next = [...competitors];
      next[idx] = updated;
    } else {
      next = [updated, ...competitors];
    }
    this.saveCompetitors(next);
    return next;
  }

  /**
   * Deletes a competitor by ID and persists the remaining list (including empty array if all deleted).
   */
  static deleteCompetitor(
    competitors: Competitor[],
    id: string,
  ): Competitor[] {
    const next = competitors.filter((c) => c.id !== id);
    this.saveCompetitors(next);
    return next;
  }
}
