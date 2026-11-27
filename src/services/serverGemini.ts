import { GoogleGenAI } from '@google/genai';
import {
  isVerifiedExternalUrl,
  parseStrictJsonObject,
  safeParseCompetitorDossier,
} from './intelligenceService';
import { Competitor, CompetitorSnapshot } from '../types';

const CANDIDATE_MODELS = [
  'gemini-3.1-flash-lite',
  'gemini-4-hydrogen',
  'gemini-3.8-flash',
] as const;

function formatGeminiError(err: unknown, fallbackMessage: string): Error {
  const raw = err instanceof Error ? err.message : String(err ?? '');
  if (!raw) return new Error(fallbackMessage);
  try {
    const parsed = JSON.parse(raw) as {
      error?: { code?: number; message?: string; status?: string };
    };
    if (parsed?.error?.message) {
      return new Error(parsed.error.message);
    }
  } catch {
    // Not raw JSON error string
  }
  return new Error(raw);
}

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY' || apiKey.trim() === '') {
    throw new Error(
      'GEMINI_API_KEY is not configured. Please check your API key in the Settings > Secrets panel and click Retry.',
    );
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

async function generateWithActiveModel(
  ai: GoogleGenAI,
  params: {
    contents: unknown;
    systemInstruction: string;
    useSearchGrounding: boolean;
  },
  fallbackMessage: string,
) {
  let lastError: unknown = null;

  // Try each candidate model with the requested grounding configuration first
  const groundingModes = params.useSearchGrounding ? [true, false] : [false];

  for (const useSearch of groundingModes) {
    for (const model of CANDIDATE_MODELS) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: params.contents as Parameters<
            typeof ai.models.generateContent
          >[0]['contents'],
          config: {
            systemInstruction: params.systemInstruction,
            ...(useSearch ? { tools: [{ googleSearch: {} }] } : {}),
          },
        });
        if (response && (response.text ?? '').trim().length > 0) {
          return response;
        }
      } catch (err) {
        lastError = err;
      }
    }
  }

  throw formatGeminiError(lastError, fallbackMessage);
}

/**
 * Performs live 360° competitor research using @google/genai (gemini-2.5-flash)
 * with Google Search Grounding (tools: [{ googleSearch: {} }]).
 * Never falls back to fake or fabricated competitor data.
 */
export async function runServerCompetitorResearch(params: {
  brandName: string;
  domain: string;
  url: string;
  isRescan?: boolean;
}): Promise<{
  dossier: CompetitorSnapshot;
  groundingUrls: { title: string; url: string }[];
}> {
  const ai = getGeminiClient();
  const target = {
    brandName: params.brandName,
    domain: params.domain,
    url: params.url,
  };
  const todayIso = new Date().toISOString().slice(0, 10);

  const systemInstruction = [
    `You are CompSight, a strict, zero-hallucination competitive intelligence research engine.`,
    `Today's date is ${todayIso}.`,
    `Only report facts, pricing tiers, funding figures, dates, and news items verified via Google Search Grounding. If any detail (pricing, funding, date, etc.) is not publicly verified, output 'Not publicly disclosed'—NEVER guess, estimate, or invent numbers.`,
    `Never invent URLs or use placeholder domains like example.com. All news item dates must be valid past or present YYYY-MM-DD dates (never after ${todayIso}).`,
  ].join('\n');

  const prompt = `Research the company/product "${params.brandName}" (${params.url}, domain: ${params.domain}) using live Google Search Grounding.
Only report facts, pricing tiers, funding figures, dates, and news items verified via Google Search Grounding. If any detail (pricing, funding, date, etc.) is not publicly verified, output 'Not publicly disclosed'—NEVER guess, estimate, or invent numbers.

Return ONLY a valid JSON object (no markdown fences, no commentary) matching this exact schema:
{
  "executiveBrief": "2-3 short, crystal-clear sentences explaining what they do, who they target, and their main advantage.",
  "threatScore": "LOW" | "MED" | "HIGH",
  "threatReason": "1 concise sentence explaining the threat score based on verified market presence.",
  "strengths": ["3-4 short verified bullets, max 12 words each"],
  "weaknesses": ["3-4 short bullets backed by real user complaints or documented limitations, max 12 words each"],
  "howToWin": ["3 clear, actionable counter-moves to beat them in deals"],
  "productsAndPricing": [
    {
      "name": "Verified Tier or Product Name",
      "price": "Verified price (e.g. $0, $16/mo) or 'Not publicly disclosed'",
      "billingCadence": "Verified billing cadence or 'Not publicly disclosed'",
      "targetAudience": "Who this tier targets",
      "standoutFeatures": ["Verified feature 1", "Verified feature 2"]
    }
  ],
  "newsAndLaunches": [
    {
      "title": "Verified launch, funding, or product update headline",
      "summary": "1-line factual summary",
      "date": "YYYY-MM-DD (must be <= ${todayIso})",
      "sourceName": "Publication or official source name",
      "url": "https://... (real verified URL only)",
      "sentiment": "positive" | "neutral" | "negative"
    }
  ],
  "customerPulse": {
    "fundingAndGrowth": "Verified funding/growth snapshot or 'Not publicly disclosed'",
    "usersLove": ["Verified customer praise 1", "Verified customer praise 2", "Verified customer praise 3"],
    "usersComplain": ["Verified customer complaint 1", "Verified customer complaint 2", "Verified customer complaint 3"]
  },
  "evidence": [
    {
      "title": "Verified source page title",
      "url": "https://... (real verified URL only)",
      "sourceName": "Domain or publication",
      "snippet": "1-line factual verification quote or summary",
      "category": "Website" | "Pricing" | "Reviews" | "News" | "Docs"
    }
  ]
}`;

  const response = await generateWithActiveModel(
    ai,
    {
      contents: prompt,
      systemInstruction,
      useSearchGrounding: true,
    },
    `Live Google Search Grounding failed for ${params.domain}. Please click Retry.`,
  );

  const rawText = (response.text ?? '').trim();
  if (!rawText) {
    throw new Error(
      `Gemini returned an empty response while researching ${params.domain}. Please click Retry.`,
    );
  }

  // Parse JSON strictly (strips markdown fences and throws if unparseable)
  const parsedObject = parseStrictJsonObject(rawText);

  // Extract real clickable URLs directly from groundingMetadata.groundingChunks
  const chunks =
    response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
  const groundingUrls: { title: string; url: string }[] = [];
  const seenUris = new Set<string>();

  for (const chunk of chunks) {
    const web = (chunk as { web?: { uri?: string; title?: string } }).web;
    if (web?.uri && isVerifiedExternalUrl(web.uri)) {
      const cleanUri = web.uri.trim();
      if (!seenUris.has(cleanUri)) {
        seenUris.add(cleanUri);
        groundingUrls.push({
          title: (web.title || `${params.brandName} Verified Web Source`).trim(),
          url: cleanUri,
        });
      }
    }
  }

  const dossier = safeParseCompetitorDossier(
    parsedObject,
    target,
    groundingUrls,
  );

  if (!dossier.executiveBrief) {
    throw new Error(
      `Incomplete intelligence dossier returned for ${params.domain}. Click Retry to re-run Google Search Grounding.`,
    );
  }

  return { dossier, groundingUrls };
}

/**
 * Runs the conversational "Ask CompSight AI" Analyst query using @google/genai
 * with the currently selected competitor's verified JSON dossier, full conversation history,
 * and the exact new user message. Zero static or hardcoded replies.
 */
export async function runServerAnalystQuery(params: {
  question: string;
  competitor: Partial<Competitor>;
  history?: { role: string; content: string }[];
}): Promise<string> {
  const trimmedQuestion = (params.question ?? '').trim();
  if (!trimmedQuestion) {
    throw new Error('Question cannot be empty.');
  }

  const ai = getGeminiClient();
  const comp = params.competitor || {};

  const verifiedDossierContext = JSON.stringify(
    {
      name: comp.name || 'Not publicly disclosed',
      domain: comp.domain || 'Not publicly disclosed',
      url: comp.url || 'Not publicly disclosed',
      executiveBrief: comp.executiveBrief || 'Not publicly disclosed',
      threatScore: comp.threatScore || 'MED',
      threatReason: comp.threatReason || 'Not publicly disclosed',
      strengths: Array.isArray(comp.strengths) ? comp.strengths : [],
      weaknesses: Array.isArray(comp.weaknesses) ? comp.weaknesses : [],
      howToWin: Array.isArray(comp.howToWin) ? comp.howToWin : [],
      productsAndPricing: Array.isArray(comp.productsAndPricing)
        ? comp.productsAndPricing
        : [],
      customerPulse: comp.customerPulse || {
        fundingAndGrowth: 'Not publicly disclosed',
        usersLove: [],
        usersComplain: [],
      },
      newsAndLaunches: Array.isArray(comp.newsAndLaunches)
        ? comp.newsAndLaunches
        : [],
      evidence: Array.isArray(comp.evidence) ? comp.evidence : [],
    },
    null,
    2,
  );

  const systemInstruction = [
    `You are CompSight AI, an executive competitive intelligence & deal-desk analyst.`,
    `You are analyzing the following currently selected competitor based on its verified JSON dossier:`,
    verifiedDossierContext,
    ``,
    `STRICT RULES:`,
    `1. Answer the user's specific question directly and concisely in 3 to 5 structured bullet points starting with "• **Heading:** ...".`,
    `2. Ground every claim in the verified competitor dossier above or live Google Search Grounding. NEVER fabricate facts, pricing, or numbers. If a requested detail is not publicly verified, explicitly state "Not publicly disclosed".`,
    `3. Tailor your answer directly to the user's exact question and the prior conversation history—never repeat a generic summary.`,
  ].join('\n');

  const priorTurns = Array.isArray(params.history)
    ? params.history
        .filter(
          (m) =>
            m &&
            typeof m.content === 'string' &&
            m.content.trim().length > 0,
        )
        .map((m) => ({
          role: m.role === 'assistant' || m.role === 'model' ? 'model' : 'user',
          parts: [{ text: m.content.trim() }],
        }))
    : [];

  // Avoid duplicating the final user turn if the client already appended it to history
  const lastTurn = priorTurns[priorTurns.length - 1];
  const historyWithoutDuplicateLast =
    lastTurn &&
    lastTurn.role === 'user' &&
    lastTurn.parts[0]?.text === trimmedQuestion
      ? priorTurns.slice(0, -1)
      : priorTurns;

  const contents = [
    ...historyWithoutDuplicateLast,
    {
      role: 'user',
      parts: [{ text: trimmedQuestion }],
    },
  ];

  const response = await generateWithActiveModel(
    ai,
    {
      contents,
      systemInstruction,
      useSearchGrounding: false,
    },
    'CompSight AI Analyst query failed. Please click Retry.',
  );

  const text = (response.text ?? '').trim();
  if (!text) {
    throw new Error(
      'CompSight AI returned an empty response. Please click Retry.',
    );
  }

  return text;
}
