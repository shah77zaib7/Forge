import type { CategoryId, CoinIdentity, MarketFilterOption } from './types'

export const marketFilters: MarketFilterOption[] = [
  { id: 'all', label: 'All' },
  { id: 'favorites', label: 'Favorites' },
  { id: 'trending', label: 'Trending' },
  { id: 'l1', label: 'Layer 1' },
  { id: 'defi', label: 'DeFi' },
  { id: 'ai', label: 'AI' },
  { id: 'memes', label: 'Memes' },
  { id: 'stable', label: 'Stablecoins' },
]

export const categoryLabels: Record<CategoryId, string> = {
  l1: 'Layer 1',
  defi: 'DeFi',
  ai: 'AI',
  memes: 'Memes',
  stable: 'Stablecoin',
}

/* ------------------------------------------------------------------ */
/* Asset identity registry — NOT market data.                          */
/*                                                                    */
/* This is the static shape of Forge's universe: names, brand hues,   */
/* categories, blurbs and supply fallbacks. It deliberately contains  */
/* no prices, changes, caps or volumes. All live market values are    */
/* merged onto these identities by the canonical market-data store    */
/* (src/store/market-data.tsx), which polls CoinGecko once for the    */
/* whole app. Registry order is the fallback sort for coins with no   */
/* live quote yet.                                                    */
/* ------------------------------------------------------------------ */

export const COIN_REGISTRY: CoinIdentity[] = [
  {
    id: 'bitcoin',
    name: 'Bitcoin',
    ticker: 'BTC',
    supply: 19_750_000,
    categories: ['l1'],
    trending: true,
    color: '#F7931A',
    blurb:
      'The original digital asset — a store of value secured by the largest and most battle-tested network in the industry.',
  },
  {
    id: 'ethereum',
    name: 'Ethereum',
    ticker: 'ETH',
    supply: 120_400_000,
    categories: ['l1'],
    trending: true,
    color: '#627EEA',
    blurb:
      'The settlement layer for decentralized finance, smart contracts and the vast majority of on-chain activity.',
  },
  {
    id: 'tether',
    name: 'Tether',
    ticker: 'USDT',
    supply: 148_000_000_000,
    categories: ['stable'],
    trending: false,
    color: '#26A17B',
    blurb:
      'A dollar-pegged stablecoin — the liquidity backbone of most global crypto pairs.',
  },
  {
    id: 'solana',
    name: 'Solana',
    ticker: 'SOL',
    supply: 474_000_000,
    categories: ['l1'],
    trending: true,
    color: '#9945FF',
    blurb:
      'A high-throughput layer-1 built for speed — the home of consumer apps and high-frequency markets.',
  },
  {
    id: 'bnb',
    apiId: 'binancecoin',
    name: 'BNB',
    ticker: 'BNB',
    supply: 145_600_000,
    categories: ['l1'],
    trending: false,
    color: '#F3BA2F',
    blurb:
      'The native asset of the BNB Chain ecosystem — exchange utility, staking and gas all in one.',
  },
  {
    id: 'xrp',
    apiId: 'ripple',
    name: 'XRP',
    ticker: 'XRP',
    supply: 57_500_000_000,
    categories: ['l1'],
    trending: false,
    color: '#00AAE4',
    blurb:
      'A payments-focused network built for fast, low-cost cross-border settlement.',
  },
  {
    id: 'usd-coin',
    name: 'USD Coin',
    ticker: 'USDC',
    supply: 41_200_000_000,
    categories: ['stable'],
    trending: false,
    color: '#2775CA',
    blurb:
      'A regulated dollar-pegged stablecoin issued by Circle, redeemable one-for-one.',
  },
  {
    id: 'cardano',
    name: 'Cardano',
    ticker: 'ADA',
    supply: 35_900_000_000,
    categories: ['l1'],
    trending: false,
    color: '#0033AD',
    blurb:
      'A research-driven proof-of-stake network known for its methodical, peer-reviewed upgrades.',
  },
  {
    id: 'dogecoin',
    name: 'Dogecoin',
    ticker: 'DOGE',
    supply: 147_000_000_000,
    categories: ['memes'],
    trending: true,
    color: '#C2A633',
    blurb:
      'The original meme coin — a friendly community asset with surprising staying power.',
  },
  {
    id: 'avalanche',
    apiId: 'avalanche-2',
    name: 'Avalanche',
    ticker: 'AVAX',
    supply: 406_000_000,
    categories: ['l1'],
    trending: false,
    color: '#E84142',
    blurb:
      'A multi-chain platform built for near-instant finality and enterprise-scale subnets.',
  },
  {
    id: 'shiba-inu',
    name: 'Shiba Inu',
    ticker: 'SHIB',
    supply: 589_000_000_000_000,
    categories: ['memes'],
    trending: false,
    color: '#FFA409',
    blurb:
      'The self-styled dogecoin killer — an enormous, community-driven meme ecosystem.',
  },
  {
    id: 'polkadot',
    name: 'Polkadot',
    ticker: 'DOT',
    supply: 1_520_000_000,
    categories: ['l1'],
    trending: false,
    color: '#E6007A',
    blurb:
      'A sharded multichain protocol connecting specialized blockchains into one interoperable network.',
  },
  {
    id: 'chainlink',
    name: 'Chainlink',
    ticker: 'LINK',
    supply: 630_000_000,
    categories: ['defi'],
    trending: false,
    color: '#2A5ADA',
    blurb:
      'The industry-standard oracle network feeding real-world data to smart contracts everywhere.',
  },
  {
    id: 'near',
    name: 'NEAR Protocol',
    ticker: 'NEAR',
    supply: 1_180_000_000,
    categories: ['l1'],
    trending: false,
    color: '#111111',
    blurb:
      'A sharded, human-readable layer-1 — fast finality and an interface designed for newcomers.',
  },
  {
    id: 'uniswap',
    name: 'Uniswap',
    ticker: 'UNI',
    supply: 600_000_000,
    categories: ['defi'],
    trending: false,
    color: '#FF007A',
    blurb:
      'The governance token of the largest decentralized exchange — automated liquidity, zero order books.',
  },
  {
    id: 'pepe',
    name: 'Pepe',
    ticker: 'PEPE',
    supply: 420_000_000_000_000,
    categories: ['memes'],
    trending: true,
    color: '#54A552',
    blurb:
      'A deflationary meme coin honoring an internet legend — fast, chaotic and fiercely loved.',
  },
  {
    id: 'fetch-ai',
    name: 'Fetch.ai',
    ticker: 'FET',
    supply: 2_580_000_000,
    categories: ['ai'],
    trending: false,
    color: '#06B6D4',
    blurb:
      'An AI network for autonomous agents — coordination, machine learning and data markets on-chain.',
  },
  {
    id: 'arbitrum',
    name: 'Arbitrum',
    ticker: 'ARB',
    supply: 3_500_000_000,
    categories: ['defi'],
    trending: false,
    color: '#12AAFF',
    blurb:
      'The leading optimistic rollup — scaling Ethereum with low fees and deep DeFi liquidity.',
  },
  {
    id: 'render',
    apiId: 'render-token',
    name: 'Render',
    ticker: 'RENDER',
    supply: 520_000_000,
    categories: ['ai'],
    trending: false,
    color: '#8B5CF6',
    blurb:
      'A distributed GPU marketplace turning idle compute into render power for the AI era.',
  },
  {
    id: 'aave',
    name: 'Aave',
    ticker: 'AAVE',
    supply: 15_000_000,
    categories: ['defi'],
    trending: false,
    color: '#B6509E',
    blurb:
      'The lending protocol that defined money markets — supply, borrow and earn without intermediaries.',
  },
  {
    id: 'bittensor',
    name: 'Bittensor',
    ticker: 'TAO',
    supply: 7_400_000,
    categories: ['ai'],
    trending: false,
    color: '#C2410C',
    blurb:
      'A decentralized machine-learning network where models are trained, ranked and rewarded on-chain.',
  },
  {
    id: 'dogwifhat',
    apiId: 'dogwifcoin',
    name: 'dogwifhat',
    ticker: 'WIF',
    supply: 998_000_000,
    categories: ['memes'],
    trending: false,
    color: '#FFD95E',
    blurb:
      'A shiba inu wearing a hat — one of the fastest cultural moments in the Solana ecosystem.',
  },
  {
    id: 'worldcoin',
    apiId: 'worldcoin-wld',
    name: 'Worldcoin',
    ticker: 'WLD',
    supply: 790_000_000,
    categories: ['ai'],
    trending: false,
    color: '#3B82F6',
    blurb:
      'A proof-of-humanity network pairing global identity with an AI-first digital economy.',
  },
  {
    id: 'optimism',
    name: 'Optimism',
    ticker: 'OP',
    supply: 1_280_000_000,
    categories: ['defi'],
    trending: false,
    color: '#FF0420',
    blurb:
      'An optimistic rollup on a mission to make Ethereum scalable — cheap, fast and open.',
  },
]
