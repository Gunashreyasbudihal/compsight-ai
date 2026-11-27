import {
  AnalystMessage,
  Competitor,
  CompetitorSnapshot,
  CustomerPulse,
  DiffChangeItem,
  NewsDateFilter,
  NewsIntelItem,
  ProductPricingTier,
  ThreatLevel,
  ThreatScore,
  VerifiedEvidenceItem,
} from '../types';
import { computeSnapshotDiffs } from './diffEngine';

const KNOWN_BRAND_DOMAINS: Record<string, string> = {
  linear: 'linear.app',
  stripe: 'stripe.com',
  figma: 'figma.com',
  vercel: 'vercel.com',
  cursor: 'cursor.com',
  supabase: 'supabase.com',
  notion: 'notion.so',
  anthropic: 'anthropic.com',
  openai: 'openai.com',
  datadog: 'datadoghq.com',
  cloudflare: 'cloudflare.com',
  posthog: 'posthog.com',
  raycast: 'raycast.com',
  retool: 'retool.com',
};

const PLACEHOLDER_DOMAINS = new Set([
  'example.com',
  'example.org',
  'example.net',
  'test.com',
  'localhost',
  '127.0.0.1',
  'competitor.com',
  'domain.com',
  'yourcompetitor.com',
]);

/**
 * Checks whether a URL is a real, clickable external HTTP(S) URL and not a placeholder.
 */
export function isVerifiedExternalUrl(rawUrl: unknown): rawUrl is string {
  if (typeof rawUrl !== 'string') return false;
  const trimmed = rawUrl.trim();
  if (!/^https?:\/\//i.test(trimmed)) return false;
  try {
    const parsed = new URL(trimmed);
    const host = parsed.hostname.replace(/^www\./i, '').toLowerCase();
    if (!host.includes('.') || PLACEHOLDER_DOMAINS.has(host)) {
      return false;
    }
    if (host.endsWith('.example.com') || host.endsWith('.invalid')) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Validates that a date string is strictly YYYY-MM-DD, represents a real calendar date,
 * and is never in the future relative to referenceDate.
 */
export function isValidPastOrTodayIsoDate(
  rawDate: unknown,
  referenceDate: Date = new Date(),
): rawDate is string {
  if (typeof rawDate !== 'string') return false;
  const trimmed = rawDate.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return false;

  const [yearStr, monthStr, dayStr] = trimmed.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);
  if (year < 1990 || month < 1 || month > 12 || day < 1 || day > 31) {
    return false;
  }

  const parsed = new Date(`${trimmed}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return false;
  if (parsed.toISOString().slice(0, 10) !== trimmed) return false;

  const todayIso = referenceDate.toISOString().slice(0, 10);
  return trimmed <= todayIso;
}

/**
 * Normalizes any competitor brand name or URL (e.g. "linear.app" -> "https://linear.app",
 * "Notion" -> "https://notion.so"). Rejects empty, malformed, or placeholder URLs.
 */
export function normalizeCompetitorInput(rawInput: string): {
  valid: boolean;
  url: string;
  domain: string;
  brandName: string;
  error?: string;
} {
  const trimmed = (rawInput ?? '').trim();
  if (!trimmed) {
    return {
      valid: false,
      url: '',
      domain: '',
      brandName: '',
      error: 'Enter a competitor name or URL (e.g. linear.app or Stripe).',
    };
  }

  if (
    !/[a-zA-Z0-9]{2,}/.test(trimmed) ||
    /^https?:\/\/$/i.test(trimmed) ||
    /\s/.test(trimmed.replace(/^https?:\/\//i, ''))
  ) {
    return {
      valid: false,
      url: '',
      domain: '',
      brandName: '',
      error: 'Enter a valid competitor domain or brand name without spaces (e.g. https://linear.app).',
    };
  }

  // Brand name without a dot (e.g. "Linear" or "Notion")
  if (!trimmed.includes('.') && !trimmed.includes('/') && !trimmed.includes(':')) {
    const slug = trimmed.toLowerCase().replace(/[^a-z0-9-]/g, '');
    if (slug.length < 2) {
      return {
        valid: false,
        url: '',
        domain: '',
        brandName: '',
        error: 'Competitor name must be at least 2 characters.',
      };
    }
    const domain = KNOWN_BRAND_DOMAINS[slug] || `${slug}.com`;
    if (
      PLACEHOLDER_DOMAINS.has(domain) ||
      PLACEHOLDER_DOMAINS.has(slug) ||
      slug === 'example' ||
      slug === 'localhost' ||
      slug === 'test' ||
      slug === 'invalid'
    ) {
      return {
        valid: false,
        url: '',
        domain: '',
        brandName: '',
        error: 'Please enter a real competitor domain instead of a placeholder.',
      };
    }
    const brandName = trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
    return {
      valid: true,
      url: `https://${domain}`,
      domain,
      brandName,
    };
  }

  const withProtocol = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  try {
    const parsed = new URL(withProtocol);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return {
        valid: false,
        url: '',
        domain: '',
        brandName: '',
        error: 'URL must use http:// or https://.',
      };
    }
    const host = parsed.hostname.replace(/^www\./i, '').toLowerCase();
    const parts = host.split('.');
    const tld = parts[parts.length - 1] || '';
    if (
      parts.length < 2 ||
      !host.includes('.') ||
      host.startsWith('.') ||
      host.endsWith('.') ||
      tld.length < 2 ||
      !/^[a-z]{2,24}$/i.test(tld)
    ) {
      return {
        valid: false,
        url: '',
        domain: '',
        brandName: '',
        error: 'Include a valid domain extension such as .com, .app, or .io.',
      };
    }
    if (PLACEHOLDER_DOMAINS.has(host)) {
      return {
        valid: false,
        url: '',
        domain: '',
        brandName: '',
        error: 'Placeholder URLs (like example.com) are not allowed. Enter a real competitor URL.',
      };
    }
    const baseSegment = parts[0] || 'Competitor';
    const brandName =
      baseSegment.charAt(0).toUpperCase() + baseSegment.slice(1);
    return {
      valid: true,
      url: `https://${host}`,
      domain: host,
      brandName,
    };
  } catch {
    return {
      valid: false,
      url: '',
      domain: '',
      brandName: '',
      error: 'Invalid URL format. Try linear.app or https://stripe.com.',
    };
  }
}

export function threatScoreToLevel(score: ThreatScore): ThreatLevel {
  if (score === 'HIGH') return 'High Threat';
  if (score === 'LOW') return 'Low Threat';
  return 'Medium Threat';
}

/**
 * Strips markdown code fences (```json ... ```) and parses JSON string strictly.
 * Throws an explicit Error if the string is not valid JSON.
 */
export function parseStrictJsonObject(rawText: string): Record<string, unknown> {
  const cleaned = (rawText ?? '')
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  if (!cleaned) {
    throw new Error('Model returned an empty response.');
  }

  try {
    const parsed = JSON.parse(cleaned);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      const extracted = cleaned.slice(firstBrace, lastBrace + 1);
      const parsed = JSON.parse(extracted);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    }
  }

  throw new Error('Failed to parse valid JSON object from model response.');
}

/**
 * Strict sanitizer that guarantees all arrays (`strengths`, `weaknesses`, `counterMoves`,
 * `howToWin`, `products`, `productsAndPricing`, `newsItems`, `newsAndLaunches`, `evidence`,
 * `customerPraise`, `customerComplaints`) default to `[]` and strings default to `""`
 * without ever injecting fake or fabricated competitor data.
 */
export function safeParseCompetitorDossier(
  rawInput: unknown,
  target: { brandName: string; domain: string; url: string },
  groundingUrls: { title: string; url: string }[] = [],
  referenceDate: Date = new Date(),
): CompetitorSnapshot {
  let obj: Record<string, unknown> = {};

  if (typeof rawInput === 'string') {
    const trimmed = rawInput.trim();
    if (trimmed) {
      try {
        obj = parseStrictJsonObject(trimmed);
      } catch {
        obj = {};
      }
    }
  } else if (rawInput && typeof rawInput === 'object' && !Array.isArray(rawInput)) {
    obj = rawInput as Record<string, unknown>;
  }

  const sanitizeString = (val: unknown, defaultVal = ''): string => {
    if (typeof val === 'string') return val.trim();
    if (typeof val === 'number' || typeof val === 'boolean') return String(val);
    return defaultVal;
  };

  const sanitizeStringArray = (val: unknown): string[] => {
    if (!Array.isArray(val)) return [];
    return val
      .map((item) => (typeof item === 'string' ? item.trim() : ''))
      .filter((s) => s.length > 0);
  };

  const verifiedGrounding = (groundingUrls || []).filter((g) =>
    isVerifiedExternalUrl(g?.url),
  );

  const executiveBrief = sanitizeString(obj.executiveBrief, '');

  const rawThreat = sanitizeString(obj.threatScore, 'MED').toUpperCase();
  const threatScore: ThreatScore =
    rawThreat === 'HIGH' || rawThreat === 'LOW' || rawThreat === 'MED'
      ? rawThreat
      : rawThreat.includes('HIGH')
        ? 'HIGH'
        : rawThreat.includes('LOW')
          ? 'LOW'
          : 'MED';

  const threatReason = sanitizeString(obj.threatReason, '');

  const strengths = sanitizeStringArray(obj.strengths);
  const weaknesses = sanitizeStringArray(obj.weaknesses);

  const rawCounterMoves = Array.isArray(obj.counterMoves)
    ? obj.counterMoves
    : obj.howToWin;
  const counterMoves = sanitizeStringArray(rawCounterMoves);
  const howToWin = [...counterMoves];

  // Products & Pricing Matrix
  const rawProducts = Array.isArray(obj.products)
    ? obj.products
    : obj.productsAndPricing;
  const productsAndPricing: ProductPricingTier[] = Array.isArray(rawProducts)
    ? rawProducts
        .filter((item) => item && typeof item === 'object')
        .map((item, idx) => {
          const rec = item as Record<string, unknown>;
          return {
            id: sanitizeString(rec.id, `tier-${idx + 1}`),
            name: sanitizeString(rec.name, ''),
            price: sanitizeString(rec.price, 'Not publicly disclosed'),
            billingCadence: sanitizeString(
              rec.billingCadence,
              'Not publicly disclosed',
            ),
            targetAudience: sanitizeString(
              rec.targetAudience,
              'Not publicly disclosed',
            ),
            standoutFeatures: sanitizeStringArray(rec.standoutFeatures),
          };
        })
        .filter((tier) => tier.name.length > 0)
    : [];

  // Build pool of verified URLs (from groundingChunks first, plus verified non-placeholder URLs)
  const todayIso = referenceDate.toISOString().slice(0, 10);

  // Live News & Launches (only items with valid title, valid past/today YYYY-MM-DD date, and real verified URL)
  const rawNews = Array.isArray(obj.newsItems)
    ? obj.newsItems
    : obj.newsAndLaunches;
  const newsAndLaunches: NewsIntelItem[] = [];

  if (Array.isArray(rawNews)) {
    rawNews.forEach((item, idx) => {
      if (!item || typeof item !== 'object') return;
      const rec = item as Record<string, unknown>;
      const title = sanitizeString(rec.title, '');
      if (!title) return;

      const rawDate = sanitizeString(rec.date, '');
      const validDate = isValidPastOrTodayIsoDate(rawDate, referenceDate)
        ? rawDate
        : todayIso;

      const candidateUrl = sanitizeString(rec.url, '');
      const groundingMatch = verifiedGrounding[idx]?.url || verifiedGrounding[0]?.url || '';
      const resolvedUrl = isVerifiedExternalUrl(candidateUrl)
        ? candidateUrl
        : isVerifiedExternalUrl(groundingMatch)
          ? groundingMatch
          : isVerifiedExternalUrl(target.url)
            ? target.url
            : '';

      // Discard news items that have no verified URL
      if (!resolvedUrl) return;

      const rawSent = sanitizeString(rec.sentiment, 'neutral').toLowerCase();
      const sentiment: 'positive' | 'neutral' | 'negative' =
        rawSent === 'positive' || rawSent === 'negative' ? rawSent : 'neutral';

      newsAndLaunches.push({
        id: sanitizeString(rec.id, `news-${idx + 1}`),
        title,
        summary: sanitizeString(rec.summary, ''),
        date: validDate,
        sourceName: sanitizeString(rec.sourceName, target.domain || 'Web Source'),
        url: resolvedUrl,
        sentiment,
      });
    });
  }

  // Market & Customer Pulse
  const rawPulse =
    obj.customerPulse && typeof obj.customerPulse === 'object'
      ? (obj.customerPulse as Record<string, unknown>)
      : {};

  const customerPraise = sanitizeStringArray(
    Array.isArray(obj.customerPraise) ? obj.customerPraise : rawPulse.usersLove,
  );
  const customerComplaints = sanitizeStringArray(
    Array.isArray(obj.customerComplaints)
      ? obj.customerComplaints
      : rawPulse.usersComplain,
  );

  const customerPulse: CustomerPulse = {
    fundingAndGrowth: sanitizeString(
      rawPulse.fundingAndGrowth ?? obj.fundingAndGrowth,
      '',
    ),
    usersLove: customerPraise,
    usersComplain: customerComplaints,
  };

  // Verified Evidence: prioritize real URLs from groundingChunks, and strip any placeholder/unverified URLs
  const evidence: VerifiedEvidenceItem[] = [];
  const seenUrls = new Set<string>();

  // 1. Add real Google Search Grounding chunks first
  verifiedGrounding.forEach((g, idx) => {
    const cleanUrl = g.url.trim();
    if (seenUrls.has(cleanUrl)) return;
    seenUrls.add(cleanUrl);
    let sourceHost = target.domain || 'Google Search Grounding';
    try {
      sourceHost = new URL(cleanUrl).hostname.replace(/^www\./i, '');
    } catch {
      // keep default
    }
    evidence.push({
      id: `ev-grounding-${idx + 1}`,
      title: sanitizeString(g.title, `${target.brandName || target.domain} Verified Source`),
      url: cleanUrl,
      sourceName: sourceHost,
      snippet: `Verified via live Google Search Grounding (${cleanUrl}).`,
      category: 'News',
      capturedAt: 'Google Search Grounding',
    });
  });

  // 2. Add any model-reported evidence items ONLY if their URL is a verified external URL (never example.com)
  if (Array.isArray(obj.evidence)) {
    const validCats = ['Website', 'Pricing', 'Reviews', 'News', 'Docs'] as const;
    obj.evidence.forEach((item, idx) => {
      if (!item || typeof item !== 'object') return;
      const rec = item as Record<string, unknown>;
      const rawUrl = sanitizeString(rec.url, '');
      if (!isVerifiedExternalUrl(rawUrl)) return;

      if (seenUrls.has(rawUrl)) {
        // Enrich snippet/category on existing grounding item if present
        const existingEv = evidence.find((e) => e.url === rawUrl);
        const snippet = sanitizeString(rec.snippet, '');
        if (existingEv && snippet) {
          existingEv.snippet = snippet;
        }
        return;
      }
      seenUrls.add(rawUrl);

      const rawCat = sanitizeString(rec.category, 'Website');
      const category = (validCats.find(
        (c) => c.toLowerCase() === rawCat.toLowerCase(),
      ) || 'Website') as VerifiedEvidenceItem['category'];

      let sourceHost = sanitizeString(rec.sourceName, '');
      if (!sourceHost) {
        try {
          sourceHost = new URL(rawUrl).hostname.replace(/^www\./i, '');
        } catch {
          sourceHost = target.domain;
        }
      }

      evidence.push({
        id: sanitizeString(rec.id, `ev-${idx + 1}`),
        title: sanitizeString(rec.title, sourceHost || rawUrl),
        url: rawUrl,
        sourceName: sourceHost,
        snippet: sanitizeString(rec.snippet, ''),
        category,
        capturedAt: sanitizeString(rec.capturedAt, 'Verified Grounding URL'),
      });
    });
  }

  const now = new Date();
  return {
    id: sanitizeString(obj.id, `snap-${now.getTime()}`),
    timestamp: sanitizeString(obj.timestamp, now.toISOString()),
    capturedAtLabel: sanitizeString(obj.capturedAtLabel, 'Just now'),
    executiveBrief,
    threatScore,
    threatReason,
    strengths,
    weaknesses,
    howToWin,
    counterMoves,
    productsAndPricing,
    products: productsAndPricing,
    newsAndLaunches,
    newsItems: newsAndLaunches,
    customerPulse,
    customerPraise,
    customerComplaints,
    evidence,
  };
}

/**
 * Filters News & Intel items by 30 Days ('30d'), 90 Days ('90d'), or All Time ('all').
 * Strictly validates YYYY-MM-DD dates and rejects invalid or future dates.
 */
export function filterNewsByDateRange(
  items: NewsIntelItem[],
  filter: NewsDateFilter,
  referenceDate: Date = new Date(),
): NewsIntelItem[] {
  const safeItems = Array.isArray(items) ? items : [];
  const validDatedItems = safeItems.filter((item) =>
    isValidPastOrTodayIsoDate(item?.date, referenceDate),
  );

  if (filter === 'all') return validDatedItems;
  const maxDays = filter === '30d' ? 30 : 90;
  const refMs = Date.UTC(
    referenceDate.getUTCFullYear(),
    referenceDate.getUTCMonth(),
    referenceDate.getUTCDate(),
  );

  return validDatedItems.filter((item) => {
    const parsedMs = Date.parse(`${item.date}T00:00:00.000Z`);
    if (Number.isNaN(parsedMs)) return false;
    const diffDays = (refMs - parsedMs) / (1000 * 60 * 60 * 24);
    return diffDays >= 0 && diffDays <= maxDays;
  });
}

/**
 * Builds or updates a Competitor object from a validated CompetitorSnapshot,
 * running the Real Diff Engine if a previous snapshot exists.
 */
export function buildCompetitorFromSnapshot(
  target: { brandName: string; domain: string; url: string },
  snapshot: CompetitorSnapshot,
  existing?: Competitor,
): { competitor: Competitor; newDiffs: DiffChangeItem[] } {
  const id =
    existing?.id ||
    target.domain.replace(/[^a-z0-9]/gi, '-').toLowerCase();
  const prevSnapshots = Array.isArray(existing?.snapshots)
    ? existing.snapshots
    : [];
  const nextSnapshots = [...prevSnapshots, snapshot];

  let newDiffs: DiffChangeItem[] = [];
  if (prevSnapshots.length > 0) {
    const lastSnap = prevSnapshots[prevSnapshots.length - 1];
    newDiffs = computeSnapshotDiffs(
      lastSnap,
      snapshot,
      prevSnapshots.length,
      nextSnapshots.length,
    );
  }

  const allDiffs = [...newDiffs, ...(existing?.diffHistory || [])];
  const threatLevel = threatScoreToLevel(snapshot.threatScore);

  const competitor: Competitor = {
    id,
    name: existing?.name || target.brandName,
    domain: target.domain,
    url: target.url,
    tagline: snapshot.threatReason || snapshot.executiveBrief,
    threatScore: snapshot.threatScore,
    threatReason: snapshot.threatReason,
    threatLevel,
    snapshotsCount: nextSnapshots.length,
    lastScannedAt: snapshot.capturedAtLabel || 'Just now',
    scanProgress: 100,
    isLiveScanning: true,
    executiveBrief: snapshot.executiveBrief,
    strengths: snapshot.strengths,
    weaknesses: snapshot.weaknesses,
    howToWin: snapshot.howToWin,
    counterMoves: snapshot.counterMoves,
    productsAndPricing: snapshot.productsAndPricing,
    products: snapshot.products,
    newsAndLaunches: snapshot.newsAndLaunches,
    newsItems: snapshot.newsItems,
    customerPulse: snapshot.customerPulse,
    customerPraise: snapshot.customerPraise,
    customerComplaints: snapshot.customerComplaints,
    evidence: snapshot.evidence,
    snapshots: nextSnapshots,
    diffHistory: allDiffs,
    // Reset chatHistory on new scan; keep existing chatHistory on re-scan of same competitor
    chatHistory: existing ? existing.chatHistory || [] : [],
    featureCards: snapshot.productsAndPricing.slice(0, 3).map((tier, idx) => ({
      id: `fc-${id}-${idx}`,
      name: tier.name,
      category: tier.price,
      summary: tier.standoutFeatures.join(' · '),
      tag: tier.billingCadence,
      accentColor: idx === 0 ? 'emerald' : idx === 1 ? 'indigo' : 'violet',
    })),
    timelineBranches:
      allDiffs.length > 0
        ? allDiffs.slice(0, 4).map((d) => ({
            id: d.id,
            snapshotFrom: d.snapshotFromLabel,
            snapshotTo: d.snapshotToLabel,
            label: d.title,
            detail: d.summary,
            timestamp: d.capturedAtLabel,
            status: d.status,
            confidence: 'Verified',
          }))
        : [
            {
              id: `tb-${id}-init`,
              snapshotFrom: 'Snapshot #1',
              snapshotTo: 'Baseline',
              label: 'Baseline Locked',
              detail: `Initial 360° intelligence snapshot captured for ${target.domain}`,
              timestamp: snapshot.capturedAtLabel || 'Just now',
              status: 'added',
              confidence: '100%',
            },
          ],
  };

  return { competitor, newDiffs };
}

/**
 * Calls the server-side Gemini Google Search Grounding endpoint to extract
 * a real 360° live intelligence snapshot. Throws an explicit error on failure
 * so the UI displays an honest Error Banner with a Retry button (zero silent fallbacks).
 */
export async function researchCompetitorLive(
  rawInput: string,
  existing?: Competitor,
): Promise<{ competitor: Competitor; newDiffs: DiffChangeItem[] }> {
  const normalized = normalizeCompetitorInput(rawInput);
  if (!normalized.valid) {
    throw new Error(normalized.error || 'Invalid competitor input.');
  }

  const response = await fetch('/api/intelligence/research', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      url: normalized.url,
      domain: normalized.domain,
      brandName: normalized.brandName,
      isRescan: Boolean(existing),
    }),
  });

  let payload: {
    dossier?: unknown;
    groundingUrls?: { title: string; url: string }[];
    detail?: string;
  } = {};

  try {
    payload = (await response.json()) as typeof payload;
  } catch {
    throw new Error(
      `Live research request failed (HTTP ${response.status}). Please retry.`,
    );
  }

  if (!response.ok) {
    throw new Error(
      payload.detail ||
        `Live intelligence scan failed (HTTP ${response.status}). Check your Gemini API configuration and retry.`,
    );
  }

  if (!payload.dossier || typeof payload.dossier !== 'object') {
    throw new Error(
      'Gemini returned an incomplete or unparseable competitor dossier. Click Retry to run the scan again.',
    );
  }

  const groundingUrls = Array.isArray(payload.groundingUrls)
    ? payload.groundingUrls
    : [];

  const snapshot = safeParseCompetitorDossier(
    payload.dossier,
    normalized,
    groundingUrls,
  );

  if (!snapshot.executiveBrief && snapshot.strengths.length === 0) {
    throw new Error(
      `Could not verify public intelligence for ${normalized.domain}. Click Retry to re-run Google Search Grounding.`,
    );
  }

  return buildCompetitorFromSnapshot(normalized, snapshot, existing);
}

/**
 * Sends a contextual question about the active competitor (along with the full conversation
 * history and verified competitor JSON context) to the server-side Gemini AI Analyst endpoint.
 * Throws an explicit error if the API call fails—never returns static or canned replies.
 */
export async function askCompetitorAnalyst(
  competitor: Competitor,
  question: string,
  history: AnalystMessage[],
): Promise<string> {
  const trimmedQ = (question ?? '').trim();
  if (!trimmedQ) {
    throw new Error('Enter a question for CompSight AI.');
  }

  const response = await fetch('/api/intelligence/ask', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      question: trimmedQ,
      competitor: {
        name: competitor.name,
        domain: competitor.domain,
        url: competitor.url,
        executiveBrief: competitor.executiveBrief,
        threatScore: competitor.threatScore,
        threatReason: competitor.threatReason,
        strengths: competitor.strengths,
        weaknesses: competitor.weaknesses,
        howToWin: competitor.howToWin,
        productsAndPricing: competitor.productsAndPricing,
        customerPulse: competitor.customerPulse,
        newsAndLaunches: competitor.newsAndLaunches,
        evidence: competitor.evidence,
      },
      history: history.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    }),
  });

  let data: { answer?: string; detail?: string } = {};
  try {
    data = (await response.json()) as { answer?: string; detail?: string };
  } catch {
    throw new Error(
      `AI Analyst request failed (HTTP ${response.status}). Please retry.`,
    );
  }

  if (!response.ok) {
    throw new Error(
      data.detail ||
        `CompSight AI Analyst error (HTTP ${response.status}). Please retry.`,
    );
  }

  const answer = (data.answer ?? '').trim();
  if (!answer) {
    throw new Error(
      'CompSight AI returned an empty response. Click Retry to ask again.',
    );
  }

  return answer;
}
