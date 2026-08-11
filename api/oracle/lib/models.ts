/**
 * Server-side Oracle model registry — the ONLY place provider/model ids live.
 *
 * Every entry declares which gateways can serve it, in priority order.
 * AgentRouter is the FIRST gateway for Claude/OpenAI entries (one key, many
 * models); the direct provider adapters (Anthropic/OpenAI/Gemini) remain
 * available with their own keys. Gemini is first-class and independent.
 *
 * Availability = at least one declared gateway has its key configured. The
 * router picks the first configured gateway. Keys are read from process.env
 * and NEVER logged, returned, or embedded in responses.
 */

export type OracleProviderId = 'local' | 'agentrouter' | 'anthropic' | 'openai' | 'gemini'

export interface OracleModelEntry {
  id: string
  provider: OracleProviderId
  label: string
  /** Model id sent to the provider/gateway. */
  modelId: string
  /** Gateways that can serve this model, in priority order. */
  via: OracleProviderId[]
  /** Short description for the selector menu. */
  description: string
}

/** All provider keys — env name → whether it is configured. */
export const PROVIDER_KEYS: Record<Exclude<OracleProviderId, 'local'>, string> = {
  agentrouter: 'AGENTROUTER_API_KEY',
  anthropic: 'ANTHROPIC_API_KEY',
  openai: 'OPENAI_API_KEY',
  gemini: 'GEMINI_API_KEY',
}

/** Optional model-id overrides (per provider), so aliases can be tuned. */
const MODEL_OVERRIDES: Record<string, string> = {
  anthropic: 'ANTHROPIC_MODEL',
  openai: 'OPENAI_MODEL',
  gemini: 'GEMINI_MODEL',
}

export function modelIdOverride(provider: 'anthropic' | 'openai' | 'gemini', env: NodeJS.ProcessEnv = process.env): string | null {
  const name = MODEL_OVERRIDES[provider]
  const value = env[name]?.trim()
  return value ? value : null
}

/** AgentRouter gateway base URL (OpenAI-compatible chat completions). */
export function agentRouterBaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  return env.AGENTROUTER_BASE_URL?.trim() || 'https://api.agentrouter.dev/v1'
}

/** The model id AgentRouter serves for the standalone AgentRouter entry. */
export function agentRouterModel(env: NodeJS.ProcessEnv = process.env): string {
  return env.AGENTROUTER_MODEL?.trim() || 'claude-opus-5'
}

/**
 * The registry. Model ids are data, not scattered literals: adjust an entry
 * here (or via the env overrides above) if a provider changes its naming.
 */
export function oracleModels(env: NodeJS.ProcessEnv = process.env): OracleModelEntry[] {
  return [
    {
      id: 'local',
      provider: 'local',
      label: 'Local engine',
      modelId: 'local',
      via: ['local'],
      description: 'Deterministic Forge Liquidity Model — no external API',
    },
    {
      id: 'claude-opus-5',
      provider: 'anthropic',
      label: 'Claude Opus 5',
      modelId: modelIdOverride('anthropic', env) ?? 'claude-opus-5',
      via: ['agentrouter', 'anthropic'],
      description: 'Anthropic frontier — via AgentRouter or direct key',
    },
    {
      id: 'claude-opus-4-8',
      provider: 'anthropic',
      label: 'Claude Opus 4.8',
      modelId: modelIdOverride('anthropic', env) ?? 'claude-opus-4-8',
      via: ['agentrouter', 'anthropic'],
      description: 'Anthropic — via AgentRouter or direct key',
    },
    {
      id: 'gpt-5-6',
      provider: 'openai',
      label: 'GPT-5.6',
      modelId: modelIdOverride('openai', env) ?? 'gpt-5.6',
      via: ['agentrouter', 'openai'],
      description: 'OpenAI — via AgentRouter or direct key',
    },
    {
      id: 'gemini',
      provider: 'gemini',
      label: 'Gemini',
      modelId: modelIdOverride('gemini', env) ?? 'gemini-2.5-pro',
      via: ['gemini'],
      description: 'Google — independent GEMINI_API_KEY',
    },
    {
      id: 'agentrouter',
      provider: 'agentrouter',
      label: 'AgentRouter',
      modelId: agentRouterModel(env),
      via: ['agentrouter'],
      description: 'Multi-model gateway — single AGENTROUTER_API_KEY',
    },
  ]
}

export function oracleModelById(id: string, env: NodeJS.ProcessEnv = process.env): OracleModelEntry | null {
  return oracleModels(env).find((model) => model.id === id) ?? null
}

/** True when a provider key is configured. 'local' is always available. */
export function providerConfigured(provider: OracleProviderId, env: NodeJS.ProcessEnv = process.env): boolean {
  if (provider === 'local') return true
  const keyName = PROVIDER_KEYS[provider]
  return Boolean(env[keyName]?.trim())
}

/** The first configured gateway for a model, or null. */
export function resolveGateway(entry: OracleModelEntry, env: NodeJS.ProcessEnv = process.env): OracleProviderId | null {
  for (const provider of entry.via) {
    if (providerConfigured(provider, env)) return provider
  }
  return null
}

/** Human label for a gateway/provider. */
export function providerLabel(provider: OracleProviderId): string {
  switch (provider) {
    case 'local':
      return 'Local'
    case 'agentrouter':
      return 'AgentRouter'
    case 'anthropic':
      return 'Anthropic'
    case 'openai':
      return 'OpenAI'
    case 'gemini':
      return 'Gemini'
  }
}

/** Which keys are missing for a model — safe to show in the UI. */
export function missingKeysFor(entry: OracleModelEntry): string[] {
  return entry.via.filter((provider): provider is Exclude<OracleProviderId, 'local'> => provider !== 'local').map((provider) => PROVIDER_KEYS[provider])
}

/**
 * The public availability report — served by GET /api/oracle/models. Never
 * contains key values, only which key NAMES are configured.
 */
export interface OracleModelAvailability {
  models: Array<{
    id: string
    label: string
    provider: string
    providerLabel: string
    description: string
    available: boolean
    /** Which key the user needs to configure to enable it. */
    requires: string[]
    /** Which gateway will actually serve it right now. */
    gateway: string | null
  }>
}

export function availabilityReport(env: NodeJS.ProcessEnv = process.env): OracleModelAvailability {
  return {
    models: oracleModels(env).map((entry) => {
      const gateway = resolveGateway(entry, env)
      return {
        id: entry.id,
        label: entry.label,
        provider: entry.provider,
        providerLabel: providerLabel(entry.provider),
        description: entry.description,
        available: gateway !== null,
        requires: missingKeysFor(entry),
        gateway: gateway ? providerLabel(gateway) : null,
      }
    }),
  }
}
