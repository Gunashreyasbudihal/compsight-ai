/** Type definitions matching CompSight API response shapes */

export interface Evidence {
  source_url: string
  source_text: string
  snippet?: string
}

export interface Product {
  name: string
  description?: string
  price?: string
  url?: string
  evidence?: Evidence[]
}

export interface CompetitorProfile {
  company_name: string
  website_url: string
  logo_url?: string
  value_props?: string[]
  target_markets?: string[]
  pricing_tier?: string
  products?: Product[]
  founded?: string
  employees?: string
  headquarters?: string
  funding?: string
  revenue?: string
}

export interface CompetitorListItem {
  id: number | string
  name: string
  website_url: string
  snapshot_count: number
  last_captured?: string
}

export interface CompetitorDetail {
  id: string
  profile: CompetitorProfile
  snapshot_count: number
  history_timestamps: string[]
  diff: ProfileDiff | null
}

export interface ProfileDiffValuePropModified {
  index: number
  old_value: string
  new_value: string
}

export interface ProfileDiffProductModified {
  index: number
  old_product: Product
  new_product: Product
}

export interface ProfileDiff {
  value_props_added: string[]
  value_props_removed: string[]
  value_props_modified: ProfileDiffValuePropModified[]
  products_added: Product[]
  products_removed: Product[]
  products_modified: ProfileDiffProductModified[]
  market_added: string[]
  market_removed: string[]
}

export interface AnalyzeResponse {
  competitor_id: string
  snapshot_id: number
  profile: CompetitorProfile
  diff: ProfileDiff | null
}

export interface HealthResponse {
  status: 'ok' | 'error'
}

export interface NewsArticle {
  title: string
  url: string
  source: string
  date: string
  snippet: string
}

export interface CompetitorNewsResponse {
  company_name: string
  articles: NewsArticle[]
}

export type Tab = 'battlecard' | 'matrix' | 'timeline' | 'evidence'