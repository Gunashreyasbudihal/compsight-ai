/** Tab 1 - Battlecard with bento-grid layout */

import { motion } from 'framer-motion'
import type { CompetitorDetail } from '../types'

interface BattlecardProps {
  competitor: CompetitorDetail | null
}

export function Battlecard({ competitor }: BattlecardProps) {
  const profile = competitor?.profile

  if (!profile) {
    return (
      <motion.div
        className="empty-state-page"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        <div className="empty-content">
          <h3>Begin Intelligence Gathering</h3>
          <p>Enter a competitor URL in the sidebar to start tracking.</p>
        </div>
      </motion.div>
    )
  }

  return (
    <motion.div
      className="battlecard"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
    >
      <div className="bento-grid">
        {/* Company Overview Card */}
        <motion.div
          className="card company-overview"
          whileHover={{ scale: 1.01 }}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <h3 className="card-title">Company Overview</h3>
          <div className="card-content">
            {profile.logo_url && (
              <img
                src={profile.logo_url}
                alt={`${profile.company_name} logo`}
                className="company-logo"
              />
            )}
            <div className="company-details">
              <div className="detail-row">
                <span className="label">Name:</span>
                <span className="value">{profile.company_name}</span>
              </div>
              <div className="detail-row">
                <span className="label">Website:</span>
                <span className="value">{profile.website_url}</span>
              </div>
              {profile.founded && (
                <div className="detail-row">
                  <span className="label">Founded:</span>
                  <span className="value">{profile.founded}</span>
                </div>
              )}
              {profile.headquarters && (
                <div className="detail-row">
                  <span className="label">HQ:</span>
                  <span className="value">{profile.headquarters}</span>
                </div>
              )}
            </div>
          </div>
        </motion.div>

        {/* Value Propositions Card */}
        <motion.div
          className="card value-props"
          whileHover={{ scale: 1.01 }}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          <h3 className="card-title">Value Propositions</h3>
          <ul className="feature-list">
            {profile.value_props && profile.value_props.length > 0 ? (
              profile.value_props.map((vp, idx) => (
                <motion.li
                  key={idx}
                  className="feature-item"
                  whileHover={{ x: 4 }}
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.05 + idx * 0.05 }}
                >
                  <div className="feature-dot" />
                  <span>{vp}</span>
                </motion.li>
              ))
            ) : (
              <li className="empty-item">No value propositions detected</li>
            )}
          </ul>
        </motion.div>

        {/* Target Markets Card */}
        <motion.div
          className="card target-markets"
          whileHover={{ scale: 1.01 }}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <h3 className="card-title">Target Markets</h3>
          <div className="chip-grid">
            {profile.target_markets && profile.target_markets.length > 0 ? (
              profile.target_markets.map((market, idx) => (
                <motion.div
                  key={idx}
                  className="market-chip"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.05 + idx * 0.05 }}
                >
                  {market}
                </motion.div>
              ))
            ) : (
              <span className="empty-market">No markets detected</span>
            )}
          </div>
        </motion.div>

        {/* Pricing Intelligence Card */}
        <motion.div
          className="card pricing"
          whileHover={{ scale: 1.01 }}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
        >
          <h3 className="card-title">Pricing Intelligence</h3>
          <div className="pricing-content">
            <div className="pricing-field">
              <span className="label">Tier:</span>
              <span className="value">{profile.pricing_tier || 'Not detected'}</span>
            </div>
            <div className="pricing-field">
              <span className="label">Products:</span>
              <span className="value">
                {profile.products?.length ?? 0} products
              </span>
            </div>
          </div>
        </motion.div>
      </div>
    </motion.div>
  )
}