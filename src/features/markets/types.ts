export type CategoryId = 'l1' | 'defi' | 'ai' | 'memes' | 'stable'

/**
 * Broad asset classes Forge supports. Crypto and tokenized commodities are
 * live today via CoinGecko; commodities (XAU/XAG) are registered but awaiting
 * a data source; forex, stocks and indices are reserved for future
 * integration. The class drives which data source and display rules apply.
 */
export type AssetClass =
  | 'crypto'
  | 'commodity'
  | 'tokenized_commodity'
  | 'forex'
  | 'stock'
  | 'index'

/**
 * The configured market-data provider for an asset. 'none' means the asset is
 * registered in the catalog but has no live feed — it must never be shown
 * with fabricated values.
 */
export type DataSource = 'coingecko' | 'goldapi' | 'none'

export interface Coin {
  /** Stable internal id — used by URLs, favorites, watchlist and lookups. */
  id: string
  name: string
  /** Display ticker (e.g. "BTC"). */
  ticker: string
  price: number
  /**
   * 24h change in percent. Null when the provider doesn't supply it (e.g.
   * spot metals) — surfaces render an honest dash, never a fabricated figure.
   */
  change24h: number | null
  /** Market cap in USD — null when the provider doesn't supply it. */
  marketCap: number | null
  /** 24h volume in USD — null when the provider doesn't supply it. */
  volume24h: number | null
  /** Circulating supply — null when the provider doesn't supply it. */
  supply: number | null
  /** 24h high in USD — null when the provider doesn't supply it. */
  high24h: number | null
  /** 24h low in USD — null when the provider doesn't supply it. */
  low24h: number | null
  categories: CategoryId[]
  trending: boolean
  /** Brand hue used by the letter-fallback tile (identification, not decoration). */
  color: string
  /** Real 7-day price series for the mini sparkline. */
  spark: number[]
  blurb: string
  /**
   * Official asset logo reference, resolved from the live feed (CoinGecko
   * image URL for crypto). Rendered by AssetIcon; absent until the feed
   * provides it and whenever the feed is down.
   */
  logoUrl?: string
  /** Asset class — drives data-source and display rules (see AssetClass). */
  assetClass: AssetClass
  /** The currency prices are quoted in (e.g. "USD"). */
  quoteCurrency: string
  /** Canonical quote precision for this asset, in decimal places. */
  decimals: number
  /** Which configured provider supplies live data — 'none' = registered, not live. */
  dataSource: DataSource
  /**
   * The TradingView chart symbol (EXCHANGE:SYMBOL) for this asset, when one
   * exists — e.g. "BITSTAMP:BTCUSD", "OANDA:XAUUSD". Absent assets show a
   * graceful chart-unavailable state instead of an unrelated instrument.
   */
  tvSymbol?: string
}

/**
 * Static identity metadata for the asset universe — the canonical catalog.
 * Contains no market values; those are merged onto these identities by the
 * live market-data store (src/store/market-data.tsx), which polls CoinGecko
 * once for the whole app. Registry order is the fallback sort for assets
 * with no live quote yet.
 */
export interface CoinIdentity
  extends Omit<
    Coin,
    'price' | 'change24h' | 'marketCap' | 'volume24h' | 'supply' | 'high24h' | 'low24h' | 'spark' | 'tvSymbol'
  > {
  /**
   * Circulating-supply fallback used only when the live feed omits it.
   * Optional — assets without a meaningful supply (e.g. commodities) omit it.
   */
  supply?: number
  /**
   * The identifier the configured data source uses to fetch this asset
   * (e.g. CoinGecko's "binancecoin" for BNB). Only set when dataSource is
   * live; the stable internal id is what URLs, favorites and lookups use.
   */
  marketSymbol?: string
  /**
   * The exchange klines pair (BASEQUOTE, e.g. "BTCUSDT") used by the
   * sub-30m OHLC provider for real 1M/5M/15M candles. Only set for assets
   * with a tradable keyless exchange pair; stablecoins and metals have no
   * such pair and keep their honest unavailable state.
   */
  exchangeSymbol?: string
  /**
   * The TradingView chart symbol (EXCHANGE:SYMBOL) for this asset, when one
   * exists — e.g. "BITSTAMP:BTCUSD", "OANDA:XAUUSD". Absent assets show a
   * graceful chart-unavailable state instead of an unrelated instrument.
   */
  tvSymbol?: string
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
