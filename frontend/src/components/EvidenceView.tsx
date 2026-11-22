/** Grounded Evidence & Live News Intel */

import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { CompetitorDetail, Evidence } from '../types'
import { api } from '../api'

interface Article {
  title: string
  url: string
  source: string
  date: string
  snippet: string
}

export function EvidenceView({ competitor }: { competitor?: CompetitorDetail | null }) {
  const [expandedEvidence, setExpandedEvidence] = useState<string | null>(null)
  const [newsArticles, setNewsArticles] = useState<Article[]>([])
  const [newsLoading, setNewsLoading] = useState(false)

  const profile = competitor?.profile
  const competitorId = competitor?.id

  // Collect evidence from products
  const evidenceList = useMemo(() => {
    const allEvidence: Evidence[] = []
    profile?.products?.forEach((p) => {
      p.evidence?.forEach((e) => allEvidence.push(e))
    })
    return allEvidence
  }, [profile?.products])

  const loadNews = async () => {
    if (!competitorId || newsLoading) return
    setNewsLoading(true)
    try {
      const data = await api.fetchCompetitorNews(competitorId)
      setNewsArticles((data as any).articles || [])
    } catch (e) {
      console.error('News load failed:', e)
    } finally {
      setNewsLoading(false)
    }
  }

  // Load news once when component mounts with a competitor
  useEffect(() => {
    if (competitorId && newsArticles.length === 0) {
      loadNews()
    }
  }, [competitorId])

  // Prevent multiple news loads
  useEffect(() => {
    if (competitorId) {
      const key = `news-${competitorId}`
      if (localStorage.getItem(key)) {
        // Already loaded
      } else {
        localStorage.setItem(key, 'loaded')
        loadNews()
      }
    }
  }, [competitorId])

  // Cleanup localStorage on unmount
  useEffect(() => {
    return () => {
      if (competitorId) {
        const key = `news-${competitorId}`
        localStorage.removeItem(key)
      }
    }
  }, [competitorId])

  return (
    <motion.div
      className="tab-placeholder"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="placeholder-content w-full max-w-4xl">
        <h3 className="text-xl font-bold mb-4 text-text">Evidence & Live Intel</h3>

        {/* Evidence Section */}
        <div className="mb-8">
          <h4 className="text-lg font-semibold text-text mb-4">Grounded Evidence</h4>

          {evidenceList.length === 0 ? (
            <div className="text-center py-6 text-muted">
              <p>No evidence available</p>
            </div>
          ) : (
            <div className="space-y-3">
              {evidenceList.map((evidence, i) => (
                <motion.div
                  key={`${evidence.source_url}-${i}`}
                  className="card"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <div
                    className="cursor-pointer"
                    onClick={() => setExpandedEvidence(expandedEvidence === evidence.source_url ? null : evidence.source_url)}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-xs text-muted font-mono">{evidence.source_url ? evidence.source_url.split('/').pop() : 'source'}</span>
                      <svg
                        className={`w-4 h-4 text-muted transition-transform ${expandedEvidence === evidence.source_url ? 'rotate-180' : ''}`}
                        fill="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                      </svg>
                    </div>
                    <blockquote className="text-sm text-text line-clamp-2">
                      {evidence.snippet || evidence.source_text}
                    </blockquote>
                  </div>

                  <AnimatePresence>
                    {expandedEvidence === evidence.source_url && evidence.snippet && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="mt-3 pt-3 border-t border-border"
                      >
                        <p className="text-xs text-muted mb-2">Full context:</p>
                        <p className="text-sm text-text">{evidence.snippet}</p>
                        {evidence.source_url && (
                          <a
                            href={evidence.source_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-block mt-3 text-xs text-emerald hover:underline"
                          >
                            View source →
                          </a>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              ))}
            </div>
          )}
        </div>

        {/* Live News Intel Section */}
        <div>
          <h4 className="text-lg font-semibold text-text mb-4">Live News Intel</h4>

          {newsLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-20 bg-border/30 rounded-lg animate-pulse"></div>
              ))}
            </div>
          ) : newsArticles.length === 0 ? (
            <div className="text-center py-6 text-muted">
              <p>No recent news found</p>
              <p className="text-xs mt-1">Try searching for pricing or product updates</p>
            </div>
          ) : (
            <div className="space-y-4">
              {newsArticles.map((article, i) => (
                <motion.div
                  key={i}
                  className="card"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <h5 className="font-medium text-text mb-2">
                    <a
                      href={article.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:underline text-text"
                    >
                      {article.title}
                    </a>
                  </h5>
                  <div className="flex items-center justify-between text-xs text-muted mb-2">
                    <span>{article.source}</span>
                    {article.date && <span>{article.date}</span>}
                  </div>
                  {article.snippet && (
                    <p className="text-sm text-muted line-clamp-2">{article.snippet}</p>
                  )}
                </motion.div>
              ))}
            </div>
          )}

          {/* Refresh Button */}
          <button
            onClick={loadNews}
            disabled={newsLoading}
            className="mt-4 px-3 py-1.5 text-sm bg-border rounded hover:bg-border/50 transition-colors disabled:opacity-50"
          >
            {newsLoading ? 'Refreshing...' : 'Refresh News'}
          </button>
        </div>
      </div>
    </motion.div>
  )
}