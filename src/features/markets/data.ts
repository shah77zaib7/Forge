import type { CategoryId, Coin, MarketFilterOption } from './types'

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
/* Deterministic sparkline series — stable per coin, no re-render jitter */
/* ------------------------------------------------------------------ */

function mulberry32(seed: number) {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function makeSpark(seed: number, drift: number, points = 24): number[] {
  const rand = mulberry32(seed)
  let value = 50
  const series: number[] = []
  for (let i = 0; i < points; i++) {
    value += (rand() - 0.46) * 7 + drift
    series.push(value)
  }
  return series
}

/* ------------------------------------------------------------------ */
/* Universe — sorted by market cap                                     */
/* ------------------------------------------------------------------ */

export const coins: Coin[] = [
  {
    id: 'bitcoin',
    name: 'Bitcoin',
    ticker: 'BTC',
    price: 141280,
    change24h: 2.34,
    marketCap: 2_790_000_000_000,
    volume24h: 42_100_000_000,
    supply: 19_750_000,
    categories: ['l1'],
    trending: true,
    color: '#F7931A',
    spark: makeSpark(11, 0.22),
    blurb:
      'The original digital asset — a store of value secured by the largest and most battle-tested network in the industry.',
  },
  {
    id: 'ethereum',
    name: 'Ethereum',
    ticker: 'ETH',
    price: 8942,
    change24h: 1.85,
    marketCap: 1_080_000_000_000,
    volume24h: 28_400_000_000,
    supply: 120_400_000,
    categories: ['l1'],
    trending: true,
    color: '#627EEA',
    spark: makeSpark(22, 0.18),
    blurb:
      'The settlement layer for decentralized finance, smart contracts and the vast majority of on-chain activity.',
  },
  {
    id: 'tether',
    name: 'Tether',
    ticker: 'USDT',
    price: 1.0,
    change24h: 0.01,
    marketCap: 148_000_000_000,
    volume24h: 62_000_000_000,
    supply: 148_000_000_000,
    categories: ['stable'],
    trending: false,
    color: '#26A17B',
    spark: makeSpark(33, 0.002),
    blurb:
      'A dollar-pegged stablecoin — the liquidity backbone of most global crypto pairs.',
  },
  {
    id: 'solana',
    name: 'Solana',
    ticker: 'SOL',
    price: 312.4,
    change24h: 4.12,
    marketCap: 148_000_000_000,
    volume24h: 6_900_000_000,
    supply: 474_000_000,
    categories: ['l1'],
    trending: true,
    color: '#9945FF',
    spark: makeSpark(44, 0.35),
    blurb:
      'A high-throughput layer-1 built for speed — the home of consumer apps and high-frequency markets.',
  },
  {
    id: 'bnb',
    name: 'BNB',
    ticker: 'BNB',
    price: 1245,
    change24h: -0.62,
    marketCap: 181_000_000_000,
    volume24h: 2_100_000_000,
    supply: 145_600_000,
    categories: ['l1'],
    trending: false,
    color: '#F3BA2F',
    spark: makeSpark(55, -0.06),
    blurb:
      'The native asset of the BNB Chain ecosystem — exchange utility, staking and gas all in one.',
  },
  {
    id: 'xrp',
    name: 'XRP',
    ticker: 'XRP',
    price: 2.84,
    change24h: 3.01,
    marketCap: 163_000_000_000,
    volume24h: 4_800_000_000,
    supply: 57_500_000_000,
    categories: ['l1'],
    trending: false,
    color: '#00AAE4',
    spark: makeSpark(66, 0.28),
    blurb:
      'A payments-focused network built for fast, low-cost cross-border settlement.',
  },
  {
    id: 'usd-coin',
    name: 'USD Coin',
    ticker: 'USDC',
    price: 1.0,
    change24h: 0.0,
    marketCap: 41_200_000_000,
    volume24h: 9_800_000_000,
    supply: 41_200_000_000,
    categories: ['stable'],
    trending: false,
    color: '#2775CA',
    spark: makeSpark(77, 0),
    blurb:
      'A regulated dollar-pegged stablecoin issued by Circle, redeemable one-for-one.',
  },
  {
    id: 'cardano',
    name: 'Cardano',
    ticker: 'ADA',
    price: 1.42,
    change24h: -1.24,
    marketCap: 50_900_000_000,
    volume24h: 1_200_000_000,
    supply: 35_900_000_000,
    categories: ['l1'],
    trending: false,
    color: '#0033AD',
    spark: makeSpark(88, -0.12),
    blurb:
      'A research-driven proof-of-stake network known for its methodical, peer-reviewed upgrades.',
  },
  {
    id: 'dogecoin',
    name: 'Dogecoin',
    ticker: 'DOGE',
    price: 0.328,
    change24h: 5.67,
    marketCap: 48_200_000_000,
    volume24h: 3_400_000_000,
    supply: 147_000_000_000,
    categories: ['memes'],
    trending: true,
    color: '#C2A633',
    spark: makeSpark(99, 0.4),
    blurb:
      'The original meme coin — a friendly community asset with surprising staying power.',
  },
  {
    id: 'avalanche',
    name: 'Avalanche',
    ticker: 'AVAX',
    price: 68.4,
    change24h: 2.1,
    marketCap: 27_800_000_000,
    volume24h: 980_000_000,
    supply: 406_000_000,
    categories: ['l1'],
    trending: false,
    color: '#E84142',
    spark: makeSpark(110, 0.2),
    blurb:
      'A multi-chain platform built for near-instant finality and enterprise-scale subnets.',
  },
  {
    id: 'shiba-inu',
    name: 'Shiba Inu',
    ticker: 'SHIB',
    price: 0.0000412,
    change24h: 8.2,
    marketCap: 24_300_000_000,
    volume24h: 1_100_000_000,
    supply: 589_000_000_000_000,
    categories: ['memes'],
    trending: false,
    color: '#FFA409',
    spark: makeSpark(121, 0.55),
    blurb:
      'The self-styled dogecoin killer — an enormous, community-driven meme ecosystem.',
  },
  {
    id: 'polkadot',
    name: 'Polkadot',
    ticker: 'DOT',
    price: 12.6,
    change24h: 1.4,
    marketCap: 19_100_000_000,
    volume24h: 640_000_000,
    supply: 1_520_000_000,
    categories: ['l1'],
    trending: false,
    color: '#E6007A',
    spark: makeSpark(132, 0.12),
    blurb:
      'A sharded multichain protocol connecting specialized blockchains into one interoperable network.',
  },
  {
    id: 'chainlink',
    name: 'Chainlink',
    ticker: 'LINK',
    price: 28.75,
    change24h: -0.85,
    marketCap: 18_100_000_000,
    volume24h: 840_000_000,
    supply: 630_000_000,
    categories: ['defi'],
    trending: false,
    color: '#2A5ADA',
    spark: makeSpark(143, -0.08),
    blurb:
      'The industry-standard oracle network feeding real-world data to smart contracts everywhere.',
  },
  {
    id: 'near',
    name: 'NEAR Protocol',
    ticker: 'NEAR',
    price: 12.85,
    change24h: 3.4,
    marketCap: 15_200_000_000,
    volume24h: 720_000_000,
    supply: 1_180_000_000,
    categories: ['l1'],
    trending: false,
    color: '#111111',
    spark: makeSpark(154, 0.3),
    blurb:
      'A sharded, human-readable layer-1 — fast finality and an interface designed for newcomers.',
  },
  {
    id: 'uniswap',
    name: 'Uniswap',
    ticker: 'UNI',
    price: 18.3,
    change24h: 0.95,
    marketCap: 11_000_000_000,
    volume24h: 310_000_000,
    supply: 600_000_000,
    categories: ['defi'],
    trending: false,
    color: '#FF007A',
    spark: makeSpark(165, 0.09),
    blurb:
      'The governance token of the largest decentralized exchange — automated liquidity, zero order books.',
  },
  {
    id: 'pepe',
    name: 'Pepe',
    ticker: 'PEPE',
    price: 0.0000231,
    change24h: 12.5,
    marketCap: 9_700_000_000,
    volume24h: 980_000_000,
    supply: 420_000_000_000_000,
    categories: ['memes'],
    trending: true,
    color: '#54A552',
    spark: makeSpark(176, 0.8),
    blurb:
      'A deflationary meme coin honoring an internet legend — fast, chaotic and fiercely loved.',
  },
  {
    id: 'fetch-ai',
    name: 'Fetch.ai',
    ticker: 'FET',
    price: 3.45,
    change24h: 1.2,
    marketCap: 8_900_000_000,
    volume24h: 320_000_000,
    supply: 2_580_000_000,
    categories: ['ai'],
    trending: false,
    color: '#06B6D4',
    spark: makeSpark(187, 0.11),
    blurb:
      'An AI network for autonomous agents — coordination, machine learning and data markets on-chain.',
  },
  {
    id: 'arbitrum',
    name: 'Arbitrum',
    ticker: 'ARB',
    price: 2.05,
    change24h: 0.7,
    marketCap: 7_100_000_000,
    volume24h: 260_000_000,
    supply: 3_500_000_000,
    categories: ['defi'],
    trending: false,
    color: '#12AAFF',
    spark: makeSpark(198, 0.06),
    blurb:
      'The leading optimistic rollup — scaling Ethereum with low fees and deep DeFi liquidity.',
  },
  {
    id: 'render',
    name: 'Render',
    ticker: 'RENDER',
    price: 12.1,
    change24h: 2.9,
    marketCap: 6_300_000_000,
    volume24h: 240_000_000,
    supply: 520_000_000,
    categories: ['ai'],
    trending: false,
    color: '#8B5CF6',
    spark: makeSpark(209, 0.26),
    blurb:
      'A distributed GPU marketplace turning idle compute into render power for the AI era.',
  },
  {
    id: 'aave',
    name: 'Aave',
    ticker: 'AAVE',
    price: 412,
    change24h: -2.3,
    marketCap: 6_200_000_000,
    volume24h: 190_000_000,
    supply: 15_000_000,
    categories: ['defi'],
    trending: false,
    color: '#B6509E',
    spark: makeSpark(220, -0.2),
    blurb:
      'The lending protocol that defined money markets — supply, borrow and earn without intermediaries.',
  },
  {
    id: 'bittensor',
    name: 'Bittensor',
    ticker: 'TAO',
    price: 780,
    change24h: -0.4,
    marketCap: 5_800_000_000,
    volume24h: 180_000_000,
    supply: 7_400_000,
    categories: ['ai'],
    trending: false,
    color: '#C2410C',
    spark: makeSpark(231, -0.04),
    blurb:
      'A decentralized machine-learning network where models are trained, ranked and rewarded on-chain.',
  },
  {
    id: 'dogwifhat',
    name: 'dogwifhat',
    ticker: 'WIF',
    price: 4.85,
    change24h: -3.2,
    marketCap: 4_800_000_000,
    volume24h: 310_000_000,
    supply: 998_000_000,
    categories: ['memes'],
    trending: false,
    color: '#FFD95E',
    spark: makeSpark(242, -0.3),
    blurb:
      'A shiba inu wearing a hat — one of the fastest cultural moments in the Solana ecosystem.',
  },
  {
    id: 'worldcoin',
    name: 'Worldcoin',
    ticker: 'WLD',
    price: 5.6,
    change24h: -1.8,
    marketCap: 4_400_000_000,
    volume24h: 150_000_000,
    supply: 790_000_000,
    categories: ['ai'],
    trending: false,
    color: '#3B82F6',
    spark: makeSpark(253, -0.16),
    blurb:
      'A proof-of-humanity network pairing global identity with an AI-first digital economy.',
  },
  {
    id: 'optimism',
    name: 'Optimism',
    ticker: 'OP',
    price: 3.12,
    change24h: -1.1,
    marketCap: 4_000_000_000,
    volume24h: 210_000_000,
    supply: 1_280_000_000,
    categories: ['defi'],
    trending: false,
    color: '#FF0420',
    spark: makeSpark(264, -0.1),
    blurb:
      'An optimistic rollup on a mission to make Ethereum scalable — cheap, fast and open.',
  },
]
