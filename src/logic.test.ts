import test from 'node:test';
import assert from 'node:assert/strict';
import {
  INITIAL_COMPETITORS,
  calculateKpiMetrics,
  calculatePrice,
  filterEvidence,
  normalizeCompetitorUrl,
} from './logic';
import {
  buildCompetitorFromSnapshot,
  filterNewsByDateRange,
  isValidPastOrTodayIsoDate,
  isVerifiedExternalUrl,
  normalizeCompetitorInput,
  parseStrictJsonObject,
  safeParseCompetitorDossier,
} from './services/intelligenceService';
import { computeSnapshotDiffs } from './services/diffEngine';
import { generateBattlecardMarkdown } from './services/exportService';
import { sanitizeStoredCompetitor } from './services/storageService';

test('normalizeCompetitorInput validates domains/brands and rejects malformed or placeholder URLs', () => {
  assert.equal(normalizeCompetitorInput('   ').valid, false);
  assert.equal(normalizeCompetitorInput('http://').valid, false);
  assert.equal(normalizeCompetitorInput('https://example.com').valid, false);
  assert.equal(normalizeCompetitorInput('localhost').valid, false);

  const bareDomain = normalizeCompetitorUrl('linear.app');
  assert.equal(bareDomain.valid, true);
  assert.equal(bareDomain.url, 'https://linear.app');
  assert.equal(bareDomain.domain, 'linear.app');
  assert.equal(bareDomain.brandName, 'Linear');

  const brandNameOnly = normalizeCompetitorInput('Notion');
  assert.equal(brandNameOnly.valid, true);
  assert.equal(brandNameOnly.url, 'https://notion.so');
  assert.equal(brandNameOnly.domain, 'notion.so');
  assert.equal(brandNameOnly.brandName, 'Notion');

  const fullUrl = normalizeCompetitorUrl('https://www.vercel.com/pricing');
  assert.equal(fullUrl.valid, true);
  assert.equal(fullUrl.url, 'https://vercel.com');
  assert.equal(fullUrl.brandName, 'Vercel');
});

test('isVerifiedExternalUrl and isValidPastOrTodayIsoDate enforce real URLs and non-future dates', () => {
  assert.equal(isVerifiedExternalUrl('https://linear.app/pricing'), true);
  assert.equal(isVerifiedExternalUrl('https://example.com/pricing'), false);
  assert.equal(isVerifiedExternalUrl('http://localhost:3000'), false);
  assert.equal(isVerifiedExternalUrl('not-a-url'), false);

  const refDate = new Date('2026-11-23T12:00:00Z');
  assert.equal(isValidPastOrTodayIsoDate('2026-11-23', refDate), true);
  assert.equal(isValidPastOrTodayIsoDate('2026-10-15', refDate), true);
  assert.equal(isValidPastOrTodayIsoDate('2027-01-01', refDate), false);
  assert.equal(isValidPastOrTodayIsoDate('2026-02-30', refDate), false);
  assert.equal(isValidPastOrTodayIsoDate('invalid-date', refDate), false);
});

test('safeParseCompetitorDossier strips code fences, defaults missing arrays to [] and strings to "", and strips example.com', () => {
  const fencedJson = '```json\n{"threatScore": "HIGH", "executiveBrief": "Vercel is a frontend cloud platform.", "evidence": [{"title": "Fake", "url": "https://example.com/fake"}]}\n```';
  const parsedObj = parseStrictJsonObject(fencedJson);
  assert.equal(parsedObj.threatScore, 'HIGH');

  const parsed = safeParseCompetitorDossier(
    fencedJson,
    {
      brandName: 'Vercel',
      domain: 'vercel.com',
      url: 'https://vercel.com',
    },
    [{ title: 'Vercel Pricing', url: 'https://vercel.com/pricing' }],
  );

  assert.equal(parsed.threatScore, 'HIGH');
  assert.equal(parsed.executiveBrief, 'Vercel is a frontend cloud platform.');
  // Zero fabricated fallback items when arrays are omitted
  assert.deepEqual(parsed.strengths, []);
  assert.deepEqual(parsed.weaknesses, []);
  assert.deepEqual(parsed.howToWin, []);
  assert.deepEqual(parsed.counterMoves, []);
  assert.deepEqual(parsed.productsAndPricing, []);
  assert.deepEqual(parsed.products, []);
  assert.deepEqual(parsed.newsAndLaunches, []);
  assert.deepEqual(parsed.newsItems, []);
  assert.deepEqual(parsed.customerPraise, []);
  assert.deepEqual(parsed.customerComplaints, []);
  assert.equal(parsed.customerPulse.fundingAndGrowth, '');
  // Grounding URL is included while example.com is stripped
  assert.equal(parsed.evidence.length, 1);
  assert.equal(parsed.evidence[0].url, 'https://vercel.com/pricing');
});

test('computeSnapshotDiffs detects Added, Modified, and Removed changes and never fabricates diffs when identical', () => {
  const target = {
    brandName: 'Cursor',
    domain: 'cursor.com',
    url: 'https://cursor.com',
  };
  const snap1 = safeParseCompetitorDossier(
    {
      threatScore: 'MED',
      executiveBrief: 'AI code editor.',
      strengths: ['Fast AI tab autocomplete', 'Native VS Code fork'],
      productsAndPricing: [
        { name: 'Hobby', price: '$0', billingCadence: 'forever' },
        { name: 'Pro', price: '$20', billingCadence: 'per month' },
      ],
    },
    target,
  );
  const snap2 = safeParseCompetitorDossier(
    {
      threatScore: 'HIGH',
      executiveBrief: 'AI code editor.',
      strengths: ['Fast AI tab autocomplete', 'Background cloud coding agents'],
      productsAndPricing: [
        { name: 'Pro', price: '$24', billingCadence: 'per month' },
        { name: 'Ultra', price: '$200', billingCadence: 'per month' },
      ],
    },
    target,
  );

  const diffs = computeSnapshotDiffs(snap1, snap2, 1, 2);
  assert.ok(diffs.some((d) => d.status === 'added'));
  assert.ok(diffs.some((d) => d.status === 'modified'));
  assert.ok(diffs.some((d) => d.status === 'removed'));

  // Identical snapshots produce 0 diffs (zero fabricated diffs)
  const identicalDiffs = computeSnapshotDiffs(snap1, snap1, 1, 2);
  assert.equal(identicalDiffs.length, 0);

  const firstBuild = buildCompetitorFromSnapshot(target, snap1);
  assert.equal(firstBuild.competitor.snapshots.length, 1);
  assert.equal(firstBuild.competitor.diffHistory.length, 0);

  const secondBuild = buildCompetitorFromSnapshot(
    target,
    snap2,
    firstBuild.competitor,
  );
  assert.equal(secondBuild.competitor.snapshots.length, 2);
  assert.ok(secondBuild.competitor.diffHistory.length >= 3);
});

test('filterNewsByDateRange filters 30d, 90d, and all time accurately and rejects future dates', () => {
  const refDate = new Date('2026-11-23T12:00:00Z');
  const items = [
    {
      id: 'n1',
      title: 'Recent launch',
      summary: 'Summary 1',
      date: '2026-11-15',
      sourceName: 'Blog',
      url: 'https://linear.app/changelog',
      sentiment: 'positive' as const,
    },
    {
      id: 'n2',
      title: '60 days ago',
      summary: 'Summary 2',
      date: '2026-09-20',
      sourceName: 'Blog',
      url: 'https://linear.app/changelog',
      sentiment: 'neutral' as const,
    },
    {
      id: 'n3',
      title: 'Future date',
      summary: 'Invalid future',
      date: '2027-05-01',
      sourceName: 'Blog',
      url: 'https://linear.app/changelog',
      sentiment: 'neutral' as const,
    },
  ];

  const within30 = filterNewsByDateRange(items, '30d', refDate);
  const within90 = filterNewsByDateRange(items, '90d', refDate);
  const allTime = filterNewsByDateRange(items, 'all', refDate);

  assert.equal(within30.length, 1);
  assert.equal(within90.length, 2);
  assert.equal(allTime.length, 2); // Future date rejected
});

test('generateBattlecardMarkdown formats clean Markdown with zero undefined or [object Object] and sanitizeStoredCompetitor recovers partial schemas', () => {
  const md = generateBattlecardMarkdown(INITIAL_COMPETITORS[0]);
  assert.ok(md.includes('# Linear — Competitive Intelligence Battlecard'));
  assert.ok(!md.includes('undefined'));
  assert.ok(!md.includes('[object Object]'));

  const corrupted = sanitizeStoredCompetitor({
    name: 'Raycast',
    domain: 'raycast.com',
  });
  assert.ok(corrupted);
  assert.equal(corrupted.domain, 'raycast.com');
  assert.deepEqual(corrupted.strengths, []);

  const kpis = calculateKpiMetrics(INITIAL_COMPETITORS);
  assert.equal(kpis.trackedCount, 3);
  assert.equal(calculatePrice(79, true), 63);
  const pricingEvidence = filterEvidence(
    INITIAL_COMPETITORS[0].evidence,
    'Pricing',
    '',
  );
  assert.equal(pricingEvidence.length, 1);
});
