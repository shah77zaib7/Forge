export type CategoryId = 'l1' | 'defi' | 'ai' | 'memes' | 'stable'

export interface Coin {
  id: string
  name: string
  ticker: string
  price: number
  change24h: number
  marketCap: number
  volume24h: number
  supply: number
  categories: CategoryId[]
  trending: boolean
  /** Brand hue used by the logo tile (identification, not decoration). */
  color: string
  /** Deterministic series for the mini sparkline. */
  spark: number[]
  blurb: string
}

export type MarketFilter =
  | 'all'
  | 'favorites'
  | 'trending'
  | CategoryId

export interface MarketFilterOption {
  id: MarketFilter
  label: string
}
