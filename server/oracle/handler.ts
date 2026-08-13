import type { VercelRequest, VercelResponse } from '@vercel/node'

import { OracleApiError, statusForCode } from './lib/errors'
import { availabilityReport } from './lib/models'
import { sanitizeRequest } from './lib/request'
import { routeAnalysis } from './lib/router'
import type { OracleApiErrorBody, OracleApiRequest, OracleApiResponse } from './lib/types'

/**
 * The ONE Oracle handler, served at `/api/oracle` by a single Vercel
 * Serverless Function:
 *
 *   GET  /api/oracle                     → key-free model availability report
 *   POST /api/oracle { action:'models' } → same availability report
 *   POST /api/oracle { action:'analyze', … } → normalized AI analysis
 *
 * The router dispatches to Gemini — the ONLY external AI provider.
 * This handler lives OUTSIDE `api/` on purpose: only the thin
 * `api/oracle.ts` entry is a Function, so the Hobby plan's 12-function
 * limit is never approached. Provider keys stay in server env vars and
 * never appear in any response.
 */

function respondError(res: VercelResponse, code: string, message: string, detail?: string) {
  res.status(statusForCode(code as Parameters<typeof statusForCode>[0])).json({
    ok: false,
    error: { code, message, detail },
  } satisfies OracleApiErrorBody)
}

export async function handleOracle(req: VercelRequest, res: VercelResponse): Promise<void> {
  // Availability report — cheap and idempotent, fine over GET.
  if (req.method === 'GET') {
    res.status(200).json(availabilityReport(process.env))
    return
  }

  if (req.method !== 'POST') {
    respondError(res, 'method_not_allowed', 'Use POST /api/oracle with { action: "analyze" | "models" }.')
    return
  }

  const body = (req.body ?? {}) as { action?: unknown }
  const action = typeof body.action === 'string' ? body.action : null

  if (action === 'models') {
    res.status(200).json(availabilityReport(process.env))
    return
  }

  if (action !== 'analyze') {
    respondError(res, 'bad_request', "Unknown Oracle action — expected \"analyze\" or \"models\".")
    return
  }

  let request: OracleApiRequest
  try {
    request = sanitizeRequest(req.body)
  } catch (cause) {
    if (cause instanceof OracleApiError) {
      respondError(res, cause.code, cause.message, cause.detail)
      return
    }
    respondError(res, 'bad_request', 'Could not read the request body.')
    return
  }

  try {
    // Bounded end-to-end: the router's providers merge their own timeout
    // with the function's remaining budget signal.
    const signal = AbortSignal.timeout(55_000)
    const { analysis, meta } = await routeAnalysis(request, process.env, signal)
    res.status(200).json({ ok: true, analysis, meta } satisfies OracleApiResponse)
  } catch (cause) {
    if (cause instanceof OracleApiError) {
      respondError(res, cause.code, cause.message, cause.detail)
      return
    }
    // Unknown server-side failure — honest 500, no details that could leak.
    respondError(res, 'service_unavailable', 'Oracle could not complete the analysis.')
  }
}
