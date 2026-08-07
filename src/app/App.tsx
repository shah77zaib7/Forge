import { MotionConfig } from 'framer-motion'
import { BrowserRouter } from 'react-router-dom'

import { AmbientBackground } from './ambient-background'
import { AppRouter } from './router'
import { ThemeProvider } from './theme'

export function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        {/* With reducedMotion="user", transform & layout animations are
            skipped for users who prefer reduced motion — opacity fades
            remain so content never pops abruptly. */}
        <MotionConfig reducedMotion="user">
          <AmbientBackground />
          <AppRouter />
        </MotionConfig>
      </BrowserRouter>
    </ThemeProvider>
  )
}
