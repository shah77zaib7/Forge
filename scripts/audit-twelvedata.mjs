#!/usr/bin/env node
/**
 * Twelve Data availability audit — probes the REAL API with your key and
 * reports, per symbol × interval: HTTP status, credits consumed (from the
 * api-credits-used header), the first/last candle returned, or the exact
 * API error. Nothing is assumed about the plan: the API response is the
 * source of truth.
 *
 * Usage:
 *   TWELVEDATA_API_KEY=your_key node scripts/audit-twelvedata.mjs
 *   VITE_TWELVEDATA_API_KEY=your_key node scripts/audit-twelvedata.mjs --symbols XAU/USD
 *
 * Output is a markdown table you can paste into the Forge notes.
 */

// Load VITE_TWELVEDATA_API_KEY from a project .env.local if present — Node
// does not read dotfiles, but Vite does (at dev-server startup).
try {
  const envFile = new URL('../.env.local', import.meta.url)
  const content = await readFile(envFile, 'utf8')
  for (const line of content.split(/\r?\n/)) {
    const match = line.match(/^\s*VITE_TWELVEDATA_API_KEY\s*=\s*(.+)\s*$/)
    if (match) process.env.VITE_TWELVEDATA_API_KEY = match[1].trim().replace(/^['"]|['"]$/g, '')
  }
} catch {
  /* no .env.local — fall through to the process environment */
}

const KEY =
  process.env.TWELVEDATA_API_KEY ||
  process.env.VITE_TWELVEDATA_API_KEY ||
  process.argv.find((arg) => arg.startsWith('--key='))?.slice('--key='.length)

const SYMBOLS_ARG = process.argv.indexOf('--symbols')
const SYMBOLS = SYMBOLS_ARG !== -1 ? process.argv.slice(SYMBOLS_ARG + 1) : ['XAU/USD']

const INTERVALS = ['1min', '5min', '15min', '1h', '4h', '1day', '1week']
const OUTPUTSIZE = 5
const DELAY_MS = 1200 // stay well under the 8 credits/minute Basic budget

import { readFile } from 'node:fs/promises'

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

if (!KEY || KEY === 'demo') {
  console.error(
    'No usable API key found.\n' +
      'Get a free key at https://twelvedata.com/pricing, then run:\n' +
      '  TWELVEDATA_API_KEY=your_key node scripts/audit-twelvedata.mjs\n' +
      '(The public "demo" key is retired and returns 401.)',
  )
  process.exit(1)
}

const row = (cells) => `| ${cells.join(' | ')} |`

async function probe(symbol, interval) {
  const url = new URL('https://api.twelvedata.com/time_series')
  url.searchParams.set('symbol', symbol)
  url.searchParams.set('interval', interval)
  url.searchParams.set('outputsize', String(OUTPUTSIZE))
  url.searchParams.set('timezone', 'UTC')
  url.searchParams.set('apikey', KEY)

  const started = Date.now()
  let response
  try {
    response = await fetch(url)
  } catch (cause) {
    return { symbol, interval, status: 'network-error', credits: '—', detail: String(cause) }
  }
  const ms = Date.now() - started
  const creditsUsed = response.headers.get('api-credits-used') ?? '—'
  const creditsLeft = response.headers.get('api-credits-left') ?? '—'
  let detail = ''
  let first = ''
  let last = ''
  try {
    const payload = await response.json()
    if (payload.status === 'error') {
      detail = `${payload.code ?? '?'}: ${payload.message ?? 'unknown error'}`
    } else if (Array.isArray(payload.values) && payload.values.length > 0) {
      first = payload.values[0]?.datetime ?? ''
      last = payload.values[payload.values.length - 1]?.datetime ?? ''
      detail = `${payload.values.length} candles`
    } else {
      detail = 'no values'
    }
  } catch {
    detail = `non-JSON response (${response.status})`
  }
  return { symbol, interval, status: response.status, credits: `${creditsUsed}/${creditsLeft}`, first, last, detail, ms }
}

console.log(`# Twelve Data audit — ${new Date().toISOString()}`)
console.log(`Symbols: ${SYMBOLS.join(', ')} · Intervals: ${INTERVALS.join(', ')} · outputsize=${OUTPUTSIZE}`)
console.log('')
console.log(row(['Symbol', 'Interval', 'HTTP', 'Credits used/left', 'First candle (UTC)', 'Last candle (UTC)', 'Detail', 'ms']))
console.log(row(['---', '---', '---', '---', '---', '---', '---', '---']))

// Per-request credit weight = the INCREMENT in api-credits-used vs the
// previous probe (the header reports the per-minute running counter). When
// the counter resets (new minute), a fresh request counts as its weight.
const measuredWeights = {}
let previousUsed = null
for (const symbol of SYMBOLS) {
  for (const interval of INTERVALS) {
    const result = await probe(symbol, interval)
    console.log(row([result.symbol, result.interval, String(result.status), result.credits, result.first, result.last, result.detail, String(result.ms)]))
    const used = Number(result.credits.split('/')[0])
    if (Number.isFinite(used) && used > 0) {
      const increment = previousUsed !== null && used >= previousUsed ? used - previousUsed : 1
      measuredWeights[interval] = measuredWeights[interval] === undefined ? increment : Math.max(measuredWeights[interval], increment)
      previousUsed = used
    }
    await sleep(DELAY_MS)
  }
}

console.log('')
console.log('## Measured per-request credit weight (max observed increment of api-credits-used)')
for (const interval of INTERVALS) {
  console.log(`- ${interval}: ${measuredWeights[interval] ?? 'not measurable (no successful response)'}`)
}
console.log('')
console.log('Pass these numbers to estimateTwelveDataUsage({ weights }) for an exact credit forecast.')
