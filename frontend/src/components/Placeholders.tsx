/** Placeholder components for remaining tabs (Slice 3) */

import { motion } from 'framer-motion'

export function ProductMatrix() {
  return (
    <motion.div
      className="tab-placeholder"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="placeholder-content">
        <h3>Product Matrix</h3>
        <p>Feature comparison grid coming in Slice 3</p>
      </div>
    </motion.div>
  )
}

export function DiffTimeline() {
  return (
    <motion.div
      className="tab-placeholder"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="placeholder-content">
        <h3>Diff Timeline</h3>
        <p>Change history visualization coming in Slice 3</p>
      </div>
    </motion.div>
  )
}

export function EvidenceView() {
  return (
    <motion.div
      className="tab-placeholder"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="placeholder-content">
        <h3>Evidence</h3>
        <p>Source evidence viewer coming in Slice 3</p>
      </div>
    </motion.div>
  )
}