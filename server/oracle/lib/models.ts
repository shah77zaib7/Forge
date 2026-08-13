/**
 * Server-side Oracle model registry — the ONLY place provider/model ids live.
 *
 * Oracle ships exactly two engines: the deterministic Local engine
 * (client-side, always available) and Gemini (server-side, GEMINI_API_KEY).
 * Gemini is the ONLY external AI provider — there is no gateway chain and no
 * fallback. If GEMINI_API_KEY is missing, Gemini reports honestly
 * unavailable and any request for it errors; Oracle never substitutes Local
 * (or anything else) for a failed Gemini call.
 *
 * Availability = the provider's key is configured. Keys are read from
 * process.env and NEVER logged, returned, or embedded in responses.
 */

export type OracleProviderId = 'local' | 'gemini'

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
  gemini: 'GEMINI_API_KEY',
}

/**
 * The registry. Model ids are data, not scattered literals: adjust an entry
 * here if a provider changes its naming.
 */
export function oracleModels(): OracleModelEntry[] {
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
      id: 'gemini',
      provider: 'gemini',
      label: 'Gemini',
      // gemini-2.5-pro is retired for new users (verified: HTTP 404 "no
      // longer available to new users"). gemini-3.6-flash is a current
      // STABLE model on the official Gemini API models page.
      modelId: 'gemini-3.6-flash',
      via: ['gemini'],
      description: 'Google — independent GEMINI_API_KEY',
    },
  ]
}

export function oracleModelById(id: string): OracleModelEntry | null {
  return oracleModels().find((model) => model.id === id) ?? null
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
    case 'gemini':
      return 'Gemini'
  }
}

/** Which keys are missing for a model — safe to show in the UI. */
export function missingKeysFor(entry: OracleModelEntry): string[] {
  return entry.via.filter((provider): provider is Exclude<OracleProviderId, 'local'> => provider !== 'local').map((provider) => PROVIDER_KEYS[provider])
}

/**
 * The public availability report — served by GET /api/oracle (and POST
 * action: 'models'). Never contains key values, only which key NAMES are
 * configured.
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
    models: oracleModels().map((entry) => {
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
