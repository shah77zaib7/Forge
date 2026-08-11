/** Typed Oracle API failure codes — surfaced verbatim to the UI. */
export type OracleErrorCode =
  | 'method_not_allowed'
  | 'bad_request'
  | 'unknown_model'
  | 'not_configured'
  | 'provider_error'
  | 'rate_limit'
  | 'timeout'
  | 'bad_model_output'
  | 'service_unavailable'

export class OracleApiError extends Error {
  readonly code: OracleErrorCode
  /** Extra, safe context (e.g. which env keys are missing). */
  readonly detail?: string

  constructor(code: OracleErrorCode, message: string, detail?: string) {
    super(message)
    this.name = 'OracleApiError'
    this.code = code
    this.detail = detail
  }
}

/** Safe HTTP status for each failure code. */
export function statusForCode(code: OracleErrorCode): number {
  switch (code) {
    case 'method_not_allowed':
    case 'bad_request':
    case 'unknown_model':
      return 400
    case 'not_configured':
      return 503
    case 'rate_limit':
      return 429
    case 'timeout':
      return 504
    default:
      return 500
  }
}
