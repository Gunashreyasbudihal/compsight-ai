export type ThreatScore = 'LOW' | 'MED' | 'HIGH';
export type ThreatLevel = 'Low Threat' | 'Medium Threat' | 'High Threat';

export type NewsDateFilter = '30d' | '90d' | 'all';
export type TerminalTab =
  | 'overview'
  | 'news'
  | 'products'
  | 'timeline'
  | 'evidence';
export type ShowcaseTab =
  | 'overview'
  | 'news'
  | 'products'
  | 'timeline'
  | 'evidence';

export interface ProductPricingTier {
  id: string;
  name: string;
  price: string;
  billingCadence: string;
  targetAudience: string;
  standoutFeatures: string[];
}

export interface NewsIntelItem {
  id: string;
  title: string;
  summary: string;
  date: string; // YYYY-MM-DD
  sourceName: string;
  url: string;
  sentiment: 'positive' | 'neutral' | 'negative';
}

export interface CustomerPulse {
  fundingAndGrowth: string;
  usersLove: string[];
  usersComplain: string[];
}

export interface VerifiedEvidenceItem {
  id: string;
  title: string;
  url: string;
  sourceName: string;
  snippet: string;
  category: 'Website' | 'Pricing' | 'Reviews' | 'News' | 'Docs';
  capturedAt: string;
}

export interface CompetitorSnapshot {
  id: string;
  timestamp: string; // ISO timestamp
  capturedAtLabel: string;
  executiveBrief: string;
  threatScore: ThreatScore;
  threatReason: string;
  strengths: string[];
  weaknesses: string[];
  howToWin: string[];
  counterMoves: string[];
  productsAndPricing: ProductPricingTier[];
  products: ProductPricingTier[];
  newsAndLaunches: NewsIntelItem[];
  newsItems: NewsIntelItem[];
  customerPulse: CustomerPulse;
  customerPraise: string[];
  customerComplaints: string[];
  evidence: VerifiedEvidenceItem[];
}

export interface DiffChangeItem {
  id: string;
  timestamp: string;
  capturedAtLabel: string;
  snapshotFromLabel: string;
  snapshotToLabel: string;
  status: 'added' | 'modified' | 'removed';
  category: 'Pricing' | 'Battlecard' | 'Product' | 'Threat' | 'News';
  title: string;
  summary: string;
  previousValue?: string;
  currentValue?: string;
}

export interface AnalystMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface FeatureCardItem {
  id: string;
  name: string;
  category: string;
  summary: string;
  tag: string;
  accentColor: 'indigo' | 'violet' | 'emerald' | 'amber';
}

export interface TimelineBranch {
  id: string;
  snapshotFrom: string;
  snapshotTo: string;
  label: string;
  detail: string;
  timestamp: string;
  status: 'added' | 'modified' | 'removed';
  confidence: string;
}

export interface Competitor {
  id: string;
  name: string;
  domain: string;
  url: string;
  tagline: string;
  threatScore: ThreatScore;
  threatReason: string;
  threatLevel: ThreatLevel;
  snapshotsCount: number;
  lastScannedAt: string;
  scanProgress: number;
  isLiveScanning: boolean;
  executiveBrief: string;
  strengths: string[];
  weaknesses: string[];
  howToWin: string[];
  counterMoves: string[];
  productsAndPricing: ProductPricingTier[];
  products: ProductPricingTier[];
  newsAndLaunches: NewsIntelItem[];
  newsItems: NewsIntelItem[];
  customerPulse: CustomerPulse;
  customerPraise: string[];
  customerComplaints: string[];
  evidence: VerifiedEvidenceItem[];
  snapshots: CompetitorSnapshot[];
  diffHistory: DiffChangeItem[];
  chatHistory: AnalystMessage[];
  // Spatial XR scene compatibility helpers
  featureCards: FeatureCardItem[];
  timelineBranches: TimelineBranch[];
}

export interface KpiSummary {
  trackedCount: number;
  snapshotsCount: number;
  liveScanningCount: number;
  overallThreatLevel: ThreatLevel;
}

export interface PricingTier {
  id: string;
  name: string;
  audience: string;
  monthlyPrice: number;
  description: string;
  highlighted?: boolean;
  ctaLabel: string;
  specs: {
    label: string;
    value: string;
  }[];
}
