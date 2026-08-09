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
  /** Real 7-day price series for the mini sparkline. */
  spark: number[]
  blurb: string
}

/**
 * Static identity metadata for the asset universe — brand hues, categories,
 * blurbs and supply fallbacks. Contains no market values; those are merged
 * onto this by the live market-data store.
 */
export interface CoinIdentity extends Omit<Coin, 'price' | 'change24h' | 'marketCap' | 'volume24h' | 'spark'> {
  /**
   * CoinGecko asset id when it differs from the stable internal id
   * (e.g. internal "bnb" → CoinGecko "binancecoin"). The internal id is
   * what URLs, favorites and lookups use; the API id is only for fetching.
   */
  apiId?: string
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
