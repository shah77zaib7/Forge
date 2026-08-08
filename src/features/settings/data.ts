/* ============================================================
   Settings configuration surface — V1 mock values. The provider
   lists and connection states are structured so real environment
   config can be read from a backend/env layer later; secrets are
   never rendered, only masked placeholders.
   ============================================================ */

export interface Option {
  value: string
  label: string
}

export const aiProviders: Option[] = [
  { value: 'openai', label: 'OpenAI' },
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'gemini', label: 'Google Gemini' },
  { value: 'local', label: 'Local model' },
]

export const marketDataProviders: Option[] = [
  { value: 'mock', label: 'Forge mock feed' },
  { value: 'coinbase', label: 'Coinbase Exchange' },
  { value: 'binance', label: 'Binance' },
  { value: 'coingecko', label: 'CoinGecko' },
]

export interface ConnectedService {
  id: string
  name: string
  description: string
  connected: boolean
}

export const connectedServices: ConnectedService[] = [
  { id: 'sync', name: 'Forge Sync', description: 'Workspace sync & backup', connected: true },
  { id: 'exchange', name: 'Exchange API', description: 'Read-only market data', connected: false },
  { id: 'ai', name: 'AI provider', description: 'Oracle inference', connected: false },
]
