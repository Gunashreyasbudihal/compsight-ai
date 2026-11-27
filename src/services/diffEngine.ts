import { CompetitorSnapshot, DiffChangeItem } from '../types';

/**
 * Compares a previous CompetitorSnapshot against a newly scanned snapshot
 * and produces a chronological list of Added (emerald), Modified (amber),
 * and Removed (crimson) diff items. Never injects fabricated diffs.
 */
export function computeSnapshotDiffs(
  previous: CompetitorSnapshot,
  current: CompetitorSnapshot,
  snapshotIndexFrom: number,
  snapshotIndexTo: number,
): DiffChangeItem[] {
  const diffs: DiffChangeItem[] = [];
  const fromLabel = `Snapshot #${snapshotIndexFrom}`;
  const toLabel = `Snapshot #${snapshotIndexTo}`;
  const nowIso = current.timestamp || new Date().toISOString();
  const capturedAtLabel = current.capturedAtLabel || 'Just now';

  // 1. Compare Threat Score & Reason
  if (previous.threatScore !== current.threatScore) {
    diffs.push({
      id: `diff-threat-${Date.now()}-${diffs.length}`,
      timestamp: nowIso,
      capturedAtLabel,
      snapshotFromLabel: fromLabel,
      snapshotToLabel: toLabel,
      status: 'modified',
      category: 'Threat',
      title: `Threat Score shifted from ${previous.threatScore} to ${current.threatScore}`,
      summary: current.threatReason || 'Updated threat assessment.',
      previousValue: `${previous.threatScore} — ${previous.threatReason}`,
      currentValue: `${current.threatScore} — ${current.threatReason}`,
    });
  } else if (
    previous.threatReason &&
    current.threatReason &&
    previous.threatReason.trim() !== current.threatReason.trim()
  ) {
    diffs.push({
      id: `diff-threat-reason-${Date.now()}-${diffs.length}`,
      timestamp: nowIso,
      capturedAtLabel,
      snapshotFromLabel: fromLabel,
      snapshotToLabel: toLabel,
      status: 'modified',
      category: 'Threat',
      title: 'Threat assessment rationale updated',
      summary: current.threatReason,
      previousValue: previous.threatReason,
      currentValue: current.threatReason,
    });
  }

  // 2. Compare Executive Brief
  if (
    previous.executiveBrief &&
    current.executiveBrief &&
    previous.executiveBrief.trim() !== current.executiveBrief.trim()
  ) {
    diffs.push({
      id: `diff-brief-${Date.now()}-${diffs.length}`,
      timestamp: nowIso,
      capturedAtLabel,
      snapshotFromLabel: fromLabel,
      snapshotToLabel: toLabel,
      status: 'modified',
      category: 'Product',
      title: 'Executive positioning brief updated',
      summary: current.executiveBrief,
      previousValue: previous.executiveBrief,
      currentValue: current.executiveBrief,
    });
  }

  // 3. Compare Pricing & Products
  const prevTiers = Array.isArray(previous.productsAndPricing)
    ? previous.productsAndPricing
    : [];
  const currTiers = Array.isArray(current.productsAndPricing)
    ? current.productsAndPricing
    : [];

  const prevTiersByName = new Map(
    prevTiers.map((t) => [t.name.toLowerCase().trim(), t]),
  );
  const currTiersByName = new Map(
    currTiers.map((t) => [t.name.toLowerCase().trim(), t]),
  );

  for (const [key, currTier] of currTiersByName.entries()) {
    const prevTier = prevTiersByName.get(key);
    if (!prevTier) {
      diffs.push({
        id: `diff-tier-add-${Date.now()}-${diffs.length}`,
        timestamp: nowIso,
        capturedAtLabel,
        snapshotFromLabel: fromLabel,
        snapshotToLabel: toLabel,
        status: 'added',
        category: 'Pricing',
        title: `New product/pricing tier detected: ${currTier.name} (${currTier.price})`,
        summary: `Added ${currTier.name} targeting ${currTier.targetAudience || 'customers'}${currTier.standoutFeatures.length > 0 ? ` with ${currTier.standoutFeatures.slice(0, 2).join(', ')}` : ''}.`,
        currentValue: `${currTier.name}: ${currTier.price} (${currTier.billingCadence})`,
      });
    } else if (
      prevTier.price !== currTier.price ||
      prevTier.billingCadence !== currTier.billingCadence
    ) {
      diffs.push({
        id: `diff-tier-mod-${Date.now()}-${diffs.length}`,
        timestamp: nowIso,
        capturedAtLabel,
        snapshotFromLabel: fromLabel,
        snapshotToLabel: toLabel,
        status: 'modified',
        category: 'Pricing',
        title: `${currTier.name} tier pricing updated`,
        summary: `Price changed from ${prevTier.price} (${prevTier.billingCadence}) to ${currTier.price} (${currTier.billingCadence}).`,
        previousValue: `${prevTier.name}: ${prevTier.price} (${prevTier.billingCadence})`,
        currentValue: `${currTier.name}: ${currTier.price} (${currTier.billingCadence})`,
      });
    }
  }

  for (const [key, prevTier] of prevTiersByName.entries()) {
    if (!currTiersByName.has(key)) {
      diffs.push({
        id: `diff-tier-rem-${Date.now()}-${diffs.length}`,
        timestamp: nowIso,
        capturedAtLabel,
        snapshotFromLabel: fromLabel,
        snapshotToLabel: toLabel,
        status: 'removed',
        category: 'Pricing',
        title: `Removed product/pricing tier: ${prevTier.name}`,
        summary: `${prevTier.name} (${prevTier.price}) is no longer present in the latest snapshot.`,
        previousValue: `${prevTier.name}: ${prevTier.price}`,
      });
    }
  }

  // 4. Compare Battlecard Strengths
  const prevStrengths = new Set(
    (previous.strengths || []).map((s) => s.trim()).filter(Boolean),
  );
  const currStrengths = new Set(
    (current.strengths || []).map((s) => s.trim()).filter(Boolean),
  );

  for (const s of currStrengths) {
    if (!prevStrengths.has(s)) {
      diffs.push({
        id: `diff-str-add-${Date.now()}-${diffs.length}`,
        timestamp: nowIso,
        capturedAtLabel,
        snapshotFromLabel: fromLabel,
        snapshotToLabel: toLabel,
        status: 'added',
        category: 'Battlecard',
        title: 'New competitive strength identified',
        summary: s,
        currentValue: s,
      });
    }
  }

  for (const s of prevStrengths) {
    if (!currStrengths.has(s)) {
      diffs.push({
        id: `diff-str-rem-${Date.now()}-${diffs.length}`,
        timestamp: nowIso,
        capturedAtLabel,
        snapshotFromLabel: fromLabel,
        snapshotToLabel: toLabel,
        status: 'removed',
        category: 'Battlecard',
        title: 'Previous strength removed from battlecard',
        summary: s,
        previousValue: s,
      });
    }
  }

  // 5. Compare Battlecard Weaknesses
  const prevWeaknesses = new Set(
    (previous.weaknesses || []).map((w) => w.trim()).filter(Boolean),
  );
  const currWeaknesses = new Set(
    (current.weaknesses || []).map((w) => w.trim()).filter(Boolean),
  );

  for (const w of currWeaknesses) {
    if (!prevWeaknesses.has(w)) {
      diffs.push({
        id: `diff-weak-add-${Date.now()}-${diffs.length}`,
        timestamp: nowIso,
        capturedAtLabel,
        snapshotFromLabel: fromLabel,
        snapshotToLabel: toLabel,
        status: 'added',
        category: 'Battlecard',
        title: 'New competitive weakness / complaint identified',
        summary: w,
        currentValue: w,
      });
    }
  }

  for (const w of prevWeaknesses) {
    if (!currWeaknesses.has(w)) {
      diffs.push({
        id: `diff-weak-rem-${Date.now()}-${diffs.length}`,
        timestamp: nowIso,
        capturedAtLabel,
        snapshotFromLabel: fromLabel,
        snapshotToLabel: toLabel,
        status: 'removed',
        category: 'Battlecard',
        title: 'Previous weakness removed from battlecard',
        summary: w,
        previousValue: w,
      });
    }
  }

  // 6. Compare News & Launches
  const prevNewsTitles = new Set(
    (previous.newsAndLaunches || []).map((n) => n.title.toLowerCase().trim()),
  );
  for (const news of current.newsAndLaunches || []) {
    if (news.title && !prevNewsTitles.has(news.title.toLowerCase().trim())) {
      diffs.push({
        id: `diff-news-add-${Date.now()}-${diffs.length}`,
        timestamp: nowIso,
        capturedAtLabel,
        snapshotFromLabel: fromLabel,
        snapshotToLabel: toLabel,
        status: 'added',
        category: 'News',
        title: `New launch/signal: ${news.title}`,
        summary: `${news.summary} (${news.sourceName} · ${news.date})`,
        currentValue: news.title,
      });
    }
  }

  return diffs;
}
