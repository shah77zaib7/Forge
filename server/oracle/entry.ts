import { handleOracle } from './handler'

/**
 * esbuild entry for the single Oracle Function bundle.
 *
 * This file exists ONLY as the bundling entry point — `scripts/bundle-oracle.mjs`
 * bundles it (with `server/oracle/**` inlined) into the committed
 * `api/oracle.js`, the ONE file Vercel deploys. It is not itself deployed.
 *
 * Vercel's Node runtime loads the function as ESM (`"type": "module"`), so
 * the handler is the default export — exactly what the bundle preserves.
 */
export default handleOracle
