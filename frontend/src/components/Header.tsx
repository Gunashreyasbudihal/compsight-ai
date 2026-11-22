/** Top Telemetry Header with KPI cards */

import { ExternalLink } from 'lucide-react'
import { motion } from 'framer-motion'
import type { CompetitorDetail } from '../types'

interface HeaderProps {
  competitor: CompetitorDetail | null
}

export function Header({ competitor }: HeaderProps) {
  const profile = competitor?.profile
  const diff = competitor?.diff

  const getDiffStatus = () => {
    if (!diff) return { label: 'New', color: 'emerald' }
    const hasChanges =
      diff.value_props_added.length > 0 ||
      diff.value_props_removed.length > 0 ||
      diff.products_added.length > 0 ||
      diff.products_removed.length > 0
    if (!hasChanges) return { label: 'Stable', color: 'emerald' }
    return { label: 'Changes Detected', color: 'amber' }
  }

  const diffStatus = getDiffStatus()

  return (
    <motion.header
      className="header"
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
    >
      <div className="header-content">
        <div className="header-left">
          <h2 className="company-name">
            {profile?.company_name || 'Select Competitor'}
          </h2>
          {profile?.website_url && (
            <a
              href={profile.website_url}
              target="_blank"
              rel="noopener noreferrer"
              className="domain-pill"
            >
              <ExternalLink size={14} />
              <span>{profile.website_url.replace(/^https?:\/\//, '')}</span>
            </a>
          )}
        </div>

        <motion.div
          className="kpi-grid"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          <motion.div
            className="kpi-card"
            whileHover={{ scale: 1.02 }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            <div className="kpi-value">{profile?.products?.length ?? 0}</div>
            <div className="kpi-label">Products Tracked</div>
          </motion.div>

          <motion.div
            className="kpi-card"
            whileHover={{ scale: 1.02 }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.25 }}
          >
            <div className="kpi-value">
              {profile?.value_props?.length ?? 0}
            </div>
            <div className="kpi-label">Value Props</div>
          </motion.div>

          <motion.div
            className="kpi-card"
            whileHover={{ scale: 1.02 }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            <div className="kpi-value">{competitor?.snapshot_count ?? 0}</div>
            <div className="kpi-label">Snapshots</div>
          </motion.div>

          <motion.div
            className="kpi-card"
            whileHover={{ scale: 1.02 }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.35 }}
          >
            <div
              className={`kpi-value diff-${diffStatus.color}`}
              style={{ color: `var(--color-${diffStatus.color})` }}
            >
              {diffStatus.label}
            </div>
            <div className="kpi-label">Diff Status</div>
          </motion.div>
        </motion.div>
      </div>
    </motion.header>
  )
}