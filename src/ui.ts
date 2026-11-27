import { CompSightApiClient } from './api';
import {
  PRICING_TIERS,
  calculateKpiMetrics,
  calculatePrice,
  filterEvidence,
} from './logic';
import { downloadBattlecardMarkdown } from './services/exportService';
import {
  filterNewsByDateRange,
  normalizeCompetitorInput,
} from './services/intelligenceService';
import {
  Competitor,
  NewsDateFilter,
  ShowcaseTab,
  TerminalTab,
} from './types';

const QUICK_PROMPTS = [
  'How do we beat them on pricing?',
  'Summarize their biggest customer complaints',
  'Draft a 3-line sales objection response',
];

/**
 * Returns the CompSight geometric C-reticle SVG matching /public/assets/aistudio/brand_logo_b61b8736.jpeg.
 */
export function getCompSightLogoSvg(size = 28): string {
  return `
    <svg width="${size}" height="${size}" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect x="2" y="2" width="60" height="60" rx="15" fill="#0B0D11" stroke="#1E2430" stroke-width="2.5"/>
      <path d="M44.5 20.5A18 18 0 1 0 44.5 43.5" stroke="#F1F5F9" stroke-width="6.5" stroke-linecap="round"/>
      <rect x="29.5" y="6" width="5" height="12" rx="2.5" fill="#64748B" fill-opacity="0.78"/>
      <rect x="29.5" y="46" width="5" height="12" rx="2.5" fill="#64748B" fill-opacity="0.78"/>
      <rect x="6" y="29.5" width="12" height="5" rx="2.5" fill="#64748B" fill-opacity="0.78"/>
      <rect x="46" y="29.5" width="12" height="5" rx="2.5" fill="#64748B" fill-opacity="0.78"/>
      <circle cx="32" cy="32" r="8" fill="#10B981"/>
    </svg>
  `;
}

export class CompSightUI {
  private root: HTMLElement;
  private api: CompSightApiClient;
  private competitors: Competitor[] = [];
  private activeCompetitorId = 'linear';
  private viewMode: 'landing' | 'terminal' = 'landing';
  private showcaseTab: ShowcaseTab = 'overview';
  private terminalTab: TerminalTab = 'overview';
  private newsDateFilter: NewsDateFilter = 'all';
  private isAnnualBilling = true;
  private quickScanError = '';
  private sidebarScanError = '';
  private apiErrorBanner: {
    message: string;
    retryInput: string;
    retrySource: 'hero' | 'sidebar' | 'rescan';
    retryCompetitor?: Competitor;
  } | null = null;
  private aiErrorBanner: {
    message: string;
    retryQuestion: string;
  } | null = null;
  private isScanning = false;
  private isAiDrawerOpen = false;
  private isAiThinking = false;
  private evidenceCategory = 'All';
  private evidenceQuery = '';
  private toastMessage = '';
  private toastTimer?: number;
  private xrActive = false;
  private onCompetitorChange?: (comp: Competitor, all: Competitor[]) => void;
  private onToggleXR?: (active: boolean) => void;

  constructor(
    root: HTMLElement,
    api: CompSightApiClient,
    options?: {
      onCompetitorChange?: (comp: Competitor, all: Competitor[]) => void;
      onToggleXR?: (active: boolean) => void;
    },
  ) {
    this.root = root;
    this.api = api;
    this.onCompetitorChange = options?.onCompetitorChange;
    this.onToggleXR = options?.onToggleXR;

    const params = new URLSearchParams(window.location.search);
    if (params.get('autostart') === '1' || params.get('view') === 'terminal') {
      this.viewMode = 'terminal';
    }
  }

  async init(): Promise<void> {
    const { competitors } = await this.api.getCompetitors();
    this.competitors = competitors;
    if (this.competitors.length > 0) {
      this.activeCompetitorId = this.competitors[0].id;
    } else {
      this.activeCompetitorId = '';
    }
    this.render();
    this.notifySpatialSync();
  }

  public selectCompetitorFromExternal(comp: Competitor): void {
    if (comp.id !== this.activeCompetitorId) {
      this.competitors = this.api.resetCompetitorChatHistory(comp.id);
      this.aiErrorBanner = null;
    }
    this.activeCompetitorId = comp.id;
    this.render();
  }

  private getActiveCompetitor(): Competitor | undefined {
    return (
      this.competitors.find((c) => c.id === this.activeCompetitorId) ||
      this.competitors[0]
    );
  }

  private notifySpatialSync(): void {
    const active = this.getActiveCompetitor();
    if (active && this.onCompetitorChange) {
      this.onCompetitorChange(active, this.competitors);
    }
  }

  private showToast(message: string): void {
    this.toastMessage = message;
    if (this.toastTimer) {
      window.clearTimeout(this.toastTimer);
    }
    this.renderToastOnly();
    this.toastTimer = window.setTimeout(() => {
      this.toastMessage = '';
      this.renderToastOnly();
    }, 4200);
  }

  private renderToastOnly(): void {
    const existing = document.getElementById('cs-live-toast');
    if (!this.toastMessage) {
      existing?.remove();
      return;
    }
    if (existing) {
      const span = existing.querySelector('.cs-toast-text');
      if (span) span.textContent = this.toastMessage;
      return;
    }
    const toast = document.createElement('div');
    toast.id = 'cs-live-toast';
    toast.className = 'cs-toast';
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');
    toast.innerHTML = `
      <span class="cs-live-dot" aria-hidden="true"></span>
      <span class="cs-toast-text">${this.escapeHtml(this.toastMessage)}</span>
    `;
    document.body.appendChild(toast);
  }

  private escapeHtml(str: string): string {
    return (str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  private formatMarkdownBullets(text: string): string {
    const escaped = this.escapeHtml(text);
    return escaped.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  }

  private switchView(targetView: 'landing' | 'terminal'): void {
    this.viewMode = targetView;
    this.quickScanError = '';
    this.sidebarScanError = '';
    this.render();
    window.scrollTo(0, 0);
  }

  private async handleScanSubmit(
    rawInput: string,
    source: 'hero' | 'sidebar' | 'rescan',
    forceRescanCompetitor?: Competitor,
  ): Promise<void> {
    if (this.isScanning) return;
    if (source === 'hero') this.quickScanError = '';
    if (source === 'sidebar') this.sidebarScanError = '';

    // 1. Strict URL & Brand Name Validation BEFORE calling the API
    const validation = normalizeCompetitorInput(rawInput);
    if (!validation.valid) {
      const errMsg = validation.error || 'Enter a valid competitor name or URL.';
      if (source === 'hero') {
        this.quickScanError = errMsg;
      } else {
        this.sidebarScanError = errMsg;
      }
      this.render();
      return;
    }

    try {
      this.isScanning = true;
      this.apiErrorBanner = null;
      if (source === 'hero') {
        this.viewMode = 'terminal';
        window.scrollTo(0, 0);
      }
      this.render();

      const { competitor, isNew, newDiffs } = await this.api.analyzeCompetitor(
        rawInput,
        forceRescanCompetitor,
      );
      const refreshed = await this.api.getCompetitors();
      this.competitors = refreshed.competitors;
      if (competitor.id !== this.activeCompetitorId) {
        this.competitors = this.api.resetCompetitorChatHistory(competitor.id);
        this.aiErrorBanner = null;
      }
      this.activeCompetitorId = competitor.id;
      this.isScanning = false;
      this.viewMode = 'terminal';

      if (source === 'rescan') {
        this.terminalTab = 'timeline';
      } else {
        this.terminalTab = 'overview';
      }

      this.render();
      this.notifySpatialSync();
      window.scrollTo(0, 0);

      this.showToast(
        isNew
          ? `360° live intelligence extracted for ${competitor.name} (${competitor.domain})`
          : `Snapshot #${competitor.snapshotsCount} locked · ${newDiffs.length} change${newDiffs.length === 1 ? '' : 's'} logged in Diff Timeline`,
      );
    } catch (err) {
      this.isScanning = false;
      const msg =
        err instanceof Error
          ? err.message
          : 'Live Gemini intelligence research failed. Please retry.';
      this.apiErrorBanner = {
        message: msg,
        retryInput: rawInput,
        retrySource: source,
        retryCompetitor: forceRescanCompetitor,
      };
      this.render();
    }
  }

  private async handleAskAnalyst(question: string): Promise<void> {
    const trimmed = (question ?? '').trim();
    if (this.isAiThinking || !trimmed) return;
    const active = this.getActiveCompetitor();
    if (!active) return;

    try {
      this.isAiThinking = true;
      this.isAiDrawerOpen = true;
      this.aiErrorBanner = null;

      // Immediately append the user message and re-render so the input clears and loading state shows
      this.api.appendUserMessage(active.id, trimmed);
      const afterUserAppend = await this.api.getCompetitors();
      this.competitors = afterUserAppend.competitors;
      this.render();
      this.scrollDrawerToBottom();

      const updated = await this.api.askAnalyst(active.id, trimmed);
      const refreshed = await this.api.getCompetitors();
      this.competitors = refreshed.competitors;
      this.activeCompetitorId = updated.id;
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Unable to reach CompSight AI Analyst. Please retry.';
      this.aiErrorBanner = {
        message: msg,
        retryQuestion: trimmed,
      };
    } finally {
      this.isAiThinking = false;
      this.render();
      this.scrollDrawerToBottom();
    }
  }

  private scrollDrawerToBottom(): void {
    const container = document.getElementById('ai-drawer-messages');
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }

  private handleSelectCompetitor(id: string): void {
    if (!id) return;
    if (id !== this.activeCompetitorId) {
      // Automatically reset the chat thread when switching to a different competitor
      this.competitors = this.api.resetCompetitorChatHistory(id);
      this.aiErrorBanner = null;
    }
    this.activeCompetitorId = id;
    this.render();
    this.notifySpatialSync();
  }

  private handleDeleteActiveCompetitor(): void {
    const active = this.getActiveCompetitor();
    if (!active) return;

    const deletedName = active.name;
    this.competitors = this.api.deleteCompetitor(active.id);
    this.activeCompetitorId = this.competitors[0]?.id || '';
    this.apiErrorBanner = null;
    this.aiErrorBanner = null;
    if (this.competitors.length === 0) {
      this.isAiDrawerOpen = false;
    }
    this.render();
    this.notifySpatialSync();
    this.showToast(`Removed ${deletedName} from tracked competitors.`);
  }

  public render(): void {
    if (this.xrActive) {
      document.body.classList.add('xr-spatial-active');
      this.root.innerHTML = this.renderXrSpatialHud();
      this.bindXrHudEvents();
      this.renderToastOnly();
      return;
    }

    document.body.classList.remove('xr-spatial-active');
    if (this.viewMode === 'terminal') {
      this.root.innerHTML = this.renderTerminalView();
      this.bindTerminalEvents();
    } else {
      this.root.innerHTML = this.renderLandingView();
      this.bindLandingEvents();
    }
    this.renderToastOnly();
  }

  private renderXrSpatialHud(): string {
    const active = this.getActiveCompetitor();
    return `
      <div class="xr-hud-bar" style="position: fixed; top: 16px; left: 24px; right: 24px; z-index: 45; display: flex; align-items: center; justify-content: space-between; padding: 12px 20px; border-radius: 12px; background: rgba(11, 13, 17, 0.88); border: 1px solid #1e2430; backdrop-filter: blur(12px);">
        <div style="display: flex; align-items: center; gap: 12px;">
          ${getCompSightLogoSvg(28)}
          <div>
            <div style="font-weight: 700; font-size: 0.95rem;">CompSight 3D Spatial XR Terminal</div>
            <div class="font-mono" style="font-size: 0.75rem; color: #34d399;">Active Target: ${active ? `${this.escapeHtml(active.name)} (${this.escapeHtml(active.domain)})` : 'None'}</div>
          </div>
        </div>
        <div style="display: flex; align-items: center; gap: 10px;">
          <button type="button" id="btn-exit-xr-hud" class="cs-btn-primary">
            Return to 2D Terminal
          </button>
        </div>
      </div>
    `;
  }

  private bindXrHudEvents(): void {
    document
      .getElementById('btn-exit-xr-hud')
      ?.addEventListener('click', () => {
        this.xrActive = false;
        this.onToggleXR?.(false);
        this.render();
      });
  }

  private renderErrorBannerHtml(): string {
    if (!this.apiErrorBanner) return '';
    return `
      <div class="cs-error-banner" role="alert" data-testid="api-error-banner">
        <div style="display: flex; flex-direction: column; gap: 4px; min-width: 0;">
          <div class="font-mono" style="font-size: 0.75rem; font-weight: 700; color: #f87171; letter-spacing: 0.06em;">
            LIVE INTELLIGENCE ENGINE ERROR
          </div>
          <div style="font-size: 0.88rem; color: #fecaca; line-height: 1.5;">
            ${this.escapeHtml(this.apiErrorBanner.message)}
          </div>
        </div>
        <div style="display: flex; align-items: center; gap: 8px; flex-shrink: 0;">
          <button
            type="button"
            id="btn-retry-scan"
            class="cs-btn-primary"
            style="min-height: 36px; padding: 6px 14px;"
            ${this.isScanning ? 'disabled' : ''}
          >
            ${this.isScanning ? 'Retrying...' : 'Retry'}
          </button>
          <button
            type="button"
            id="btn-dismiss-scan-error"
            class="cs-btn-secondary"
            style="min-height: 36px; padding: 6px 12px;"
          >
            Dismiss
          </button>
        </div>
      </div>
    `;
  }

  /* =========================================================================
   * VIEW 1: SINGLE SCROLLING LANDING PAGE (view === 'landing')
   * ========================================================================= */
  private renderLandingView(): string {
    const kpis = calculateKpiMetrics(this.competitors);
    const active = this.getActiveCompetitor();

    return `
      <!-- 1. Glassmorphic Navbar (3-Zone Contract) -->
      <header class="cs-navbar">
        <div class="cs-navbar-inner">
          <a href="#top" class="cs-brand-link" id="nav-brand-home">
            ${getCompSightLogoSvg(28)}
            <span>CompSight</span>
          </a>

          <nav class="cs-nav-links" aria-label="Primary Navigation">
            <a href="#preview" class="cs-nav-link">Preview</a>
            <a href="#features" class="cs-nav-link">Features</a>
            <a href="#how-it-works" class="cs-nav-link">How It Works</a>
            <a href="#pricing" class="cs-nav-link">Pricing</a>
          </nav>

          <button type="button" class="cs-btn-primary" id="nav-launch-terminal">
            Launch Terminal
          </button>
        </div>
      </header>

      <main id="top">
        <!-- 2. HERO SECTION (RADAR IMAGE + FLASHLIGHT REVEAL + SEAMLESS BOTTOM FADE) -->
        <section class="cs-hero" id="hero-flashlight-section" aria-label="CompSight Live Intelligence Hero">
          <img
            src="/hero-radar.jpg"
            alt="CompSight obsidian radar sweep, Battlecard, Competitive Timeline, and Product Matrix interface"
            class="cs-hero-bg"
            referrerpolicy="no-referrer"
            onerror="this.onerror=null;this.src='/assets/aistudio/hero_section_background_55e6e620.jpeg';"
          />
          <div class="cs-hero-ambient" aria-hidden="true"></div>
          <div class="cs-hero-flashlight" id="hero-flashlight-mask" aria-hidden="true"></div>
          <div class="cs-hero-bottom-fade" aria-hidden="true"></div>

          <div class="cs-hero-content">
            <div class="cs-terminal-kicker">
              <span class="cs-live-dot" aria-hidden="true"></span>
              <span>LIVE INTELLIGENCE TERMINAL</span>
            </div>

            <h1 class="cs-hero-title">
              See every rival move before the market does.
            </h1>

            <p class="cs-hero-subtitle">
              Automated competitor scraping, AI battlecards, and real-time diff timelines in one obsidian terminal.
            </p>

            <!-- Inline Quick-Scan Bar -->
            <div class="cs-quickscan-wrap cs-hero-interactive">
              <form id="hero-quickscan-form" class="cs-quickscan-bar" novalidate>
                <label for="hero-url-input" style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0);">Competitor Name or URL</label>
                <input
                  id="hero-url-input"
                  name="competitorUrl"
                  type="text"
                  class="cs-quickscan-input"
                  placeholder="https://competitor.com or rival name (e.g. Notion)"
                  aria-label="Competitor URL to scan"
                  autocomplete="off"
                />
                <button type="submit" class="cs-btn-primary" id="hero-scan-submit" ${this.isScanning ? 'disabled' : ''}>
                  ${this.isScanning ? 'Scanning Rival...' : 'Scan Competitor'}
                </button>
                <button type="button" class="cs-btn-secondary" id="hero-launch-terminal">
                  Launch Terminal
                </button>
              </form>
              ${
                this.quickScanError
                  ? `<div class="cs-form-error" role="alert">${this.escapeHtml(this.quickScanError)}</div>`
                  : ''
              }
              <div class="cs-hero-hint">
                <span>Move cursor to illuminate radar telemetry · Or instant-scan:</span>
                <button type="button" class="cs-preset-btn" data-preset-url="https://vercel.com">vercel.com</button>
                <span>·</span>
                <button type="button" class="cs-preset-btn" data-preset-url="https://cursor.com">cursor.com</button>
                <span>·</span>
                <button type="button" class="cs-preset-btn" data-preset-url="Notion">Notion</button>
              </div>
            </div>
          </div>
        </section>

        <!-- 3. COHESIVE LOWER SECTIONS (Subtle dot grid + soft emerald radial glows) -->
        <div class="cs-landing-lower">
          <!-- Telemetry KPI Strip -->
          <section class="cs-kpi-strip" aria-label="Live Telemetry Metrics">
            <div class="cs-container">
              <div class="cs-kpi-grid">
                <div class="cs-kpi-card emerald" data-testid="kpi-tracked">
                  <div class="cs-kpi-value" style="color: #34d399;">${kpis.trackedCount} tracked</div>
                  <div class="cs-kpi-sub">Active rival domains monitored</div>
                </div>

                <div class="cs-kpi-card" data-testid="kpi-snapshots">
                  <div class="cs-kpi-value">${kpis.snapshotsCount} snapshots</div>
                  <div class="cs-kpi-sub">Timestamped 360° checkpoints</div>
                </div>

                <div class="cs-kpi-card amber" data-testid="kpi-scanning">
                  <div class="cs-kpi-value" style="color: #fbbf24;">Live Search Grounding</div>
                  <div class="cs-kpi-sub">${kpis.liveScanningCount} active crawlers + Gemini AI</div>
                </div>

                <div class="cs-kpi-card crimson" data-testid="kpi-threat">
                  <div class="cs-kpi-value" style="color: #f87171;">${this.escapeHtml(kpis.overallThreatLevel)}</div>
                  <div class="cs-kpi-sub">${active ? `${this.escapeHtml(active.name)} (${active.threatScore} threat score)` : 'Ready for target scan'}</div>
                </div>
              </div>
            </div>
          </section>

          <!-- Interactive Product Showcase (#preview) -->
          <section class="cs-section cs-ambient-glow-section" id="preview">
            <div class="cs-container">
              <div class="cs-section-header">
                <span class="cs-section-kicker">LIVE TERMINAL PREVIEW</span>
                <h2 class="cs-section-title">
                  Every competitive signal distilled into five executive tabs.
                </h2>
                <p class="cs-section-desc">
                  Preview a live 360° dossier below. Switch between the Executive Overview, Live News &amp; Intel, Products &amp; Pricing Matrix, Automatic Diff Timeline, and Verified Evidence.
                </p>
              </div>

              ${
                active
                  ? `
                    <div class="cs-showcase-shell">
                      <div class="cs-showcase-topbar">
                        <div class="cs-tabs" role="tablist" aria-label="Intelligence Terminal Preview Tabs">
                          <button
                            type="button"
                            role="tab"
                            aria-selected="${this.showcaseTab === 'overview'}"
                            class="cs-tab-btn ${this.showcaseTab === 'overview' ? 'active' : ''}"
                            data-showcase-tab="overview"
                          >
                            Overview
                          </button>
                          <button
                            type="button"
                            role="tab"
                            aria-selected="${this.showcaseTab === 'news'}"
                            class="cs-tab-btn ${this.showcaseTab === 'news' ? 'active' : ''}"
                            data-showcase-tab="news"
                          >
                            News &amp; Intel
                          </button>
                          <button
                            type="button"
                            role="tab"
                            aria-selected="${this.showcaseTab === 'products'}"
                            class="cs-tab-btn ${this.showcaseTab === 'products' ? 'active' : ''}"
                            data-showcase-tab="products"
                          >
                            Products &amp; Pricing
                          </button>
                          <button
                            type="button"
                            role="tab"
                            aria-selected="${this.showcaseTab === 'timeline'}"
                            class="cs-tab-btn ${this.showcaseTab === 'timeline' ? 'active' : ''}"
                            data-showcase-tab="timeline"
                          >
                            Diff Timeline
                          </button>
                          <button
                            type="button"
                            role="tab"
                            aria-selected="${this.showcaseTab === 'evidence'}"
                            class="cs-tab-btn ${this.showcaseTab === 'evidence' ? 'active' : ''}"
                            data-showcase-tab="evidence"
                          >
                            Evidence
                          </button>
                        </div>

                        <div style="display: flex; align-items: center; gap: 8px;">
                          ${this.competitors
                            .slice(0, 4)
                            .map(
                              (comp) => `
                                <button
                                  type="button"
                                  class="cs-tab-btn ${comp.id === active.id ? 'active' : ''}"
                                  data-select-competitor="${comp.id}"
                                  style="padding: 6px 12px; min-height: 32px; font-family: var(--font-mono); font-size: 0.75rem;"
                                >
                                  ${this.escapeHtml(comp.name)}
                                </button>
                              `,
                            )
                            .join('')}
                        </div>
                      </div>

                      <div class="cs-showcase-body">
                        ${this.renderActiveTabPanel(active, this.showcaseTab)}
                      </div>
                    </div>
                  `
                  : `
                    <div class="cs-card" style="text-align: center; padding: 48px 24px;">
                      <h3 style="margin: 0 0 10px 0;">No competitors currently tracked</h3>
                      <p style="margin: 0 0 20px 0; color: var(--text-muted);">Use the Quick-Scan bar above or launch the terminal to scan a rival domain.</p>
                    </div>
                  `
              }
            </div>
          </section>

          <!-- Features Section (#features) -->
          <section class="cs-section" id="features">
            <div class="cs-container">
              <div class="cs-section-header">
                <span class="cs-section-kicker">360° INTELLIGENCE ARCHITECTURE</span>
                <h2 class="cs-section-title">
                  Built for product marketers, deal desks, and founders.
                </h2>
                <p class="cs-section-desc">
                  CompSight pairs Google Search Grounding with an automatic snapshot diff engine and an on-demand AI Analyst.
                </p>
              </div>

              <div class="cs-grid-2col">
                <div class="cs-card">
                  <div class="cs-section-label" style="color: #34d399; margin-bottom: 10px;">
                    01 · GOOGLE SEARCH GROUNDING
                  </div>
                  <h3 style="margin: 0 0 10px 0; font-size: 1.2rem; font-weight: 700;">
                    360° Live Extraction in Plain English
                  </h3>
                  <p style="margin: 0; font-size: 0.92rem; color: var(--text-muted); line-height: 1.6;">
                    Enter any competitor name or URL. CompSight extracts an executive brief, threat score, strengths, user-backed weaknesses, counter-moves, pricing tiers, and verified source links.
                  </p>
                </div>

                <div class="cs-card">
                  <div class="cs-section-label" style="color: #fbbf24; margin-bottom: 10px;">
                    02 · AUTOMATIC SNAPSHOT DIFF ENGINE
                  </div>
                  <h3 style="margin: 0 0 10px 0; font-size: 1.2rem; font-weight: 700;">
                    Chronological Added, Modified &amp; Removed Logs
                  </h3>
                  <p style="margin: 0; font-size: 0.92rem; color: var(--text-muted); line-height: 1.6;">
                    Every scan saves a timestamped snapshot in local storage. Clicking Re-Scan automatically compares new pricing and features against the previous baseline.
                  </p>
                </div>

                <div class="cs-card">
                  <div class="cs-section-label" style="color: #34d399; margin-bottom: 10px;">
                    03 · INTERACTIVE AI ANALYST DRAWER
                  </div>
                  <h3 style="margin: 0 0 10px 0; font-size: 1.2rem; font-weight: 700;">
                    Ask CompSight AI with 1-Click Deal Prompts
                  </h3>
                  <p style="margin: 0; font-size: 0.92rem; color: var(--text-muted); line-height: 1.6;">
                    Open the non-intrusive AI Analyst drawer on any rival to generate pricing counter-wedges, customer complaint summaries, or 3-line sales objection responses.
                  </p>
                </div>

                <div class="cs-card">
                  <div class="cs-section-label" style="color: #f87171; margin-bottom: 10px;">
                    04 · INSTANT MARKDOWN BATTLECARDS
                  </div>
                  <h3 style="margin: 0 0 10px 0; font-size: 1.2rem; font-weight: 700;">
                    1-Click Export to Notion, Linear, or Slack
                  </h3>
                  <p style="margin: 0; font-size: 0.92rem; color: var(--text-muted); line-height: 1.6;">
                    Download any competitor dossier as a clean, structured Markdown (.md) battlecard ready to drop straight into your team wiki or CRM enablement playbooks.
                  </p>
                </div>
              </div>
            </div>
          </section>

          <!-- How It Works 3-Step Strip (#how-it-works) -->
          <section class="cs-section" id="how-it-works">
            <div class="cs-container">
              <div class="cs-section-header">
                <span class="cs-section-kicker">AUTOMATED TELEMETRY PIPELINE</span>
                <h2 class="cs-section-title">
                  From rival domain to actionable battlecard in three steps.
                </h2>
                <p class="cs-section-desc">
                  Zero manual spreadsheet upkeep. CompSight continuously monitors your competitors' public footprint and diffs every move.
                </p>
              </div>

              <div class="cs-steps-grid">
                <div class="cs-step-card">
                  <span class="cs-step-num">01. Drop a URL</span>
                  <h3 style="margin: 0; font-size: 1.2rem; font-weight: 700;">Enter Any Brand or Domain</h3>
                  <p style="margin: 0; font-size: 0.9rem; color: var(--text-muted); line-height: 1.6;">
                    Type a domain like linear.app or a brand name like Notion. CompSight normalizes the target and initiates live web search grounding.
                  </p>
                </div>

                <div class="cs-step-card">
                  <span class="cs-step-num">02. Automated Extraction</span>
                  <h3 style="margin: 0; font-size: 1.2rem; font-weight: 700;">360° Synthesis &amp; Grounding</h3>
                  <p style="margin: 0; font-size: 0.9rem; color: var(--text-muted); line-height: 1.6;">
                    Gemini synthesizes executive briefs, pricing tiers, G2/Reddit user complaints, and recent launches backed by clickable source citations.
                  </p>
                </div>

                <div class="cs-step-card">
                  <span class="cs-step-num">03. Track &amp; Act</span>
                  <h3 style="margin: 0; font-size: 1.2rem; font-weight: 700;">Re-Scan, Diff &amp; Export</h3>
                  <p style="margin: 0; font-size: 0.9rem; color: var(--text-muted); line-height: 1.6;">
                    Re-scan anytime to log Added, Modified, and Removed diffs, query the AI Analyst drawer for objection handling, and export .md battlecards.
                  </p>
                </div>
              </div>
            </div>
          </section>

          <!-- Pricing Section (#pricing) -->
          <section class="cs-section cs-ambient-glow-section" id="pricing">
            <div class="cs-container">
              <div class="cs-billing-toggle-wrap">
                <div>
                  <span class="cs-section-kicker">TRANSPARENT TERMINAL LICENSING</span>
                  <h2 class="cs-section-title" style="margin-bottom: 6px;">
                    Scale your competitive radar with your product team.
                  </h2>
                  <p class="cs-section-desc">
                    Start with 3 tracked competitors free forever, or unlock hourly polling and team battlecards.
                  </p>
                </div>

                <div class="cs-segmented-toggle" role="group" aria-label="Billing Frequency Toggle">
                  <button
                    type="button"
                    class="cs-toggle-option ${!this.isAnnualBilling ? 'active' : ''}"
                    id="billing-monthly-btn"
                  >
                    Monthly
                  </button>
                  <button
                    type="button"
                    class="cs-toggle-option ${this.isAnnualBilling ? 'active' : ''}"
                    id="billing-annual-btn"
                  >
                    Annual (Save 20%)
                  </button>
                </div>
              </div>

              <div class="cs-pricing-grid">
                ${PRICING_TIERS.map((tier) => {
                  const price = calculatePrice(
                    tier.monthlyPrice,
                    this.isAnnualBilling,
                  );
                  return `
                    <div class="cs-pricing-card ${tier.highlighted ? 'highlighted' : ''}">
                      <div>
                        <div style="display: flex; align-items: baseline; justify-content: space-between; gap: 12px; margin-bottom: 6px;">
                          <h3 style="margin: 0; font-size: 1.35rem; font-weight: 700;">${this.escapeHtml(tier.name)}</h3>
                          <span class="font-mono" style="font-size: 0.75rem; color: ${tier.highlighted ? '#34d399' : '#94a3b8'};">
                            ${tier.highlighted ? 'MOST POPULAR' : this.isAnnualBilling ? 'ANNUAL CADENCE' : 'MONTHLY CADENCE'}
                          </span>
                        </div>
                        <div style="font-size: 0.84rem; color: var(--text-muted); margin-bottom: 20px;">
                          ${this.escapeHtml(tier.audience)}
                        </div>

                        <div style="display: flex; align-items: baseline; gap: 6px; margin-bottom: 14px;">
                          <span class="cs-price-amount">${price === 0 ? 'Free' : `$${price}`}</span>
                          ${
                            price > 0
                              ? `<span class="font-mono" style="font-size: 0.8125rem; color: var(--text-muted);">/ workspace / mo</span>`
                              : `<span class="font-mono" style="font-size: 0.8125rem; color: var(--text-muted);">forever</span>`
                          }
                        </div>

                        <p style="margin: 0 0 20px 0; font-size: 0.875rem; color: var(--text-muted); line-height: 1.55;">
                          ${this.escapeHtml(tier.description)}
                        </p>

                        <div class="cs-spec-list">
                          ${tier.specs
                            .map(
                              (spec) => `
                                <div class="cs-spec-row">
                                  <span style="color: var(--text-muted);">${this.escapeHtml(spec.label)}</span>
                                  <span class="font-mono" style="font-weight: 600; color: var(--text-primary);">${this.escapeHtml(spec.value)}</span>
                                </div>
                              `,
                            )
                            .join('')}
                        </div>
                      </div>

                      <button
                        type="button"
                        class="${tier.highlighted ? 'cs-btn-primary' : 'cs-btn-secondary'} tier-launch-btn"
                        data-tier-id="${tier.id}"
                        style="width: 100%;"
                      >
                        ${this.escapeHtml(tier.ctaLabel)}
                      </button>
                    </div>
                  `;
                }).join('')}
              </div>
            </div>
          </section>

          <!-- Final CTA Banner -->
          <section class="cs-section">
            <div class="cs-container" style="text-align: center; max-width: 740px;">
              <span class="cs-section-kicker">READY FOR LIVE TELEMETRY</span>
              <h2 class="cs-section-title">
                Stop guessing what your competitors shipped last night.
              </h2>
              <p class="cs-section-desc" style="margin-bottom: 28px;">
                Launch the live CompSight Obsidian Terminal to inspect 360° battlecards, query the AI Analyst, and track real-time snapshot diffs.
              </p>
              <div style="display: flex; align-items: center; justify-content: center; gap: 14px; flex-wrap: wrap;">
                <button type="button" class="cs-btn-primary" id="final-cta-launch">
                  Launch CompSight
                </button>
                <button type="button" class="cs-btn-secondary" id="final-cta-xr">
                  Open 3D Spatial XR View
                </button>
              </div>
            </div>
          </section>
        </div>
      </main>

      <!-- Minimal 3-Column Footer -->
      <footer class="cs-footer">
        <div class="cs-container">
          <div class="cs-footer-grid">
            <div>
              <div style="display: flex; align-items: center; gap: 10px; font-weight: 700; font-size: 1.05rem; margin-bottom: 12px;">
                ${getCompSightLogoSvg(24)}
                <span>CompSight</span>
              </div>
              <p style="margin: 0 0 16px 0; font-size: 0.85rem; color: var(--text-muted); max-width: 340px; line-height: 1.6;">
                Obsidian competitive intelligence terminal for product, engineering, and GTM leaders.
              </p>
              <div class="font-mono" style="font-size: 0.75rem; color: var(--text-subtle);">
                © 2026 CompSight Intelligence Systems. All rights reserved.
              </div>
            </div>

            <div>
              <div class="cs-section-label" style="color: var(--text-primary); margin-bottom: 14px;">
                TERMINAL MODULES
              </div>
              <div style="display: flex; flex-direction: column; gap: 10px; font-size: 0.85rem; color: var(--text-muted);">
                <a href="#preview">Executive Overview &amp; Battlecards</a>
                <a href="#preview">Live News &amp; Market Pulse</a>
                <a href="#preview">Products &amp; Pricing Matrix</a>
                <a href="#preview">Automatic Diff Timeline</a>
              </div>
            </div>

            <div>
              <div class="cs-section-label" style="color: var(--text-primary); margin-bottom: 14px;">
                PLATFORM
              </div>
              <div style="display: flex; flex-direction: column; gap: 10px; font-size: 0.85rem; color: var(--text-muted);">
                <a href="#features">360° Search Grounding</a>
                <a href="#how-it-works">Automated Extraction Pipeline</a>
                <a href="#pricing">Workspace Licensing</a>
                <button type="button" id="footer-launch-btn" style="text-align: left; color: #34d399; font-weight: 600;">
                  Launch Live Terminal →
                </button>
              </div>
            </div>
          </div>
        </div>
      </footer>
    `;
  }

  /* =========================================================================
   * VIEW 2: SEPARATE TABBED TERMINAL VIEW (view === 'terminal')
   * ========================================================================= */
  private renderTerminalView(): string {
    const active = this.getActiveCompetitor();
    const kpis = calculateKpiMetrics(this.competitors);

    if (!active) {
      return `
        <div class="cs-terminal-layout">
          <aside class="cs-sidebar" aria-label="CompSight Terminal Sidebar">
            <div style="display: flex; flex-direction: column; gap: 22px;">
              <div style="display: flex; align-items: center; justify-content: space-between;">
                <div style="display: flex; align-items: center; gap: 10px; font-weight: 700; font-size: 1.05rem;">
                  ${getCompSightLogoSvg(26)}
                  <span>CompSight</span>
                </div>
                <span class="font-mono" style="font-size: 0.7rem; color: #34d399;">TERMINAL</span>
              </div>
              <button
                type="button"
                id="sidebar-back-home"
                class="cs-btn-secondary"
                style="width: 100%; justify-content: flex-start;"
              >
                ← Back to Home
              </button>
            </div>
            <div class="font-mono" style="font-size: 0.7rem; color: var(--text-subtle);">
              0 rivals · 0 snapshots stored
            </div>
          </aside>

          <div class="cs-main-viewport">
            <main class="cs-terminal-content">
              ${this.renderErrorBannerHtml()}
              <section class="cs-card" style="text-align: center; padding: 56px 24px;" data-testid="empty-competitors-state">
                <div class="cs-section-label" style="color: #34d399; margin-bottom: 10px;">
                  NO COMPETITORS TRACKED
                </div>
                <h2 style="margin: 0 0 12px 0; font-size: 1.5rem; font-weight: 700;">
                  Scan your first competitor domain
                </h2>
                <p style="margin: 0 auto 24px auto; max-width: 500px; font-size: 0.94rem; color: var(--text-muted); line-height: 1.6;">
                  Enter any competitor brand name or domain below to run a live 360° Google Search Grounding scan.
                </p>
                <form id="sidebar-scan-form" style="display: flex; gap: 10px; max-width: 480px; margin: 0 auto;" novalidate>
                  <label for="sidebar-url-input" style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0);">Scan new rival URL</label>
                  <input
                    id="sidebar-url-input"
                    type="text"
                    placeholder="linear.app or https://stripe.com"
                    aria-label="Scan new rival URL"
                    style="flex: 1; min-width: 0; height: 42px; padding: 0 14px; border-radius: 8px; background: #0b0d11; border: 1px solid var(--border-hairline); font-family: var(--font-mono); font-size: 0.85rem;"
                  />
                  <button type="submit" class="cs-btn-primary" ${this.isScanning ? 'disabled' : ''}>
                    ${this.isScanning ? 'Scanning...' : 'Scan Competitor'}
                  </button>
                </form>
                ${
                  this.sidebarScanError
                    ? `<div class="cs-form-error" role="alert" style="text-align:center;margin-top:10px;">${this.escapeHtml(this.sidebarScanError)}</div>`
                    : ''
                }
              </section>
            </main>
          </div>
        </div>
      `;
    }

    const threatBadgeColor =
      active.threatScore === 'HIGH'
        ? 'color: #f87171; background: rgba(239, 68, 68, 0.12); border: 1px solid rgba(239, 68, 68, 0.4);'
        : active.threatScore === 'LOW'
          ? 'color: #34d399; background: rgba(16, 185, 129, 0.12); border: 1px solid rgba(16, 185, 129, 0.4);'
          : 'color: #fbbf24; background: rgba(245, 158, 11, 0.12); border: 1px solid rgba(245, 158, 11, 0.4);';

    return `
      <div class="cs-terminal-layout">
        <!-- 1. LEFT SIDEBAR (#11141B, 1px #1E2430 right border) -->
        <aside class="cs-sidebar" aria-label="CompSight Terminal Sidebar">
          <div style="display: flex; flex-direction: column; gap: 22px;">
            <div style="display: flex; align-items: center; justify-content: space-between;">
              <div style="display: flex; align-items: center; gap: 10px; font-weight: 700; font-size: 1.05rem;">
                ${getCompSightLogoSvg(26)}
                <span>CompSight</span>
              </div>
              <span class="font-mono" style="font-size: 0.7rem; color: #34d399;">TERMINAL</span>
            </div>

            <button
              type="button"
              id="sidebar-back-home"
              class="cs-btn-secondary"
              style="width: 100%; justify-content: flex-start;"
            >
              ← Back to Home
            </button>

            <!-- Quick-Scan URL/Name Input in Sidebar -->
            <form id="sidebar-scan-form" style="display: flex; flex-direction: column; gap: 8px;" novalidate>
              <label for="sidebar-url-input" class="cs-section-label">
                ADD COMPETITOR
              </label>
              <div style="display: flex; gap: 6px;">
                <input
                  id="sidebar-url-input"
                  type="text"
                  placeholder="linear.app or Notion"
                  aria-label="Scan new rival URL"
                  style="flex: 1; min-width: 0; height: 38px; padding: 0 10px; border-radius: 6px; background: #0b0d11; border: 1px solid var(--border-hairline); font-family: var(--font-mono); font-size: 0.78rem;"
                />
                <button type="submit" class="cs-btn-primary" style="padding: 0 12px; min-height: 38px; font-size: 0.78rem;" ${this.isScanning ? 'disabled' : ''}>
                  ${this.isScanning ? '...' : 'Scan'}
                </button>
              </div>
              ${
                this.sidebarScanError
                  ? `<div class="cs-form-error" role="alert">${this.escapeHtml(this.sidebarScanError)}</div>`
                  : ''
              }
            </form>

            <!-- Scrollable List of Tracked Competitors -->
            <div style="display: flex; flex-direction: column; gap: 10px;">
              <div class="cs-section-label" style="display: flex; justify-content: space-between;">
                <span>TRACKED COMPETITORS</span>
                <span>${this.competitors.length}</span>
              </div>
              <div class="cs-rival-list" role="listbox" aria-label="Tracked Competitors">
                ${this.competitors
                  .map(
                    (comp) => `
                      <button
                        type="button"
                        class="cs-rival-item ${comp.id === active.id ? 'active' : ''}"
                        data-select-competitor="${comp.id}"
                      >
                        <div style="min-width: 0;">
                          <div style="font-weight: 600; font-size: 0.875rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                            ${this.escapeHtml(comp.name)}
                          </div>
                          <div class="font-mono" style="font-size: 0.72rem; color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                            ${this.escapeHtml(comp.domain)}
                          </div>
                        </div>
                        <div style="display: flex; align-items: center; gap: 8px; flex-shrink: 0;">
                          <span class="font-mono" style="font-size: 0.7rem; color: var(--text-muted);">
                            ${comp.snapshotsCount}s
                          </span>
                          <span class="cs-threat-dot ${comp.threatScore}" title="Threat: ${comp.threatScore}"></span>
                        </div>
                      </button>
                    `,
                  )
                  .join('')}
              </div>
            </div>
          </div>

          <div style="border-top: 1px solid var(--border-hairline); padding-top: 14px; display: flex; flex-direction: column; gap: 10px;">
            <button
              type="button"
              id="sidebar-enter-xr"
              class="cs-btn-secondary"
              style="width: 100%;"
            >
              3D Spatial XR View
            </button>
            <div class="font-mono" style="font-size: 0.7rem; color: var(--text-subtle);">
              ${kpis.trackedCount} rivals · ${kpis.snapshotsCount} snapshots stored
            </div>
          </div>
        </aside>

        <!-- 2. MAIN WORKSPACE VIEWPORT -->
        <div class="cs-main-viewport">
          <!-- Competitor Header -->
          <header class="cs-terminal-header">
            <div style="display: flex; flex-direction: column; gap: 6px;">
              <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap;">
                <h1 style="margin: 0; font-size: 1.5rem; font-weight: 800; letter-spacing: -0.02em;">
                  ${this.escapeHtml(active.name)}
                </h1>
                <a
                  href="${this.escapeHtml(active.url)}"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="font-mono"
                  style="font-size: 0.8125rem; color: #34d399; text-decoration: underline;"
                >
                  ${this.escapeHtml(active.domain)} ↗
                </a>
                <span class="font-mono" style="font-size: 0.72rem; font-weight: 700; padding: 3px 10px; border-radius: 6px; ${threatBadgeColor}">
                  THREAT: ${active.threatScore}
                </span>
              </div>
              <div class="font-mono" style="font-size: 0.75rem; color: var(--text-muted);">
                Last scanned: ${this.escapeHtml(active.lastScannedAt)} · ${active.snapshotsCount} snapshot${active.snapshotsCount === 1 ? '' : 's'} saved
              </div>
            </div>

            <!-- Action Buttons Grouped on the Right -->
            <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
              <button
                type="button"
                id="terminal-ask-ai-btn"
                class="cs-btn-emerald-soft"
              >
                Ask AI
              </button>
              <button
                type="button"
                id="terminal-rescan-btn"
                class="cs-btn-primary"
                ${this.isScanning ? 'disabled' : ''}
              >
                ${this.isScanning ? 'Re-Scanning...' : 'Re-Scan'}
              </button>
              <button
                type="button"
                id="terminal-export-md-btn"
                class="cs-btn-secondary"
              >
                Export .md
              </button>
              <button
                type="button"
                id="terminal-delete-btn"
                class="cs-btn-danger-soft"
                aria-label="Delete ${this.escapeHtml(active.name)}"
              >
                Delete
              </button>
            </div>
          </header>

          <!-- 3. 5 CLEAN, MUTUALLY EXCLUSIVE FEATURE TABS -->
          <div class="cs-tabbar" role="tablist" aria-label="Competitor Intelligence Feature Tabs">
            <button
              type="button"
              role="tab"
              aria-selected="${this.terminalTab === 'overview'}"
              class="cs-tab-item ${this.terminalTab === 'overview' ? 'active' : ''}"
              data-terminal-tab="overview"
            >
              Overview
            </button>
            <button
              type="button"
              role="tab"
              aria-selected="${this.terminalTab === 'news'}"
              class="cs-tab-item ${this.terminalTab === 'news' ? 'active' : ''}"
              data-terminal-tab="news"
            >
              News &amp; Intel
            </button>
            <button
              type="button"
              role="tab"
              aria-selected="${this.terminalTab === 'products'}"
              class="cs-tab-item ${this.terminalTab === 'products' ? 'active' : ''}"
              data-terminal-tab="products"
            >
              Products &amp; Pricing
            </button>
            <button
              type="button"
              role="tab"
              aria-selected="${this.terminalTab === 'timeline'}"
              class="cs-tab-item ${this.terminalTab === 'timeline' ? 'active' : ''}"
              data-terminal-tab="timeline"
            >
              Diff Timeline (${active.diffHistory.length})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected="${this.terminalTab === 'evidence'}"
              class="cs-tab-item ${this.terminalTab === 'evidence' ? 'active' : ''}"
              data-terminal-tab="evidence"
            >
              Evidence (${active.evidence.length})
            </button>
          </div>

          <!-- Active Tab Content (Generous p-6 / space-y-6, max 2 columns per row) -->
          <main class="cs-terminal-content">
            ${this.renderErrorBannerHtml()}
            ${this.renderActiveTabPanel(active, this.terminalTab)}
          </main>
        </div>
      </div>

      ${this.isAiDrawerOpen ? this.renderAiAnalystDrawer(active) : ''}
    `;
  }

  /* =========================================================================
   * 5 FOCUSED, ULTRA-CLEAN TAB PANELS (Zero Nested Cards-Inside-Cards)
   * ========================================================================= */
  private renderActiveTabPanel(
    active: Competitor,
    tab: TerminalTab | ShowcaseTab,
  ): string {
    if (tab === 'overview') return this.renderOverviewTab(active);
    if (tab === 'news') return this.renderNewsAndIntelTab(active);
    if (tab === 'products') return this.renderProductsAndPricingTab(active);
    if (tab === 'timeline') return this.renderDiffTimelineTab(active);
    return this.renderEvidenceTab(active);
  }

  /**
   * TAB 1: OVERVIEW
   * Executive Brief + Threat Score Reason + 2-Column Strengths vs Weaknesses + How to Win + Customer Pulse
   */
  private renderOverviewTab(active: Competitor): string {
    const threatColor =
      active.threatScore === 'HIGH'
        ? '#f87171'
        : active.threatScore === 'LOW'
          ? '#34d399'
          : '#fbbf24';

    const strengths =
      active.strengths.length > 0
        ? active.strengths
        : ['Not publicly disclosed'];
    const weaknesses =
      active.weaknesses.length > 0
        ? active.weaknesses
        : ['Not publicly disclosed'];
    const howToWin =
      active.howToWin.length > 0
        ? active.howToWin
        : ['Not publicly disclosed'];
    const usersLove =
      active.customerPulse.usersLove.length > 0
        ? active.customerPulse.usersLove
        : ['Not publicly disclosed'];
    const usersComplain =
      active.customerPulse.usersComplain.length > 0
        ? active.customerPulse.usersComplain
        : ['Not publicly disclosed'];

    return `
      <div class="cs-stack-6">
        <!-- Row 1: Executive Brief & Threat Assessment (2 Columns) -->
        <div class="cs-grid-2col">
          <section class="cs-card">
            <div class="cs-section-label" style="margin-bottom: 10px;">
              EXECUTIVE BRIEF
            </div>
            <p style="margin: 0; font-size: 0.96rem; line-height: 1.65; color: var(--text-primary);">
              ${this.escapeHtml(active.executiveBrief || 'Not publicly disclosed')}
            </p>
          </section>

          <section class="cs-card">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px;">
              <span class="cs-section-label">THREAT ASSESSMENT</span>
              <span class="font-mono" style="font-size: 0.8rem; font-weight: 700; color: ${threatColor};">
                ${active.threatScore} THREAT
              </span>
            </div>
            <p style="margin: 0 0 14px 0; font-size: 0.94rem; line-height: 1.6; color: var(--text-primary);">
              ${this.escapeHtml(active.threatReason || 'Not publicly disclosed')}
            </p>
            <div class="font-mono" style="font-size: 0.76rem; color: var(--text-muted); padding-top: 12px; border-top: 1px solid var(--border-hairline);">
              Market Pulse: ${this.escapeHtml(active.customerPulse.fundingAndGrowth || 'Not publicly disclosed')}
            </div>
          </section>
        </div>

        <!-- Row 2: 2-Column AI Battlecard (Strengths vs Weaknesses) -->
        <div class="cs-grid-2col">
          <section class="cs-card" style="border-color: rgba(16, 185, 129, 0.35);">
            <div class="cs-section-label" style="color: #34d399; margin-bottom: 14px;">
              STRENGTHS · DETECTED ADVANTAGES
            </div>
            <ul class="cs-clean-list">
              ${strengths
                .map(
                  (s) => `
                    <li>
                      <span class="cs-bullet emerald" aria-hidden="true">+</span>
                      <span>${this.escapeHtml(s)}</span>
                    </li>
                  `,
                )
                .join('')}
            </ul>
          </section>

          <section class="cs-card" style="border-color: rgba(239, 68, 68, 0.35);">
            <div class="cs-section-label" style="color: #f87171; margin-bottom: 14px;">
              WEAKNESSES · BACKED BY USER COMPLAINTS
            </div>
            <ul class="cs-clean-list">
              ${weaknesses
                .map(
                  (w) => `
                    <li>
                      <span class="cs-bullet crimson" aria-hidden="true">−</span>
                      <span>${this.escapeHtml(w)}</span>
                    </li>
                  `,
                )
                .join('')}
            </ul>
          </section>
        </div>

        <!-- Row 3: How to Win (Actionable Counter-Moves) -->
        <section class="cs-card">
          <div class="cs-section-label" style="color: #34d399; margin-bottom: 14px;">
            HOW TO WIN · ACTIONABLE COUNTER-MOVES
          </div>
          <div class="cs-divider-list">
            ${howToWin
              .map(
                (move, idx) => `
                  <div class="cs-divider-row" style="display: flex; align-items: flex-start; gap: 14px;">
                    <span class="font-mono" style="font-size: 0.78rem; font-weight: 700; color: #34d399; flex-shrink: 0; margin-top: 2px;">
                      0${idx + 1}
                    </span>
                    <div style="font-size: 0.92rem; color: var(--text-primary); line-height: 1.5;">
                      ${this.escapeHtml(move)}
                    </div>
                  </div>
                `,
              )
              .join('')}
          </div>
        </section>

        <!-- Row 4: Market & Customer Pulse (2-Column What Users Love vs Complain About) -->
        <div class="cs-grid-2col">
          <section class="cs-card">
            <div class="cs-section-label" style="margin-bottom: 14px;">
              CUSTOMER PULSE · TOP 3 THINGS USERS LOVE
            </div>
            <ul class="cs-clean-list">
              ${usersLove
                .map(
                  (item) => `
                    <li>
                      <span class="cs-bullet emerald" aria-hidden="true">✓</span>
                      <span>${this.escapeHtml(item)}</span>
                    </li>
                  `,
                )
                .join('')}
            </ul>
          </section>

          <section class="cs-card">
            <div class="cs-section-label" style="margin-bottom: 14px;">
              CUSTOMER PULSE · TOP 3 USER COMPLAINTS (G2 / REDDIT / X)
            </div>
            <ul class="cs-clean-list">
              ${usersComplain
                .map(
                  (item) => `
                    <li>
                      <span class="cs-bullet amber" aria-hidden="true">!</span>
                      <span>${this.escapeHtml(item)}</span>
                    </li>
                  `,
                )
                .join('')}
            </ul>
          </section>
        </div>
      </div>
    `;
  }

  /**
   * TAB 2: NEWS & INTEL
   * Funding/Market Signals Strip + Vertical News Feed with working Date Filter (30 Days | 90 Days | All Time)
   */
  private renderNewsAndIntelTab(active: Competitor): string {
    const filteredNews = filterNewsByDateRange(
      active.newsAndLaunches,
      this.newsDateFilter,
    );

    return `
      <div class="cs-stack-6">
        <!-- Funding & Market Signals Strip -->
        <section class="cs-card" style="display: flex; align-items: center; justify-content: space-between; gap: 20px; flex-wrap: wrap;">
          <div>
            <div class="cs-section-label" style="color: #34d399; margin-bottom: 6px;">
              FUNDING &amp; GROWTH SNAPSHOT
            </div>
            <div style="font-size: 0.95rem; color: var(--text-primary);">
              ${this.escapeHtml(active.customerPulse.fundingAndGrowth || 'Not publicly disclosed')}
            </div>
          </div>

          <!-- Working Date Filter: 30 Days | 90 Days | All Time -->
          <div class="cs-segmented-toggle" role="group" aria-label="News Date Filter">
            <button
              type="button"
              class="cs-toggle-option ${this.newsDateFilter === '30d' ? 'active' : ''}"
              data-news-filter="30d"
            >
              30 Days
            </button>
            <button
              type="button"
              class="cs-toggle-option ${this.newsDateFilter === '90d' ? 'active' : ''}"
              data-news-filter="90d"
            >
              90 Days
            </button>
            <button
              type="button"
              class="cs-toggle-option ${this.newsDateFilter === 'all' ? 'active' : ''}"
              data-news-filter="all"
            >
              All Time
            </button>
          </div>
        </section>

        <!-- Clean Vertical News Feed -->
        <section class="cs-card">
          <div class="cs-section-label" style="margin-bottom: 16px;">
            LIVE NEWS, PRODUCT LAUNCHES &amp; COMMUNITY SIGNALS (${filteredNews.length})
          </div>

          ${
            filteredNews.length === 0
              ? `
                <div style="padding: 24px 0; color: var(--text-muted); font-size: 0.9rem;">
                  No verified news items found within this date window. Switch the date filter to <strong>All Time</strong> to view all verified milestones.
                </div>
              `
              : `
                <div class="cs-divider-list">
                  ${filteredNews
                    .map((item) => {
                      const sentColor =
                        item.sentiment === 'positive'
                          ? '#34d399'
                          : item.sentiment === 'negative'
                            ? '#f87171'
                            : '#fbbf24';
                      return `
                        <div class="cs-divider-row" style="display: flex; flex-direction: column; gap: 6px;">
                          <div style="display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap;">
                            <div class="font-mono" style="font-size: 0.75rem; color: var(--text-muted);">
                              <span>${this.escapeHtml(item.date)}</span>
                              <span> · </span>
                              <span style="color: var(--text-primary);">${this.escapeHtml(item.sourceName)}</span>
                              <span> · </span>
                              <span style="color: ${sentColor}; text-transform: uppercase;">${this.escapeHtml(item.sentiment)}</span>
                            </div>
                            <a
                              href="${this.escapeHtml(item.url)}"
                              target="_blank"
                              rel="noopener noreferrer"
                              class="font-mono"
                              style="font-size: 0.75rem; color: #34d399; text-decoration: underline;"
                            >
                              Verify Source ↗
                            </a>
                          </div>
                          <h3 style="margin: 0; font-size: 1.02rem; font-weight: 700;">
                            ${this.escapeHtml(item.title)}
                          </h3>
                          <p style="margin: 0; font-size: 0.88rem; color: var(--text-muted); line-height: 1.55;">
                            ${this.escapeHtml(item.summary)}
                          </p>
                        </div>
                      `;
                    })
                    .join('')}
                </div>
              `
          }
        </section>
      </div>
    `;
  }

  /**
   * TAB 3: PRODUCTS & PRICING
   * Clean, breathable 2-column grid of products, standout features, and pricing tiers
   */
  private renderProductsAndPricingTab(active: Competitor): string {
    if (active.productsAndPricing.length === 0) {
      return `
        <section class="cs-card" style="text-align: center; padding: 40px 24px;">
          <div class="cs-section-label" style="margin-bottom: 8px;">PRODUCTS &amp; PRICING</div>
          <p style="margin: 0; color: var(--text-muted);">Pricing tiers are not publicly disclosed for ${this.escapeHtml(active.name)}.</p>
        </section>
      `;
    }

    return `
      <div class="cs-stack-6">
        <div class="cs-grid-2col">
          ${active.productsAndPricing
            .map(
              (tier) => `
                <section class="cs-card" style="display: flex; flex-direction: column; justify-content: space-between; gap: 16px;">
                  <div>
                    <div style="display: flex; align-items: baseline; justify-content: space-between; gap: 12px; margin-bottom: 6px;">
                      <h3 style="margin: 0; font-size: 1.15rem; font-weight: 700;">
                        ${this.escapeHtml(tier.name)}
                      </h3>
                      <span class="font-mono" style="font-size: 1.15rem; font-weight: 700; color: #34d399;">
                        ${this.escapeHtml(tier.price)}
                      </span>
                    </div>
                    <div class="font-mono" style="font-size: 0.75rem; color: var(--text-muted); margin-bottom: 12px;">
                      ${this.escapeHtml(tier.billingCadence)} · Target: ${this.escapeHtml(tier.targetAudience)}
                    </div>
                    <div style="border-top: 1px solid var(--border-hairline); padding-top: 12px;">
                      <div class="cs-section-label" style="margin-bottom: 10px;">
                        STANDOUT FEATURES
                      </div>
                      <ul class="cs-clean-list">
                        ${(tier.standoutFeatures.length > 0
                          ? tier.standoutFeatures
                          : ['Not publicly disclosed']
                        )
                          .map(
                            (feat) => `
                              <li>
                                <span class="cs-bullet emerald" aria-hidden="true">•</span>
                                <span>${this.escapeHtml(feat)}</span>
                              </li>
                            `,
                          )
                          .join('')}
                      </ul>
                    </div>
                  </div>
                </section>
              `,
            )
            .join('')}
        </div>
      </div>
    `;
  }

  /**
   * TAB 4: DIFF TIMELINE
   * Chronological snapshot change log (Emerald = Added, Amber = Modified, Crimson = Removed)
   * with a friendly empty state prompting a Re-Scan when no diffs have been recorded yet.
   */
  private renderDiffTimelineTab(active: Competitor): string {
    if (active.diffHistory.length === 0) {
      return `
        <section class="cs-card" style="text-align: center; padding: 48px 24px;">
          <div class="cs-section-label" style="color: #34d399; margin-bottom: 8px;">
            SNAPSHOT BASELINE LOCKED (${active.snapshotsCount} SNAPSHOT${active.snapshotsCount === 1 ? '' : 'S'})
          </div>
          <h3 style="margin: 0 0 10px 0; font-size: 1.25rem; font-weight: 700;">
            ${active.snapshotsCount <= 1 ? 'Ready to compare future moves against Snapshot #1' : 'No structural diffs detected across captured snapshots'}
          </h3>
          <p style="margin: 0 auto 22px auto; max-width: 520px; font-size: 0.92rem; color: var(--text-muted); line-height: 1.6;">
            Click <strong>Re-Scan</strong> to run a fresh live Google Search Grounding scan and automatically log Added, Modified, and Removed changes.
          </p>
          <button
            type="button"
            class="cs-btn-primary"
            data-trigger-rescan="${active.id}"
            ${this.isScanning ? 'disabled' : ''}
          >
            ${this.isScanning ? 'Re-Scanning...' : 'Re-Scan to Compare Snapshots'}
          </button>
        </section>
      `;
    }

    return `
      <div class="cs-stack-6">
        <section class="cs-card">
          <div style="display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-bottom: 18px;">
            <div>
              <div class="cs-section-label" style="color: #34d399;">
                CHRONOLOGICAL SNAPSHOT DIFF LOG (${active.snapshotsCount} SNAPSHOTS)
              </div>
              <div style="font-size: 0.85rem; color: var(--text-muted); margin-top: 4px;">
                Automatic comparison across timestamped snapshots: Emerald = Added, Amber = Modified, Crimson = Removed.
              </div>
            </div>
            <button
              type="button"
              class="cs-btn-secondary"
              data-trigger-rescan="${active.id}"
              ${this.isScanning ? 'disabled' : ''}
            >
              ${this.isScanning ? 'Re-Scanning...' : 'Run New Re-Scan'}
            </button>
          </div>

          <div class="cs-divider-list">
            ${active.diffHistory
              .map((diff) => {
                const badgeColor =
                  diff.status === 'added'
                    ? '#34d399'
                    : diff.status === 'modified'
                      ? '#fbbf24'
                      : '#f87171';
                const statusLabel =
                  diff.status === 'added'
                    ? 'ADDED'
                    : diff.status === 'modified'
                      ? 'MODIFIED'
                      : 'REMOVED';
                return `
                  <div class="cs-divider-row" style="display: flex; flex-direction: column; gap: 6px;">
                    <div style="display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap;">
                      <div class="font-mono" style="font-size: 0.76rem; font-weight: 700; color: ${badgeColor};">
                        [${statusLabel}] ${this.escapeHtml(diff.category)} · ${this.escapeHtml(diff.snapshotFromLabel)} → ${this.escapeHtml(diff.snapshotToLabel)}
                      </div>
                      <div class="font-mono" style="font-size: 0.74rem; color: var(--text-muted);">
                        ${this.escapeHtml(diff.capturedAtLabel)}
                      </div>
                    </div>
                    <h4 style="margin: 0; font-size: 0.98rem; font-weight: 700;">
                      ${this.escapeHtml(diff.title)}
                    </h4>
                    <p style="margin: 0; font-size: 0.88rem; color: var(--text-muted); line-height: 1.55;">
                      ${this.escapeHtml(diff.summary)}
                    </p>
                  </div>
                `;
              })
              .join('')}
          </div>
        </section>
      </div>
    `;
  }

  /**
   * TAB 5: EVIDENCE
   * Clean list of verified clickable source URLs and short snippets backing up the data
   */
  private renderEvidenceTab(active: Competitor): string {
    const filtered = filterEvidence(
      active.evidence,
      this.evidenceCategory,
      this.evidenceQuery,
    );

    return `
      <div class="cs-stack-6">
        <div style="display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap;">
          <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
            ${['All', 'Website', 'Pricing', 'Reviews', 'News', 'Docs']
              .map(
                (cat) => `
                  <button
                    type="button"
                    class="cs-tab-btn ${this.evidenceCategory === cat ? 'active' : ''}"
                    data-evidence-cat="${cat}"
                  >
                    ${cat}
                  </button>
                `,
              )
              .join('')}
          </div>

          <div style="min-width: 260px;">
            <label for="evidence-search-input" style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0);">Filter verified sources</label>
            <input
              id="evidence-search-input"
              type="search"
              value="${this.escapeHtml(this.evidenceQuery)}"
              placeholder="Search verified sources & snippets..."
              aria-label="Search verified sources"
              style="width: 100%; height: 38px; padding: 0 12px; border-radius: 8px; background: var(--bg-surface); border: 1px solid var(--border-hairline); font-size: 0.8125rem; font-family: var(--font-mono);"
            />
          </div>
        </div>

        <section class="cs-card">
          <div class="cs-section-label" style="margin-bottom: 16px;">
            VERIFIED GROUNDING SOURCES &amp; CITATIONS (${filtered.length})
          </div>
          ${
            filtered.length === 0
              ? `
                <div style="padding: 20px 0; color: var(--text-muted); font-size: 0.9rem;">
                  No verified evidence matches the current filter.
                </div>
              `
              : `
                <div class="cs-divider-list">
                  ${filtered
                    .map(
                      (ev) => `
                        <div class="cs-divider-row" style="display: flex; flex-direction: column; gap: 6px;">
                          <div style="display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap;">
                            <span class="font-mono" style="font-size: 0.74rem; color: #34d399;">
                              ${this.escapeHtml(ev.category.toUpperCase())} · ${this.escapeHtml(ev.sourceName)}
                            </span>
                            <a
                              href="${this.escapeHtml(ev.url)}"
                              target="_blank"
                              rel="noopener noreferrer"
                              class="font-mono"
                              style="font-size: 0.76rem; color: #34d399; text-decoration: underline;"
                            >
                              ${this.escapeHtml(ev.url)} ↗
                            </a>
                          </div>
                          <h4 style="margin: 0; font-size: 0.96rem; font-weight: 700;">
                            ${this.escapeHtml(ev.title)}
                          </h4>
                          <p style="margin: 0; font-size: 0.86rem; color: var(--text-muted); line-height: 1.55;">
                            "${this.escapeHtml(ev.snippet)}"
                          </p>
                        </div>
                      `,
                    )
                    .join('')}
                </div>
              `
          }
        </section>
      </div>
    `;
  }

  /* =========================================================================
   * INTERACTIVE AI ANALYST DRAWER ("ASK COMPSIGHT AI")
   * ========================================================================= */
  private renderAiAnalystDrawer(active: Competitor): string {
    const messages = active.chatHistory || [];

    return `
      <div class="cs-drawer-backdrop" id="ai-drawer-backdrop"></div>
      <aside class="cs-ai-drawer" aria-label="Ask CompSight AI Analyst Drawer">
        <div class="cs-ai-drawer-header">
          <div>
            <div class="cs-section-label" style="color: #34d399;">
              ASK COMPSIGHT AI
            </div>
            <div style="font-weight: 700; font-size: 1rem;">
              ${this.escapeHtml(active.name)} Deal &amp; Product Analyst
            </div>
          </div>
          <button
            type="button"
            id="ai-drawer-close-btn"
            class="cs-btn-secondary"
            style="padding: 6px 12px; min-height: 34px;"
            aria-label="Close AI Analyst Drawer"
          >
            Close
          </button>
        </div>

        <!-- 1-Click Quick Prompts -->
        <div class="cs-ai-drawer-prompts">
          <div class="cs-section-label">1-CLICK QUICK PROMPTS</div>
          ${QUICK_PROMPTS.map(
            (prompt) => `
              <button
                type="button"
                class="cs-quick-prompt-btn"
                data-quick-prompt="${this.escapeHtml(prompt)}"
                ${this.isAiThinking ? 'disabled' : ''}
              >
                "${this.escapeHtml(prompt)}"
              </button>
            `,
          ).join('')}
        </div>

        <!-- Conversational Q&A Messages -->
        <div class="cs-ai-drawer-messages" id="ai-drawer-messages">
          ${
            messages.length === 0
              ? `
                <div class="cs-chat-msg assistant">
                  Ready to analyze <strong>${this.escapeHtml(active.name)}</strong> (${this.escapeHtml(active.domain)}). Click a quick prompt above or ask any question about pricing, objections, or feature gaps.
                </div>
              `
              : messages
                  .map(
                    (m) => `
                      <div class="cs-chat-msg ${m.role}">
                        ${this.formatMarkdownBullets(m.content)}
                      </div>
                    `,
                  )
                  .join('')
          }
          ${
            this.isAiThinking
              ? `<div class="cs-chat-msg assistant font-mono" style="color: #34d399;">Querying CompSight AI (gemini-2.5-flash)...</div>`
              : ''
          }
          ${
            this.aiErrorBanner
              ? `
                <div class="cs-error-banner" role="alert" data-testid="ai-error-banner">
                  <div style="display: flex; flex-direction: column; gap: 4px; min-width: 0;">
                    <div class="font-mono" style="font-size: 0.72rem; font-weight: 700; color: #f87171;">
                      AI ANALYST ERROR
                    </div>
                    <div style="font-size: 0.82rem; color: #fecaca;">
                      ${this.escapeHtml(this.aiErrorBanner.message)}
                    </div>
                  </div>
                  <button
                    type="button"
                    id="btn-retry-ai-ask"
                    class="cs-btn-primary"
                    style="min-height: 32px; padding: 4px 12px; font-size: 0.78rem;"
                    ${this.isAiThinking ? 'disabled' : ''}
                  >
                    Retry
                  </button>
                </div>
              `
              : ''
          }
        </div>

        <!-- Follow-Up Input Form -->
        <form class="cs-ai-drawer-footer" id="ai-drawer-form" novalidate>
          <label for="ai-drawer-input" style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0);">Ask a question about ${this.escapeHtml(active.name)}</label>
          <input
            id="ai-drawer-input"
            type="text"
            placeholder="Ask about ${this.escapeHtml(active.name)}..."
            aria-label="Ask CompSight AI a question"
            autocomplete="off"
            style="flex: 1; min-width: 0; height: 40px; padding: 0 12px; border-radius: 8px; background: var(--bg-surface); border: 1px solid var(--border-hairline); font-size: 0.85rem;"
          />
          <button
            type="submit"
            class="cs-btn-primary"
            style="padding: 0 16px;"
            ${this.isAiThinking ? 'disabled' : ''}
          >
            Send
          </button>
        </form>
      </aside>
    `;
  }

  /* =========================================================================
   * EVENT BINDINGS
   * ========================================================================= */
  private bindLandingEvents(): void {
    const heroSection = document.getElementById('hero-flashlight-section');
    if (heroSection) {
      heroSection.addEventListener('mousemove', (e: MouseEvent) => {
        const rect = heroSection.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        heroSection.style.setProperty('--x', `${x}px`);
        heroSection.style.setProperty('--y', `${y}px`);
      });
    }

    const goTerminal = () => this.switchView('terminal');

    document
      .getElementById('nav-launch-terminal')
      ?.addEventListener('click', goTerminal);
    document
      .getElementById('hero-launch-terminal')
      ?.addEventListener('click', goTerminal);
    document
      .getElementById('final-cta-launch')
      ?.addEventListener('click', goTerminal);
    document
      .getElementById('footer-launch-btn')
      ?.addEventListener('click', goTerminal);

    document.querySelectorAll('.tier-launch-btn').forEach((btn) => {
      btn.addEventListener('click', goTerminal);
    });

    document.getElementById('final-cta-xr')?.addEventListener('click', () => {
      this.xrActive = true;
      this.onToggleXR?.(true);
      this.render();
    });

    const quickForm = document.getElementById(
      'hero-quickscan-form',
    ) as HTMLFormElement | null;
    const quickInput = document.getElementById(
      'hero-url-input',
    ) as HTMLInputElement | null;
    quickForm?.addEventListener('submit', (e) => {
      e.preventDefault();
      void this.handleScanSubmit(quickInput?.value || '', 'hero');
    });

    document.querySelectorAll('[data-preset-url]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const presetUrl = btn.getAttribute('data-preset-url') || '';
        if (quickInput) quickInput.value = presetUrl;
        void this.handleScanSubmit(presetUrl, 'hero');
      });
    });

    document.querySelectorAll('[data-showcase-tab]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const tab = btn.getAttribute('data-showcase-tab') as ShowcaseTab;
        if (tab) {
          this.showcaseTab = tab;
          this.render();
        }
      });
    });

    document
      .getElementById('billing-monthly-btn')
      ?.addEventListener('click', () => {
        this.isAnnualBilling = false;
        this.render();
      });
    document
      .getElementById('billing-annual-btn')
      ?.addEventListener('click', () => {
        this.isAnnualBilling = true;
        this.render();
      });

    this.bindSharedTabEvents();
  }

  private bindTerminalEvents(): void {
    document
      .getElementById('sidebar-back-home')
      ?.addEventListener('click', () => {
        this.isAiDrawerOpen = false;
        this.switchView('landing');
      });

    document
      .getElementById('sidebar-enter-xr')
      ?.addEventListener('click', () => {
        this.xrActive = true;
        this.onToggleXR?.(true);
        this.render();
      });

    const sidebarForm = document.getElementById(
      'sidebar-scan-form',
    ) as HTMLFormElement | null;
    const sidebarInput = document.getElementById(
      'sidebar-url-input',
    ) as HTMLInputElement | null;
    sidebarForm?.addEventListener('submit', (e) => {
      e.preventDefault();
      void this.handleScanSubmit(sidebarInput?.value || '', 'sidebar');
    });

    // Error Banner Retry & Dismiss
    document
      .getElementById('btn-retry-scan')
      ?.addEventListener('click', () => {
        if (this.apiErrorBanner) {
          const { retryInput, retrySource, retryCompetitor } =
            this.apiErrorBanner;
          void this.handleScanSubmit(retryInput, retrySource, retryCompetitor);
        }
      });

    document
      .getElementById('btn-dismiss-scan-error')
      ?.addEventListener('click', () => {
        this.apiErrorBanner = null;
        this.render();
      });

    // Header Actions: Ask AI, Re-Scan, Export .md, Delete
    document
      .getElementById('terminal-ask-ai-btn')
      ?.addEventListener('click', () => {
        this.isAiDrawerOpen = !this.isAiDrawerOpen;
        this.render();
      });

    document
      .getElementById('terminal-rescan-btn')
      ?.addEventListener('click', () => {
        const active = this.getActiveCompetitor();
        if (active) {
          void this.handleScanSubmit(active.url, 'rescan', active);
        }
      });

    document
      .getElementById('terminal-export-md-btn')
      ?.addEventListener('click', () => {
        const active = this.getActiveCompetitor();
        if (active) {
          downloadBattlecardMarkdown(active);
          this.showToast(`Exported ${active.id}-battlecard.md`);
        }
      });

    document
      .getElementById('terminal-delete-btn')
      ?.addEventListener('click', () => {
        this.handleDeleteActiveCompetitor();
      });

    // 5 Feature Tabs
    document.querySelectorAll('[data-terminal-tab]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const tab = btn.getAttribute('data-terminal-tab') as TerminalTab;
        if (tab) {
          this.terminalTab = tab;
          this.render();
        }
      });
    });

    // AI Analyst Drawer Events
    document
      .getElementById('ai-drawer-close-btn')
      ?.addEventListener('click', () => {
        this.isAiDrawerOpen = false;
        this.render();
      });
    document
      .getElementById('ai-drawer-backdrop')
      ?.addEventListener('click', () => {
        this.isAiDrawerOpen = false;
        this.render();
      });

    document
      .getElementById('btn-retry-ai-ask')
      ?.addEventListener('click', () => {
        if (this.aiErrorBanner?.retryQuestion) {
          void this.handleAskAnalyst(this.aiErrorBanner.retryQuestion);
        }
      });

    document.querySelectorAll('[data-quick-prompt]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const prompt = btn.getAttribute('data-quick-prompt') || '';
        if (prompt) {
          void this.handleAskAnalyst(prompt);
        }
      });
    });

    const aiForm = document.getElementById(
      'ai-drawer-form',
    ) as HTMLFormElement | null;
    const aiInput = document.getElementById(
      'ai-drawer-input',
    ) as HTMLInputElement | null;
    aiForm?.addEventListener('submit', (e) => {
      e.preventDefault();
      if (aiInput && aiInput.value.trim()) {
        const q = aiInput.value;
        aiInput.value = '';
        void this.handleAskAnalyst(q);
      }
    });

    this.bindSharedTabEvents();
  }

  private bindSharedTabEvents(): void {
    document.querySelectorAll('[data-select-competitor]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-select-competitor');
        if (id) {
          this.handleSelectCompetitor(id);
        }
      });
    });

    document.querySelectorAll('[data-news-filter]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const filter = btn.getAttribute('data-news-filter') as NewsDateFilter;
        if (filter) {
          this.newsDateFilter = filter;
          this.render();
        }
      });
    });

    document.querySelectorAll('[data-trigger-rescan]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const active = this.getActiveCompetitor();
        if (active) {
          void this.handleScanSubmit(active.url, 'rescan', active);
        }
      });
    });

    document.querySelectorAll('[data-evidence-cat]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const cat = btn.getAttribute('data-evidence-cat');
        if (cat) {
          this.evidenceCategory = cat;
          this.render();
        }
      });
    });

    const searchInput = document.getElementById(
      'evidence-search-input',
    ) as HTMLInputElement | null;
    searchInput?.addEventListener('input', () => {
      this.evidenceQuery = searchInput.value;
      const start = searchInput.selectionStart || this.evidenceQuery.length;
      this.render();
      const restored = document.getElementById(
        'evidence-search-input',
      ) as HTMLInputElement | null;
      if (restored) {
        restored.focus();
        restored.setSelectionRange(start, start);
      }
    });
  }
}
