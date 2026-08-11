/**
 * Build the single Oracle Serverless Function as a self-contained bundle.
 *
 * WHY: Vercel's zero-config `@vercel/node` builder (the older platform
 * version) transpiles `api/*.ts` WITHOUT bundling and packages only the
 * `api/` directory into the lambda. The result was a deployed ESM
 * `api/oracle.js` that still imported `../server/oracle/handler` — an
 * extensionless relative path that (a) doesn't exist in `/var/task` and
 * (b) ESM refuses to resolve. Hence the production crash:
 *
 *   ERR_MODULE_NOT_FOUND: Cannot find module '/var/task/server/oracle/handler'
 *
 * FIX: `api/oracle.js` is now a COMMITTED esbuild bundle of
 * `server/oracle/entry.ts` with every internal module inlined — only
 * `node:` builtins stay external. The deployed artifact has zero relative
 * imports, so it runs identically under every builder version and no
 * `server/` files need to exist in `/var/task`. `api/` holds exactly ONE
 * file (the bundle), so exactly ONE Function is detected on any plan.
 *
 * `npm run build` regenerates the bundle so it can never drift from the
 * `server/oracle/**` sources; the regenerated file is committed.
 */
import { build } from 'esbuild'
import { statSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const entry = join(root, 'server', 'oracle', 'entry.ts')
const outfile = join(root, 'api', 'oracle.js')

const result = await build({
  entryPoints: [entry],
  write: false,
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node18',
  sourcemap: false,
  minify: false,
  logLevel: 'info',
})

// Hard safety checks on the artifact that will actually deploy.
const output = result.outputFiles?.[0]?.text
if (!output) {
  throw new Error('bundle-oracle: esbuild produced no output — aborting')
}
if (/from\s+['"]\.\.?\//.test(output)) {
  throw new Error('bundle-oracle: relative import left in the bundle — aborting')
}
if (/@vercel\/node/.test(output)) {
  throw new Error('bundle-oracle: @vercel/node leaked into the bundle — aborting')
}
if (!/export\s+default|as default/.test(output)) {
  throw new Error('bundle-oracle: bundle has no default export — aborting')
}
writeFileSync(outfile, output)

const kb = Math.round(statSync(outfile).size / 1024)
console.log(`bundle-oracle: ${outfile} (${kb} KB, self-contained)`)
