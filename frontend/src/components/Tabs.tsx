/** Animated Tab Bar with Framer Motion layoutId */

import { motion } from 'framer-motion'
import { LayoutDashboard, Grid, Clock, FileText } from 'lucide-react'
import type { Tab } from '../types'

interface TabsProps {
  activeTab: Tab
  onChange: (tab: Tab) => void
}

export function Tabs({ activeTab, onChange }: TabsProps) {
  const tabs: Array<{ id: Tab; label: string; icon: typeof LayoutDashboard }> = [
    { id: 'battlecard', label: 'Battlecard', icon: LayoutDashboard },
    { id: 'matrix', label: 'Product Matrix', icon: Grid },
    { id: 'timeline', label: 'Diff Timeline', icon: Clock },
    { id: 'evidence', label: 'Evidence', icon: FileText },
  ]

  return (
    <nav className="tabs">
      {tabs.map((tab, idx) => {
        const isActive = activeTab === tab.id
        return (
          <motion.button
            key={tab.id}
            className={`tab ${isActive ? 'active' : ''}`}
            onClick={() => onChange(tab.id)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 + idx * 0.05 }}
          >
            <tab.icon size={16} className="tab-icon" />
            <span>{tab.label}</span>
            {isActive && (
              <motion.div
                className="tab-underline"
                layoutId="tab-underline"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              />
            )}
          </motion.button>
        )
      })}
    </nav>
  )
}