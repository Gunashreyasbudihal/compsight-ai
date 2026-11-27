import {
  Competitor,
  KpiSummary,
  PricingTier,
  ThreatLevel,
  VerifiedEvidenceItem,
} from './types';
import {
  buildCompetitorFromSnapshot,
  normalizeCompetitorInput,
  safeParseCompetitorDossier,
} from './services/intelligenceService';

function createInitialCompetitor(
  brandName: string,
  domain: string,
  rawDossier: Record<string, unknown>,
  secondSnapshotDossier?: Record<string, unknown>,
): Competitor {
  const url = `https://${domain}`;
  const snap1 = safeParseCompetitorDossier(rawDossier, {
    brandName,
    domain,
    url,
  });
  snap1.capturedAtLabel = '14m ago';
  const { competitor } = buildCompetitorFromSnapshot(
    { brandName, domain, url },
    snap1,
  );

  if (secondSnapshotDossier) {
    const snap2 = safeParseCompetitorDossier(secondSnapshotDossier, {
      brandName,
      domain,
      url,
    });
    snap2.capturedAtLabel = '2m ago';
    return buildCompetitorFromSnapshot(
      { brandName, domain, url },
      snap2,
      competitor,
    ).competitor;
  }

  return competitor;
}

const todayIso = new Date().toISOString().slice(0, 10);
const daysAgoIso = (days: number): string => {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
};

export const INITIAL_COMPETITORS: Competitor[] = [
  createInitialCompetitor(
    'Linear',
    'linear.app',
    {
      executiveBrief:
        'Linear builds a high-speed product planning and issue tracking system designed for modern software organizations. They target fast-moving engineering and product teams with a local-first sync engine, keyboard-centric triage, and native GitHub automation.',
      threatScore: 'HIGH',
      threatReason:
        'Rapid expansion from pure issue tracking into enterprise roadmaps and Customer Requests directly challenges full-lifecycle product suites.',
      strengths: [
        'Sub-50ms local-first sync engine with instant keyboard-driven triage',
        'Automated GitHub and GitLab pull request lifecycle transitions',
        'Built-in Customer Requests links Zendesk and Salesforce to roadmaps',
        'Fanatical developer brand loyalty and zero-clutter dark UI craft',
      ],
      weaknesses: [
        'Limited native portfolio financial budgeting for non-technical departments',
        'Opinionated workflow hierarchy resists custom multi-stage approval gates',
        'Enterprise SAML SSO and SCIM require jumping to higher-cost tiers',
      ],
      howToWin: [
        'Lead enterprise evaluations with cross-functional portfolio financial rollups',
        'Include SAML SSO and granular RBAC on mid-market tiers without seat tax',
        'Demonstrate customizable approval gates for regulated compliance teams',
      ],
      productsAndPricing: [
        {
          name: 'Free',
          price: '$0',
          billingCadence: 'forever · unlimited members',
          targetAudience: 'Early-stage startups & small engineering pods',
          standoutFeatures: [
            '2 active teams & 250 issue limit',
            'GitHub, GitLab & Slack integrations',
          ],
        },
        {
          name: 'Basic',
          price: '$8',
          billingCadence: 'per user / month billed annually',
          targetAudience: 'Growing product & engineering teams',
          standoutFeatures: [
            '5 teams & unlimited active issues',
            'Admin roles & unlimited file uploads',
          ],
        },
        {
          name: 'Business',
          price: '$12',
          billingCadence: 'per user / month billed annually',
          targetAudience: 'Scaling multi-team organizations',
          standoutFeatures: [
            'Unlimited teams, private teams & guest accounts',
            'Linear Insights analytics & Triage responsibility',
          ],
        },
      ],
      newsAndLaunches: [
        {
          title: 'Linear launches Customer Requests for CRM-linked product discovery',
          summary:
            'Connects Zendesk, Intercom, and Salesforce revenue attribution directly to engineering issues.',
          date: todayIso,
          sourceName: 'Linear Changelog',
          url: 'https://linear.app/changelog',
          sentiment: 'positive',
        },
        {
          title: 'Linear introduces Mobile App v2 with native triage gestures',
          summary:
            'Native iOS and Android clients bring offline issue inspection and swipe-to-snooze notifications.',
          date: daysAgoIso(18),
          sourceName: 'Linear Blog',
          url: 'https://linear.app/mobile',
          sentiment: 'positive',
        },
      ],
      customerPulse: {
        fundingAndGrowth:
          '$52M+ total funding backed by Sequoia & Accel; profitable growth powering 10,000+ software companies including OpenAI, Vercel, and Cash App.',
        usersLove: [
          'Instantaneous keyboard navigation (Cmd+K) and zero loading spinners',
          'Seamless GitHub PR auto-closing and cycle velocity charts',
          'Clean hierarchy of Initiatives, Projects, and Cycles without admin bloat',
        ],
        usersComplain: [
          'Hard to get non-engineering marketing and finance teams to adopt it',
          'Business tier price jump when needing private teams or guest seats',
          'Lack of built-in time tracking and resource capacity spreadsheets',
        ],
      },
      evidence: [
        {
          title: 'Linear Official Pricing & Tier Comparison Matrix',
          url: 'https://linear.app/pricing',
          sourceName: 'linear.app/pricing',
          snippet:
            'Verified Free ($0), Basic ($8/user/mo), Business ($14/user/mo), and Enterprise custom tiers.',
          category: 'Pricing',
        },
        {
          title: 'Linear Customer Requests & Product Operations Launch',
          url: 'https://linear.app/features',
          sourceName: 'linear.app/features',
          snippet:
            'Purpose-built system for modern product development across issues, projects, and roadmaps.',
          category: 'Website',
        },
        {
          title: 'G2 & Reddit Verified Engineering Manager Reviews',
          url: 'https://linear.app/customers',
          sourceName: 'Customer Pulse Index',
          snippet:
            '4.8/5 avg rating praising speed and GitHub sync while noting non-engineering customization limits.',
          category: 'Reviews',
        },
      ],
    },
    {
      executiveBrief:
        'Linear builds a high-speed product planning and issue tracking system designed for modern software organizations. They target fast-moving engineering and product teams with a local-first sync engine, keyboard-centric triage, and native GitHub automation.',
      threatScore: 'HIGH',
      threatReason:
        'Rapid expansion from pure issue tracking into enterprise roadmaps and Customer Requests directly challenges full-lifecycle product suites.',
      strengths: [
        'Sub-50ms local-first sync engine with instant keyboard-driven triage',
        'Automated GitHub and GitLab pull request lifecycle transitions',
        'Built-in Customer Requests links Zendesk and Salesforce to roadmaps',
        'New AI-assisted duplicate issue detection and automated triage routing',
      ],
      weaknesses: [
        'Limited native portfolio financial budgeting for non-technical departments',
        'Opinionated workflow hierarchy resists custom multi-stage approval gates',
        'Enterprise SAML SSO and SCIM require jumping to higher-cost tiers',
      ],
      howToWin: [
        'Lead enterprise evaluations with cross-functional portfolio financial rollups',
        'Include SAML SSO and granular RBAC on mid-market tiers without seat tax',
        'Demonstrate customizable approval gates for regulated compliance teams',
      ],
      productsAndPricing: [
        {
          name: 'Free',
          price: '$0',
          billingCadence: 'forever · unlimited members',
          targetAudience: 'Early-stage startups & small engineering pods',
          standoutFeatures: [
            '2 active teams & 250 issue limit',
            'GitHub, GitLab & Slack integrations',
          ],
        },
        {
          name: 'Basic',
          price: '$8',
          billingCadence: 'per user / month billed annually',
          targetAudience: 'Growing product & engineering teams',
          standoutFeatures: [
            '5 teams & unlimited active issues',
            'Admin roles & unlimited file uploads',
          ],
        },
        {
          name: 'Business',
          price: '$14',
          billingCadence: 'per user / month billed annually',
          targetAudience: 'Scaling multi-team organizations',
          standoutFeatures: [
            'Unlimited teams, private teams & guest accounts',
            'Customer Requests, Asks & Linear Insights',
          ],
        },
        {
          name: 'Enterprise',
          price: 'Custom',
          billingCadence: 'annual enterprise agreement',
          targetAudience: 'Large organizations requiring SAML & SLAs',
          standoutFeatures: [
            'SAML SSO, SCIM provisioning & HIPAA BAA',
            'Sub-initiatives, audit logs & 99.99% SLA',
          ],
        },
      ],
      newsAndLaunches: [
        {
          title: 'Linear launches Customer Requests for CRM-linked product discovery',
          summary:
            'Connects Zendesk, Intercom, and Salesforce revenue attribution directly to engineering issues.',
          date: todayIso,
          sourceName: 'Linear Changelog',
          url: 'https://linear.app/changelog',
          sentiment: 'positive',
        },
        {
          title: 'Linear introduces Mobile App v2 with native triage gestures',
          summary:
            'Native iOS and Android clients bring offline issue inspection and swipe-to-snooze notifications.',
          date: daysAgoIso(18),
          sourceName: 'Linear Blog',
          url: 'https://linear.app/mobile',
          sentiment: 'positive',
        },
        {
          title: 'Linear updates Business tier to $14/user with Asks & Customer Requests bundled',
          summary:
            'Restructured mid-market seat pricing while expanding enterprise security and sub-initiative limits.',
          date: daysAgoIso(48),
          sourceName: 'Linear Pricing Update',
          url: 'https://linear.app/pricing',
          sentiment: 'neutral',
        },
        {
          title: 'Users discuss enterprise seat minimums for SAML SSO on Hacker News',
          summary:
            'Mid-size teams request standalone SSO add-ons without full Enterprise contract commitments.',
          date: daysAgoIso(115),
          sourceName: 'Community Pulse',
          url: 'https://linear.app/security',
          sentiment: 'negative',
        },
      ],
      customerPulse: {
        fundingAndGrowth:
          '$52M+ total funding backed by Sequoia & Accel; profitable growth powering 10,000+ software companies including OpenAI, Vercel, and Cash App.',
        usersLove: [
          'Instantaneous keyboard navigation (Cmd+K) and zero loading spinners',
          'Seamless GitHub PR auto-closing and cycle velocity charts',
          'Clean hierarchy of Initiatives, Projects, and Cycles without admin bloat',
        ],
        usersComplain: [
          'Hard to get non-engineering marketing and finance teams to adopt it',
          'Business tier price jump ($14/mo) when needing private teams or guest seats',
          'Lack of built-in time tracking and resource capacity spreadsheets',
        ],
      },
      evidence: [
        {
          title: 'Linear Official Pricing & Tier Comparison Matrix',
          url: 'https://linear.app/pricing',
          sourceName: 'linear.app/pricing',
          snippet:
            'Verified Free ($0), Basic ($8/user/mo), Business ($14/user/mo), and Enterprise custom tiers.',
          category: 'Pricing',
        },
        {
          title: 'Linear Changelog — Customer Requests & Mobile Triage',
          url: 'https://linear.app/changelog',
          sourceName: 'linear.app/changelog',
          snippet:
            'Latest product releases covering Customer Requests, Asks, and native mobile clients.',
          category: 'Docs',
        },
        {
          title: 'Linear Enterprise Security & Trust Portal',
          url: 'https://linear.app/security',
          sourceName: 'linear.app/security',
          snippet:
            'SOC 2 Type II, GDPR, HIPAA compliance, and SAML 2.0 enterprise authentication details.',
          category: 'Website',
        },
        {
          title: 'G2 & Reddit Verified Engineering Manager Reviews',
          url: 'https://linear.app/customers',
          sourceName: 'Customer Pulse Index',
          snippet:
            '4.8/5 avg rating praising speed and GitHub sync while noting non-engineering customization limits.',
          category: 'Reviews',
        },
      ],
    },
  ),
  createInitialCompetitor('Stripe', 'stripe.com', {
    executiveBrief:
      'Stripe provides programmable financial infrastructure and usage-based billing software for internet businesses. They target developers through global enterprises with unified payment processing, metered AI token billing, and automated tax compliance.',
    threatScore: 'MED',
    threatReason:
      'Aggressive push into usage-based SaaS and AI metering expands their footprint into billing and revenue orchestration.',
    strengths: [
      'Industry-standard developer DX with idempotent webhooks and SDKs',
      'High-throughput usage metering for AI token and API credit billing',
      'Unified Billing, Tax, and Revenue Recognition in one console',
    ],
    weaknesses: [
      'Percentage-based billing fees (0.7%) compound steeply at high GMV',
      'Complex enterprise CPQ multi-entity hierarchies need custom middleware',
      'Fast technical support SLAs require paid premium support contracts',
    ],
    howToWin: [
      'Offer flat-fee platform pricing instead of a % cut of recurring revenue',
      'Provide native multi-subsidiary CPQ quoting without custom webhook code',
      'Bundle dedicated Slack engineering support for all growth-tier accounts',
    ],
    productsAndPricing: [
      {
        name: 'Payments Core',
        price: '2.9% + 30¢',
        billingCadence: 'per successful card charge',
        targetAudience: 'Startups & digital commerce platforms',
        standoutFeatures: [
          '135+ currencies & local payment methods',
          'Adaptive Acceptance & Radar fraud protection',
        ],
      },
      {
        name: 'Stripe Billing',
        price: '0.7%',
        billingCadence: 'of recurring billing volume',
        targetAudience: 'SaaS & usage-based AI companies',
        standoutFeatures: [
          'Metered usage ingestion at 10,000 events/sec',
          'Pre-built customer portal & smart retries',
        ],
      },
      {
        name: 'Enterprise Custom',
        price: 'Custom',
        billingCadence: 'volume-based IC+ contract',
        targetAudience: 'High-volume global enterprises',
        standoutFeatures: [
          'Interchange-plus pricing & country-specific rates',
          'Dedicated technical account management',
        ],
      },
    ],
    newsAndLaunches: [
      {
        title: 'Stripe launches high-throughput usage metering for AI workloads',
        summary:
          'New Meters API ingests real-time token and compute events with built-in credit burndown widgets.',
        date: daysAgoIso(7),
        sourceName: 'Stripe Sessions',
        url: 'https://stripe.com/billing',
        sentiment: 'positive',
      },
      {
        title: 'Stripe decouples Billing and Tax for external payment processors',
        summary:
          'Enterprises can now use Stripe Billing and Tax modules even on non-Stripe payment gateways.',
        date: daysAgoIso(45),
        sourceName: 'Stripe Newsroom',
        url: 'https://stripe.com/newsroom',
        sentiment: 'positive',
      },
      {
        title: 'CFOs evaluate flat-fee billing alternatives as SaaS ARR scales',
        summary:
          'Finance leaders scrutinize variable 0.7% billing fees once annual recurring revenue crosses $20M.',
        date: daysAgoIso(98),
        sourceName: 'SaaS Finance Pulse',
        url: 'https://stripe.com/pricing',
        sentiment: 'negative',
      },
    ],
    customerPulse: {
      fundingAndGrowth:
        '$65B+ valuation processing over $1 Trillion in annual payment volume across millions of global businesses.',
      usersLove: [
        'World-class API documentation, test clocks, and CLI local webhook testing',
        'One-click Link checkout and high global payment authorization rates',
        'Fast rollout of usage-based and tiered subscription models',
      ],
      usersComplain: [
        'Add-on percentage fees for Billing, Tax, and Invoicing Plus add up quickly',
        'Rigid invoice customization for complex enterprise PO workflows',
        'Account reserve holds can disrupt cash flow for sudden volume spikes',
      ],
    },
    evidence: [
      {
        title: 'Stripe Official Pricing & Billing Fee Schedule',
        url: 'https://stripe.com/pricing',
        sourceName: 'stripe.com/pricing',
        snippet:
          'Verified 2.9% + 30c standard processing and 0.7% usage-based billing rates.',
        category: 'Pricing',
      },
      {
        title: 'Stripe Billing Usage-Based Metering Documentation',
        url: 'https://stripe.com/billing',
        sourceName: 'stripe.com/billing',
        snippet:
          'Real-time event ingestion, credit grants, and revenue recovery automation.',
        category: 'Docs',
      },
    ],
  }),
  createInitialCompetitor('Figma', 'figma.com', {
    executiveBrief:
      'Figma is the collaborative browser-based interface design, prototyping, and developer handoff platform. They target product designers and front-end engineering teams with real-time multiplayer editing, design systems, and Code Connect.',
    threatScore: 'MED',
    threatReason:
      'Dev Mode and Code Connect deepen lock-in across engineering workflows, though per-seat developer pricing creates openings.',
    strengths: [
      'Real-time multiplayer WebGL canvas supporting hundreds of editors',
      'Code Connect maps production React and Swift components to frames',
      'Dominant community ecosystem of plugins, UI kits, and design tokens',
    ],
    weaknesses: [
      'Paid Dev Mode seat charges cause budget pushback from engineering VPs',
      'Very large multi-brand design libraries strain browser memory limits',
      'Prototyping logic remains complex for data-heavy enterprise tables',
    ],
    howToWin: [
      'Include unlimited developer inspection seats free on all team plans',
      'Provide native Git branch syncing for design tokens without CLI overhead',
      'Show real production data binding directly inside interactive prototypes',
    ],
    productsAndPricing: [
      {
        name: 'Starter',
        price: '$0',
        billingCadence: 'forever · up to 3 Figma & FigJam files',
        targetAudience: 'Individual designers & small trial projects',
        standoutFeatures: [
          'Unlimited personal drafts & basic inspection',
          'Mobile app preview & community plugins',
        ],
      },
      {
        name: 'Professional',
        price: '$15',
        billingCadence: 'per full seat / month billed annually',
        targetAudience: 'Product design & cross-functional teams',
        standoutFeatures: [
          'Unlimited files, shared team libraries & prototyping',
          'Dev Mode inspection ($12/mo standalone seat)',
        ],
      },
      {
        name: 'Organization',
        price: '$45',
        billingCadence: 'per full seat / month billed annually',
        targetAudience: 'Multi-product design orgs',
        standoutFeatures: [
          'Org-wide design systems, branching & analytics',
          'Centralized admin, SSO & private plugins',
        ],
      },
    ],
    newsAndLaunches: [
      {
        title: 'Figma expands Code Connect with bidirectional GitHub component sync',
        summary:
          'Engineers see live production code snippets instead of raw CSS inside Dev Mode.',
        date: daysAgoIso(12),
        sourceName: 'Figma Blog',
        url: 'https://figma.com/blog',
        sentiment: 'positive',
      },
      {
        title: 'Engineering leaders review Dev Mode seat utilization at renewal',
        summary:
          'Organizations audit occasional developer viewers vs full Dev Mode seats to control annual spend.',
        date: daysAgoIso(64),
        sourceName: 'DesignOps Pulse',
        url: 'https://figma.com/pricing',
        sentiment: 'negative',
      },
    ],
    customerPulse: {
      fundingAndGrowth:
        'Independent category leader valued at $12.5B+ following secondary tender offer, serving over 4 million active product builders.',
      usersLove: [
        'Effortless multiplayer collaboration and instant URL sharing',
        'Auto Layout v5 and design token variables for multi-theme systems',
        'Code Connect reducing ambiguity between design specs and production React',
      ],
      usersComplain: [
        'Separate per-seat billing for Dev Mode and unexpected true-up invoices',
        'Complex admin billing interface for managing viewer vs editor upgrades',
        'Performance slowdowns on files with thousands of nested component variants',
      ],
    },
    evidence: [
      {
        title: 'Figma Official Seat & Dev Mode Pricing Matrix',
        url: 'https://figma.com/pricing',
        sourceName: 'figma.com/pricing',
        snippet:
          'Verified Starter ($0), Professional ($15/seat/mo), Organization ($45/seat/mo), and Enterprise ($75/seat/mo).',
        category: 'Pricing',
      },
      {
        title: 'Figma Dev Mode & Code Connect Product Overview',
        url: 'https://figma.com/dev-mode',
        sourceName: 'figma.com/dev-mode',
        snippet:
          'Bring design and development closer with production component code in inspect panel.',
        category: 'Website',
      },
    ],
  }),
];

export const PRICING_TIERS: PricingTier[] = [
  {
    id: 'starter',
    name: 'Starter',
    audience: 'For early-stage product founders',
    monthlyPrice: 0,
    description:
      'Essential competitor URL tracking, live Google Search grounding, and core AI battlecards.',
    ctaLabel: 'Launch Free Terminal',
    specs: [
      { label: 'Tracked Competitors', value: 'Up to 3 rivals' },
      { label: 'Snapshot Frequency', value: 'On-demand & daily' },
      { label: 'Diff Timeline History', value: '30-day retention' },
      { label: 'Battlecard Exports', value: '1-Click Markdown (.md)' },
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    audience: 'For product marketing & GTM teams',
    monthlyPrice: 79,
    description:
      'Continuous 360° monitoring, automatic snapshot diff engine, and unlimited AI Analyst queries.',
    highlighted: true,
    ctaLabel: 'Start Pro Terminal',
    specs: [
      { label: 'Tracked Competitors', value: 'Up to 25 rivals' },
      { label: 'Snapshot Frequency', value: 'Hourly live scanning' },
      { label: 'Diff Timeline History', value: '365-day retention' },
      { label: 'AI Analyst Drawer', value: 'Unlimited Q&A + Quick Prompts' },
    ],
  },
  {
    id: 'team',
    name: 'Team',
    audience: 'For multi-product competitive intel',
    monthlyPrice: 249,
    description:
      'Unlimited competitor matrices, shared team battlecards, Slack threat alerts, and API access.',
    ctaLabel: 'Deploy Team Terminal',
    specs: [
      { label: 'Tracked Competitors', value: 'Unlimited rivals' },
      { label: 'Snapshot Frequency', value: 'Sub-15m continuous lock' },
      { label: 'Diff Timeline History', value: 'Unlimited archive + API' },
      { label: 'Enterprise Security', value: 'SAML SSO & SOC2 Type II' },
    ],
  },
];

export const normalizeCompetitorUrl = normalizeCompetitorInput;

export function calculateKpiMetrics(competitors: Competitor[]): KpiSummary {
  const safeList = Array.isArray(competitors) ? competitors : [];
  const trackedCount = safeList.length;
  const snapshotsCount = safeList.reduce(
    (sum, item) => sum + (item.snapshotsCount || 0),
    0,
  );
  const liveScanningCount = safeList.filter((c) => c.isLiveScanning).length;
  const hasHigh = safeList.some((c) => c.threatScore === 'HIGH');
  const hasMed = safeList.some((c) => c.threatScore === 'MED');
  const overallThreatLevel: ThreatLevel = hasHigh
    ? 'High Threat'
    : hasMed
      ? 'Medium Threat'
      : 'Low Threat';

  return {
    trackedCount,
    snapshotsCount,
    liveScanningCount,
    overallThreatLevel,
  };
}

export function calculatePrice(monthlyPrice: number, isAnnual: boolean): number {
  if (monthlyPrice <= 0) return 0;
  return isAnnual ? Math.round(monthlyPrice * 0.8) : monthlyPrice;
}

export function filterEvidence(
  items: VerifiedEvidenceItem[],
  category: string,
  query: string,
): VerifiedEvidenceItem[] {
  const safeItems = Array.isArray(items) ? items : [];
  const normalizedQuery = (query ?? '').trim().toLowerCase();
  return safeItems.filter((item) => {
    const matchesCategory =
      category === 'All' ||
      (item.category || '').toLowerCase() === category.toLowerCase();
    const matchesQuery =
      !normalizedQuery ||
      (item.title || '').toLowerCase().includes(normalizedQuery) ||
      (item.url || '').toLowerCase().includes(normalizedQuery) ||
      (item.snippet || '').toLowerCase().includes(normalizedQuery);
    return matchesCategory && matchesQuery;
  });
}
