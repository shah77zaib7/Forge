import type { AiModelId, AiModelInfo } from './types'

/**
 * Client model registry — mirrors the server registry in
 * `api/oracle/lib/models.ts`. Availability comes from the server's
 * key-free report; this list is only labels + order for the selector.
 * The selected model persists locally so the choice survives reload.
 */
export const AI_MODELS: AiModelInfo[] = [
  {
    id: 'local',
    label: 'Local engine',
    provider: 'local',
    providerLabel: 'Local',
    description: 'Deterministic Forge Liquidity Model — no external API',
  },
  {
    id: 'claude-opus-5',
    label: 'Claude Opus 5',
    provider: 'anthropic',
    providerLabel: 'Anthropic',
    description: 'Anthropic frontier — via AgentRouter or direct key',
  },
  {
    id: 'claude-opus-4-8',
    label: 'Claude Opus 4.8',
    provider: 'anthropic',
    providerLabel: 'Anthropic',
    description: 'Anthropic — via AgentRouter or direct key',
  },
  {
    id: 'gpt-5-6',
    label: 'GPT-5.6',
    provider: 'openai',
    providerLabel: 'OpenAI',
    description: 'OpenAI — via AgentRouter or direct key',
  },
  {
    id: 'gemini',
    label: 'Gemini',
    provider: 'gemini',
    providerLabel: 'Gemini',
    description: 'Google — independent GEMINI_API_KEY',
  },
  {
    id: 'agentrouter',
    label: 'AgentRouter',
    provider: 'agentrouter',
    providerLabel: 'AgentRouter',
    description: 'Multi-model gateway — single AGENTROUTER_API_KEY',
  },
]

const STORAGE_KEY = 'forge.oracle.model'

const MODEL_IDS = new Set<AiModelId>(AI_MODELS.map((model) => model.id))

export function isAiModelId(value: string): value is AiModelId {
  return MODEL_IDS.has(value as AiModelId)
}

/** The persisted model id, or 'local' when unset/unreadable/invalid. */
export function loadSelectedModel(): AiModelId {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored && isAiModelId(stored)) return stored
  } catch {
    /* storage unavailable — fall through to the default */
  }
  return 'local'
}

export function persistSelectedModel(id: AiModelId): void {
  try {
    localStorage.setItem(STORAGE_KEY, id)
  } catch {
    /* storage unavailable — selection just won't survive reload */
  }
}

export function modelInfo(id: AiModelId): AiModelInfo {
  return AI_MODELS.find((model) => model.id === id) ?? AI_MODELS[0]
}
