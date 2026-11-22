/** Left Intelligence Rail - Sidebar with competitor tracking */

import { useState } from 'react'
import { ExternalLink, Activity } from 'lucide-react'
import { motion } from 'framer-motion'
import type { CompetitorListItem } from '../types'

interface SidebarProps {
  competitors: CompetitorListItem[]
  selectedId: number | null
  onSelect: (id: number) => void
  onAnalyze: (url: string) => Promise<void>
  isAnalyzing: boolean
}

export function Sidebar({
  competitors,
  selectedId,
  onSelect,
  onAnalyze,
  isAnalyzing,
}: SidebarProps) {
  const [url, setUrl] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (url.trim()) {
      await onAnalyze(url.trim())
      setUrl('')
    }
  }

  return (
    <motion.aside
      className="sidebar"
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
    >
      <div className="sidebar-header">
        <div className="brand">
          <span className="logo">CompSight</span>
          <span className="tagline">Intelligence Terminal</span>
        </div>
      </div>

      <div className="analyze-section">
        <form onSubmit={handleSubmit} className="analyze-form">
          <div className="input-group">
            <ExternalLink className="icon" size={16} />
            <input
              type="url"
              placeholder="https://competitor.com"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              disabled={isAnalyzing}
              className="url-input"
            />
            <button type="submit" disabled={isAnalyzing || !url.trim()}>
              {isAnalyzing ? (
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                >
                  <Activity size={16} />
                </motion.div>
              ) : (
                'Scan'
              )}
            </button>
          </div>
        </form>
      </div>

      <div className="competitors-section">
        <h3 className="section-title">Tracked Competitors</h3>
        <div className="competitors-list">
          {competitors.length === 0 ? (
            <div className="empty-state">
              <p className="text-muted">No competitors tracked yet</p>
            </div>
          ) : (
            <ul>
              {competitors.map((c, idx) => (
                <motion.li
                  key={c.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05 }}
                >
                  <button
                    className={`competitor-item ${selectedId === idx ? 'active' : ''}`}
                    onClick={() => onSelect(idx)}
                  >
                    <div className="competitor-info">
                      <span className="competitor-name">{c.name}</span>
                      <span className="competitor-url">{c.website_url}</span>
                    </div>
                    <span className="snapshot-count">{c.snapshot_count}</span>
                  </button>
                </motion.li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </motion.aside>
  )
}