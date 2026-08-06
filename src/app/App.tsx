import { BrowserRouter } from 'react-router-dom'

import { AmbientBackground } from './ambient-background'
import { AppRouter } from './router'
import { ThemeProvider } from './theme'

export function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <AmbientBackground />
        <AppRouter />
      </BrowserRouter>
    </ThemeProvider>
  )
}
