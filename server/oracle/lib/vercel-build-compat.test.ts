import { createRequire } from 'node:module'

import { describe, expect, it } from 'vitest'

/**
 * Vercel build-compat guard.
 *
 * Vercel's `@vercel/node` builder compiles every `api/*.ts` function with
 * the PROJECT's installed `typescript`, reading configs through the legacy
 * programmatic compiler API (`ts.sys.readFile` and friends). TypeScript 7
 * is the native port: its package ships only the `tsc` CLI and DROPS that
 * API (`ts.sys`, `ts.createProgram`, `ts.transpileModule` are gone), so the
 * builder throws `Cannot read properties of undefined (reading 'readFile')`
 * before building a single function.
 *
 * Forge pins `typescript@^6.0.3` — the newest line that still ships the
 * legacy surface — so this test asserts exactly what the Vercel builder
 * needs. It fails loudly if a future dependency bump ever reintroduces a
 * TS7-style compiler (the failure would otherwise only appear inside a
 * Vercel deploy, which is exactly how this bug shipped).
 */

const require = createRequire(import.meta.url)
const ts = require('typescript') as {
  version?: string
  sys?: { readFile?: unknown; fileExists?: unknown; newLine?: unknown }
  transpileModule?: unknown
  createProgram?: unknown
  createLanguageService?: unknown
  createDocumentRegistry?: unknown
  findConfigFile?: unknown
  readConfigFile?: unknown
  parseJsonConfigFileContent?: unknown
}

describe('Vercel @vercel/node build compatibility', () => {
  it('uses a TypeScript major that ships the legacy compiler API (not the TS7 native port)', () => {
    const major = Number((ts.version ?? '').split('.')[0])
    expect(major).toBeGreaterThanOrEqual(5)
    expect(major).toBeLessThan(7)
  })

  it('exposes ts.sys.readFile — the exact call the Vercel builder crashed on', () => {
    expect(ts.sys).toBeDefined()
    expect(typeof ts.sys?.readFile).toBe('function')
    expect(typeof ts.sys?.fileExists).toBe('function')
    expect(typeof ts.sys?.newLine).toBe('string')
  })

  it('exposes the rest of the programmatic surface the builder compiles with', () => {
    expect(typeof ts.transpileModule).toBe('function')
    expect(typeof ts.createProgram).toBe('function')
    expect(typeof ts.createLanguageService).toBe('function')
    expect(typeof ts.createDocumentRegistry).toBe('function')
    expect(typeof ts.findConfigFile).toBe('function')
    expect(typeof ts.readConfigFile).toBe('function')
    expect(typeof ts.parseJsonConfigFileContent).toBe('function')
  })
})
