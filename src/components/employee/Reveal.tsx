import * as React from 'react'
import { motion } from 'framer-motion'

/** A small fade+slide-up entrance, optionally staggered by index — used for
 * list items and cards so content doesn't just snap into place. */
export function Reveal({
  children,
  index = 0,
  className,
}: {
  children: React.ReactNode
  index?: number
  className?: string
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, delay: Math.min(index, 10) * 0.045, ease: [0.16, 1, 0.3, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  )
}
