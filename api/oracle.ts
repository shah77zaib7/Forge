import type { VercelRequest, VercelResponse } from '@vercel/node'

import { handleOracle } from '../server/oracle/handler'

/**
 * The single Oracle Serverless Function — `/api/oracle`.
 *
 *   GET  → key-free model availability
 *   POST → { action: 'models' } | { action: 'analyze', … }
 *
 * All routing (AgentRouter / Anthropic / OpenAI / Gemini), prompt building,
 * normalization, cost and errors live in `server/oracle/**` — ordinary
 * modules imported here, NEVER separate Function entry points. Keeping this
 * directory to exactly one file means exactly one Function on Vercel, well
 * inside the Hobby plan's 12-function limit. Provider keys are read from
 * server env vars only.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  await handleOracle(req, res)
}
