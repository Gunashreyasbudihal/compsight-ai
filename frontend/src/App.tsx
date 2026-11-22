/** CompSight Obsidian Intelligence Terminal */

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Sidebar } from './components/Sidebar'
import { Header } from './components/Header'
import { Tabs } from './components/Tabs'
import { Battlecard } from './components/Battlecard'
import { ProductMatrix, DiffTimeline, EvidenceView } from './components/Placeholders'
import type { CompetitorDetail, Tab } from './types'
import { api } from './api'

type ActiveTab = Tab

export default function App() {
  const [competitors, setCompetitors] = useState<Array<{ id: string; name: string; website_url: string; snapshot_count: number }>>([])
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [activeTab, setActiveTab] = useState<ActiveTab>('battlecard')
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [competitorDetail, setCompetitorDetail] = useState<CompetitorDetail | null>(null)

  // Load competitors on mount
  useEffect(() => {
    api.listCompetitors()
      .then((data) => setCompetitors(data))
      .catch(() => setCompetitors([]))
  }, [])

  const fetchDetail = useCallback(async (index: number) => {
    try {
      const detail = await api.getCompetitor(competitors[index]?.id || 0)
      setCompetitorDetail(detail)
    } catch (e) {
      console.error('Fetch detail failed:', e)
    }
  }, [competitors])

  const handleAnalyze = async (url: string) => {
    setIsAnalyzing(true)
    try {
      const result = await api.analyze(url)
      const newIndex = competitors.findIndex(c => c.id === result.competitor_id)
      if (newIndex === -1) {
        setCompetitors((prev) => [
          ...prev,
          {
            id: result.competitor_id,
            name: result.profile.company_name,
            website_url: result.profile.website_url,
            snapshot_count: 1,
          },
        ])
        setSelectedIndex(prev => prev === null ? 0 : prev)
      } else {
        setSelectedIndex(newIndex)
      }
      const idx = newIndex === -1 ? competitors.length : newIndex
      await fetchDetail(idx)
    } catch (e) {
      console.error('Analysis failed:', e)
    } finally {
      setIsAnalyzing(false)
    }
  }

  // Fetch detail when selectedIndex changes
  useEffect(() => {
    if (selectedIndex !== null) {
      fetchDetail(selectedIndex)
    }
  }, [selectedIndex, fetchDetail])

  // Validate activeTab - use derived state pattern
  const validTabs: ActiveTab[] = ['battlecard', 'matrix', 'timeline', 'evidence']
  const currentTab = validTabs.includes(activeTab) ? activeTab : 'battlecard'

  // Reset invalid tabs (derived effect)
  useEffect(() => {
    if (currentTab !== activeTab) {
      setActiveTab(currentTab)
    }
  }, [currentTab, activeTab])

  if (competitors.length === 0) {
    return (
      <div className="terminal-layout min-h-screen">
        <motion.div
          className="flex-1 flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <div className="text-center p-8 rounded-lg border border-border bg-surface">
            <h3 className="text-xl font-bold mb-4">Welcome to CompSight</h3>
            <p className="text-muted mb-6">Enter a competitor URL to begin intelligence gathering.</p>
          </div>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="terminal-layout min-h-screen flex">
      <Sidebar
        competitors={competitors}
        selectedId={selectedIndex}
        onSelect={setSelectedIndex}
        onAnalyze={handleAnalyze}
        isAnalyzing={isAnalyzing}
      />

      <div className="flex-1 flex flex-col">
        <Header competitor={competitorDetail} />

        <Tabs activeTab={currentTab} onChange={setActiveTab} />

        <main className="flex-1 overflow-y-auto p-4">
          <AnimatePresence mode="wait">
            {currentTab === 'battlecard' && (
              <Battlecard key="battlecard" competitor={competitorDetail} />
            )}
            {currentTab === 'matrix' && <ProductMatrix key="matrix" />}
            {currentTab === 'timeline' && <DiffTimeline key="timeline" />}
            {currentTab === 'evidence' && <EvidenceView key="evidence" />}
          </AnimatePresence>
        </main>
      </div>
    </div>
  )
}