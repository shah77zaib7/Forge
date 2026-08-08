import {
  AlertTriangle,
  ArrowLeftRight,
  BookOpen,
  BrainCircuit,
  Layers,
  Newspaper,
  Target,
  type LucideIcon,
} from 'lucide-react'

import type { OracleCard } from '../types'

/** Icon per response-card kind — shared by card headers and history rows. */
export function cardKindIcon(kind: OracleCard['kind']): LucideIcon {
  switch (kind) {
    case 'analysis':
      return BrainCircuit
    case 'liquidity':
      return Layers
    case 'trade-setup':
      return Target
    case 'educational':
      return BookOpen
    case 'warning':
      return AlertTriangle
    case 'comparison':
      return ArrowLeftRight
    case 'market-brief':
      return Newspaper
  }
}
