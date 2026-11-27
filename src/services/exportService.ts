import { Competitor } from '../types';

function safeText(val: unknown, fallback = 'Not publicly disclosed'): string {
  if (typeof val === 'string' && val.trim().length > 0) {
    return val.trim();
  }
  if (typeof val === 'number' || typeof val === 'boolean') {
    return String(val);
  }
  return fallback;
}

/**
 * Generates a clean, formatted Markdown Battlecard from a Competitor's 360° intelligence data.
 * Guarantees zero `undefined` or `[object Object]` output.
 */
export function generateBattlecardMarkdown(competitor: Competitor): string {
  const name = safeText(competitor.name, 'Competitor');
  const domain = safeText(competitor.domain, 'Not publicly disclosed');
  const url = safeText(competitor.url, 'Not publicly disclosed');
  const threatScore = safeText(competitor.threatScore, 'MED');
  const threatReason = safeText(competitor.threatReason);
  const executiveBrief = safeText(competitor.executiveBrief);
  const snapshotsCount =
    typeof competitor.snapshotsCount === 'number'
      ? competitor.snapshotsCount
      : (competitor.snapshots || []).length;
  const lastScannedAt = safeText(competitor.lastScannedAt, 'Just now');

  const strengths = Array.isArray(competitor.strengths)
    ? competitor.strengths.filter((s) => typeof s === 'string' && s.trim())
    : [];
  const weaknesses = Array.isArray(competitor.weaknesses)
    ? competitor.weaknesses.filter((w) => typeof w === 'string' && w.trim())
    : [];
  const counterMoves = Array.isArray(competitor.howToWin)
    ? competitor.howToWin.filter((h) => typeof h === 'string' && h.trim())
    : [];
  const products = Array.isArray(competitor.productsAndPricing)
    ? competitor.productsAndPricing
    : [];
  const newsItems = Array.isArray(competitor.newsAndLaunches)
    ? competitor.newsAndLaunches
    : [];
  const evidence = Array.isArray(competitor.evidence)
    ? competitor.evidence
    : [];
  const fundingAndGrowth = safeText(
    competitor.customerPulse?.fundingAndGrowth,
  );
  const usersLove = Array.isArray(competitor.customerPulse?.usersLove)
    ? competitor.customerPulse.usersLove.filter(
        (u) => typeof u === 'string' && u.trim(),
      )
    : [];
  const usersComplain = Array.isArray(competitor.customerPulse?.usersComplain)
    ? competitor.customerPulse.usersComplain.filter(
        (u) => typeof u === 'string' && u.trim(),
      )
    : [];

  const lines: string[] = [
    `# ${name} — Competitive Intelligence Battlecard`,
    ``,
    `- **Domain:** ${domain} (${url})`,
    `- **Threat Score:** ${threatScore} — ${threatReason}`,
    `- **Snapshots Captured:** ${snapshotsCount} (Last scanned: ${lastScannedAt})`,
    ``,
    `## 1. Executive Brief`,
    `${executiveBrief}`,
    ``,
    `## 2. AI Battlecard`,
    `### Strengths`,
    ...(strengths.length > 0
      ? strengths.map((s) => `- [+] ${safeText(s)}`)
      : [`- Not publicly disclosed`]),
    ``,
    `### Weaknesses (Backed by User Feedback)`,
    ...(weaknesses.length > 0
      ? weaknesses.map((w) => `- [-] ${safeText(w)}`)
      : [`- Not publicly disclosed`]),
    ``,
    `### How to Win (Counter-Moves)`,
    ...(counterMoves.length > 0
      ? counterMoves.map(
          (h, i) => `${i + 1}. **Counter-Move #${i + 1}:** ${safeText(h)}`,
        )
      : [`1. Not publicly disclosed`]),
    ``,
    `## 3. Products & Pricing Matrix`,
    ...(products.length > 0
      ? products.map((tier) => {
          const tName = safeText(tier.name, 'Tier');
          const tPrice = safeText(tier.price);
          const tCadence = safeText(tier.billingCadence);
          const tAudience = safeText(tier.targetAudience);
          const feats = Array.isArray(tier.standoutFeatures)
            ? tier.standoutFeatures
                .filter((f) => typeof f === 'string' && f.trim())
                .join(', ')
            : '';
          return `- **${tName}** (${tPrice} · ${tCadence}) — *${tAudience}*\n  - Features: ${feats || 'Not publicly disclosed'}`;
        })
      : [`- Not publicly disclosed`]),
    ``,
    `## 4. Market & Customer Pulse`,
    `- **Funding & Growth:** ${fundingAndGrowth}`,
    `### What Users Love`,
    ...(usersLove.length > 0
      ? usersLove.map((item) => `- ${safeText(item)}`)
      : [`- Not publicly disclosed`]),
    `### What Users Complain About`,
    ...(usersComplain.length > 0
      ? usersComplain.map((item) => `- ${safeText(item)}`)
      : [`- Not publicly disclosed`]),
    ``,
    `## 5. Recent News & Launches`,
    ...(newsItems.length > 0
      ? newsItems.map(
          (n) =>
            `- **${safeText(n.date)} | ${safeText(n.title)}** (${safeText(n.sourceName)}, Sentiment: ${safeText(n.sentiment, 'neutral')})\n  - ${safeText(n.summary)}\n  - Source: ${safeText(n.url)}`,
        )
      : [`- No verified news items recorded`]),
    ``,
    `## 6. Verified Evidence & Sources`,
    ...(evidence.length > 0
      ? evidence.map(
          (e) =>
            `- [${safeText(e.title)}](${safeText(e.url)}) (${safeText(e.sourceName)} · ${safeText(e.category, 'Website')}) — "${safeText(e.snippet)}"`,
        )
      : [`- No verified grounding citations recorded`]),
    ``,
  ];

  return lines.join('\n');
}

/**
 * Triggers a browser download of the competitor's Markdown Battlecard (.md).
 */
export function downloadBattlecardMarkdown(competitor: Competitor): string {
  const markdown = generateBattlecardMarkdown(competitor);
  const slug =
    (competitor.id || competitor.name || 'competitor')
      .toLowerCase()
      .replace(/[^a-z0-9-_]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'competitor';

  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${slug}-battlecard.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
  return markdown;
}
