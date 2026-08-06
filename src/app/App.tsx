import { BrowserRouter } from 'react-router-dom'
import { Analytics } from '@vercel/analytics/react'

import { AmbientBackground } from './ambient-background'
import { AppRouter } from './router'
import { ThemeProvider } from './theme'

export function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <AmbientBackground />
        <AppRouter />
        <Analytics />
      </BrowserRouter>
    </ThemeProvider>
  )
}
