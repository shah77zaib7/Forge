import type { VercelRequest, VercelResponse } from '@vercel/node'

import { availabilityReport } from './lib/models'

/**
 * GET /api/oracle/models — the safe availability report. Tells the client
 * which Oracle models are usable right now, which key NAMES each requires
 * (never values), and which gateway would serve them. This is public and
 * key-free by design: the client needs it to render the model selector's
 * enabled/unavailable states honestly.
 */
export default async function handler(_req: VercelRequest, res: VercelResponse) {
  res.status(200).json(availabilityReport(process.env))
}
