/** Animated Diff Timeline with semantic accents */

import { motion } from 'framer-motion'
import type { CompetitorDetail, ProfileDiff } from '../types'

interface DiffTimelineProps {
  competitor?: CompetitorDetail | null
}

function hasDiffChanges(diff: ProfileDiff | null): boolean {
  if (!diff) return false
  return (
    (diff.value_props_added?.length ?? 0) > 0 ||
    (diff.value_props_removed?.length ?? 0) > 0 ||
    (diff.value_props_modified?.length ?? 0) > 0 ||
    (diff.products_added?.length ?? 0) > 0 ||
    (diff.products_removed?.length ?? 0) > 0 ||
    (diff.products_modified?.length ?? 0) > 0 ||
    (diff.market_added?.length ?? 0) > 0 ||
    (diff.market_removed?.length ?? 0) > 0
  )
}

export function DiffTimeline({ competitor }: DiffTimelineProps) {
  const profile = competitor?.profile
  const diff = competitor?.diff ?? null
  const timestamps = competitor?.history_timestamps || []

  const hasChanges = hasDiffChanges(diff)

  if (!profile) {
    return (
      <motion.div
        className="tab-placeholder"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <div className="placeholder-content">
          <h3 className="text-xl font-bold mb-4 text-text">Diff Timeline</h3>
          <p className="text-muted">No competitor data available</p>
        </div>
      </motion.div>
    )
  }

  // Safe diff property access
  const valuePropsAdded = diff?.value_props_added || []
  const valuePropsRemoved = diff?.value_props_removed || []
  const valuePropsModified = diff?.value_props_modified || []
  const productsAdded = diff?.products_added || []
  const productsRemoved = diff?.products_removed || []
  const productsModified = diff?.products_modified || []
  const marketAdded = diff?.market_added || []
  const marketRemoved = diff?.market_removed || []

  return (
    <motion.div
      className="tab-placeholder"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="placeholder-content w-full max-w-4xl">
        <h3 className="text-xl font-bold mb-4 text-text">Diff Timeline</h3>

        {/* No Changes State */}
        {!hasChanges && (
          <div className="text-center py-8">
            <div className="inline-block w-16 h-16 rounded-full bg-emerald/20 flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-emerald" fill="currentColor" viewBox="0 0 24 24">
                <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <h4 className="text-lg font-semibold text-text mb-2">No changes detected</h4>
            <p className="text-muted mb-4">Profile is stable with no recorded modifications</p>

            <div className="mt-4 text-sm text-muted">
              <p>Timeline: {timestamps.length} snapshots</p>
              {timestamps.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {timestamps.map((ts, i) => (
                    <li key={i} className="text-mono text-xs">{new Date(ts).toISOString().split('T')[0]}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        {/* Changes Present */}
        {hasChanges && (
          <div className="space-y-6">
            {/* Value Props Added */}
            {valuePropsAdded.length > 0 && (
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="border-l-4 border-emerald pl-4"
              >
                <h4 className="flex items-center gap-2 text-emerald font-semibold mb-2">
                  <span className="w-2 h-2 rounded-full bg-emerald"></span>
                  Value Props Added
                </h4>
                <ul className="space-y-1">
                  {valuePropsAdded.map((vp, i) => (
                    <li key={i} className="text-text">{vp}</li>
                  ))}
                </ul>
              </motion.div>
            )}

            {/* Value Props Modified */}
            {valuePropsModified.length > 0 && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="border-l-4 border-amber pl-4"
              >
                <h4 className="flex items-center gap-2 text-amber font-semibold mb-2">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 4v16m8-8H4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                  Value Props Modified
                </h4>
                <ul className="space-y-2">
                  {valuePropsModified.map((m, i) => (
                    <li key={i} className="text-sm">
                      <div className="text-muted">→ {m.old_value}</div>
                      <div className="text-amber font-medium">↓ {m.new_value}</div>
                    </li>
                  ))}
                </ul>
              </motion.div>
            )}

            {/* Value Props Removed */}
            {valuePropsRemoved.length > 0 && (
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="border-l-4 border-crimson pl-4"
              >
                <h4 className="flex items-center gap-2 text-crimson font-semibold mb-2">
                  <span className="w-2 h-2 rounded-full bg-crimson"></span>
                  Value Props Removed
                </h4>
                <ul className="space-y-1">
                  {valuePropsRemoved.map((vp, i) => (
                    <li key={i} className="text-text line-through text-muted">{vp}</li>
                  ))}
                </ul>
              </motion.div>
            )}

            {/* Products Added */}
            {productsAdded.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="border-l-4 border-emerald pl-4"
              >
                <h4 className="flex items-center gap-2 text-emerald font-semibold mb-2">
                  <span className="w-2 h-2 rounded-full bg-emerald"></span>
                  Products Added
                </h4>
                <ul className="space-y-2">
                  {productsAdded.map((p, i) => (
                    <li key={i} className="text-text">
                      <span className="font-medium">{p.name}</span>
                      {p.price && <span className="text-mono text-muted ml-2">{p.price}</span>}
                    </li>
                  ))}
                </ul>
              </motion.div>
            )}

            {/* Products Modified */}
            {productsModified.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="border-l-4 border-amber pl-4"
              >
                <h4 className="flex items-center gap-2 text-amber font-semibold mb-2">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 4v16m8-8H4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                  Products Modified
                </h4>
                <div className="space-y-3">
                  {productsModified.map((m, i) => (
                    <div key={i} className="bg-surface/50 p-3 rounded">
                      <div className="text-sm text-muted mb-1">{m.old_product.name}</div>
                      <div className="flex gap-4 text-xs">
                        {m.old_product.price !== m.new_product.price && (
                          <div>
                            <span className="text-crimson">↓ {m.old_product.price}</span>
                            <span className="text-emerald ml-2">→ {m.new_product.price}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Products Removed */}
            {productsRemoved.length > 0 && (
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="border-l-4 border-crimson pl-4"
              >
                <h4 className="flex items-center gap-2 text-crimson font-semibold mb-2">
                  <span className="w-2 h-2 rounded-full bg-crimson"></span>
                  Products Removed
                </h4>
                <ul className="space-y-1">
                  {productsRemoved.map((p, i) => (
                    <li key={i} className="text-text line-through text-muted">{p.name}</li>
                  ))}
                </ul>
              </motion.div>
            )}

            {/* Markets Added/Removed */}
            {(marketAdded.length > 0 || marketRemoved.length > 0) && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="border-l-4 border-emerald pl-4"
              >
                <div className="flex gap-6">
                  {marketAdded.length > 0 && (
                    <div>
                      <h4 className="flex items-center gap-2 text-emerald font-semibold mb-2">
                        <span className="w-2 h-2 rounded-full bg-emerald"></span>
                        Markets Added
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {marketAdded.map((m, i) => (
                          <span key={i} className="market-chip text-xs">{m}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {marketRemoved.length > 0 && (
                    <div>
                      <h4 className="flex items-center gap-2 text-crimson font-semibold mb-2">
                        <span className="w-2 h-2 rounded-full bg-crimson"></span>
                        Markets Removed
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {marketRemoved.map((m, i) => (
                          <span key={i} className="market-chip text-xs line-through text-muted">{m}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </div>
        )}
      </div>
    </motion.div>
  )
}