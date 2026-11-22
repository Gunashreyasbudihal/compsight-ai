/** Product & Pricing Matrix with search filter */

import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import type { CompetitorDetail } from '../types'

interface ProductMatrixProps {
  competitor?: CompetitorDetail | null
}

export function ProductMatrix({ competitor }: ProductMatrixProps) {
  const [search, setSearch] = useState('')
  const profile = competitor?.profile

  const filteredProducts = useMemo(() => {
    if (!profile?.products) return []
    const q = search.toLowerCase()
    return profile.products.filter(p =>
      (p.name || '').toLowerCase().includes(q) ||
      (p.description || '').toLowerCase().includes(q) ||
      (p.price || '').toLowerCase().includes(q)
    )
  }, [profile?.products, search])

  const hasProducts = profile && (profile.products?.length ?? 0) > 0
  const hasNoMatch = !search && !hasProducts

  return (
    <motion.div
      className="tab-placeholder"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="placeholder-content w-full max-w-4xl">
        <h3 className="text-xl font-bold mb-4 text-text">Product Matrix</h3>

        {/* Search Filter */}
        <div className="mb-6">
          <input
            type="text"
            placeholder="Search products, features, or pricing..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="px-3 py-2 bg-canvas border border-border rounded-lg w-full max-w-sm focus:outline-none focus:ring-2 focus:ring-emerald text-text placeholder:text-muted"
          />
        </div>

        {/* Empty State */}
        {hasNoMatch && (
          <div className="text-center py-8 text-muted">
            <p>No products tracked yet</p>
            <p className="text-sm mt-2">Run analysis on a competitor to populate product data</p>
          </div>
        )}

        {/* Product Grid/Bento */}
        {filteredProducts.length > 0 && (
          <div className="bento-grid">
            {filteredProducts.map((product, index) => (
              <motion.div
                key={`${product.name || index}`}
                className="card"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <div className="card-title">{product.name || 'Unnamed Product'}</div>
                {product.description && (
                  <p className="text-sm text-muted mb-3">{product.description}</p>
                )}
                {product.price && (
                  <div className="mb-3">
                    <span className="domain-pill font-mono">{product.price}</span>
                  </div>
                )}
                {product.evidence && product.evidence.length > 0 && (
                  <div className="border-t border-border pt-2">
                    <div className="text-xs text-muted mb-1">Evidence</div>
                    {product.evidence.slice(0, 2).map((e, ei) => (
                      <div key={ei} className="text-xs text-muted truncate mb-1">
                        {e.source_url ? `${e.source_text?.slice(0, 30)}...` : e.source_text?.slice(0, 30)}
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  )
}