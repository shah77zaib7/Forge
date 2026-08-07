import { motion } from 'framer-motion'
import { ArrowUpRight } from 'lucide-react'

import { micro } from '@/design/motion'
import type { Suggestion } from '../types'

interface SuggestionChipsProps {
  suggestions: Suggestion[]
  onPick: (suggestion: Suggestion) => void
}

/** The analyst's opening menu — quiet glass chips that send a prompt. */
export function SuggestionChips({ suggestions, onPick }: SuggestionChipsProps) {
  return (
    <div className="grid w-full max-w-xl grid-cols-2 gap-2 sm:grid-cols-4">
      {suggestions.map((suggestion, index) => (
        <motion.button
          key={suggestion.label}
          type="button"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...micro, delay: 0.05 + index * 0.035 }}
          whileHover={{ y: -1 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => onPick(suggestion)}
          className="group flex items-center gap-1.5 rounded-full border border-border bg-tint/[0.03] px-3 py-2 text-left text-xs text-muted outline-none transition-colors duration-200 hover:border-border-strong hover:bg-tint/[0.06] hover:text-foreground focus-visible:ring-2 focus-visible:ring-tint/30"
        >
          <span className="truncate">{suggestion.label}</span>
          <ArrowUpRight
            size={12}
            strokeWidth={2}
            className="ml-auto shrink-0 text-faint opacity-0 transition-opacity duration-200 group-hover:opacity-100"
          />
        </motion.button>
      ))}
    </div>
  )
}
