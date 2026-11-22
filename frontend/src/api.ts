/** Typed API client for CompSight backend */

import type {
  CompetitorListItem,
  CompetitorDetail,
  AnalyzeResponse,
  CompetitorNewsResponse,
} from './types'

const API_BASE = 'http://127.0.0.1:8000'

class ApiClient {
  private baseUrl: string

  constructor(baseUrl: string = API_BASE) {
    this.baseUrl = baseUrl
  }

  async health(): Promise<{ status: 'ok' | 'error' }> {
    const res = await fetch(`${this.baseUrl}/api/health`)
    if (!res.ok) throw new Error('Health check failed')
    return res.json()
  }

  async listCompetitors(): Promise<CompetitorListItem[]> {
    const res = await fetch(`${this.baseUrl}/api/competitors`)
    if (!res.ok) throw new Error('Failed to list competitors')
    return res.json()
  }

  async getCompetitor(id: number | string): Promise<CompetitorDetail> {
    const res = await fetch(`${this.baseUrl}/api/competitors/${id}`)
    if (!res.ok) throw new Error(`Competitor ${id} not found`)
    return res.json()
  }

  async analyze(url: string): Promise<AnalyzeResponse> {
    const res = await fetch(`${this.baseUrl}/api/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Analysis failed' }))
      throw new Error(err.detail || 'Analysis failed')
    }
    return res.json()
  }

  async fetchCompetitorNews(competitorId: number | string): Promise<CompetitorNewsResponse> {
    const res = await fetch(`${this.baseUrl}/api/competitors/${competitorId}/news`)
    if (!res.ok) throw new Error(`Competitor ${competitorId} news not found`)
    return res.json()
  }
}

export const api = new ApiClient()
export type { CompetitorNewsResponse }