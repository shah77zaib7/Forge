/**
 * The fixed ambient backdrop — soft top glow, faint corner light
 * and film grain. Sits behind all surfaces via `.ambient`.
 */
export function AmbientBackground() {
  return <div aria-hidden className="ambient" />
}
