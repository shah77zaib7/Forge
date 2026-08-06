import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'

import { cn } from '@/lib/cn'

import { navItems } from './nav'
import { Sidebar } from './sidebar'
import { TopBar } from './top-bar'

/**
 * Global layout chrome — sidebar, top bar and the offset main area.
 * Rendered once and persists across route changes; routed content
 * animates inside <main> via the keyed PageTransition in the router.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const location = useLocation()

  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('forge.sidebar-collapsed') === '1'
    } catch {
      return false
    }
  })
  const [mobileOpen, setMobileOpen] = useState(false)
  const menuButtonRef = useRef<HTMLButtonElement>(null)
  const drawerWasOpen = useRef(false)

  // Reset scroll on every route change.
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [location.pathname])

  // Remember the collapse preference.
  useEffect(() => {
    try {
      localStorage.setItem('forge.sidebar-collapsed', collapsed ? '1' : '0')
    } catch {
      /* storage unavailable — ignore */
    }
  }, [collapsed])

  // Drawer: close on Escape, lock body scroll while open.
  useEffect(() => {
    if (!mobileOpen) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileOpen(false)
    }
    const previousOverflow = document.body.style.overflow
    document.addEventListener('keydown', onKeyDown)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [mobileOpen])

  // Drawer focus management: move focus into the drawer on open,
  // restore it to the trigger on close.
  useEffect(() => {
    if (mobileOpen) {
      drawerWasOpen.current = true
      const firstLink = document.querySelector<HTMLElement>('#forge-sidebar a')
      firstLink?.focus()
    } else if (drawerWasOpen.current) {
      drawerWasOpen.current = false
      menuButtonRef.current?.focus()
    }
  }, [mobileOpen])

  const current = navItems.find((item) => item.to === location.pathname)
  const currentLabel =
    location.pathname === '/design-system' ? 'Design System' : (current?.label ?? 'Workspace')

  return (
    <div className="min-h-screen">
      <Sidebar
        collapsed={collapsed}
        mobileOpen={mobileOpen}
        onToggleCollapse={() => setCollapsed((value) => !value)}
        onNavigate={() => setMobileOpen(false)}
      />

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            key="nav-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={() => setMobileOpen(false)}
            aria-hidden
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          />
        )}
      </AnimatePresence>

      <div
        className={cn(
          'transition-[padding-left] duration-300 ease-smooth',
          collapsed ? 'lg:pl-[7.25rem]' : 'lg:pl-[17.5rem]',
        )}
      >
        <TopBar
          onMenuClick={() => setMobileOpen(true)}
          currentLabel={currentLabel}
          mobileOpen={mobileOpen}
          menuButtonRef={menuButtonRef}
        />
        <main className="px-4 pb-20 pt-4 sm:px-6 lg:px-8 lg:pt-6">{children}</main>
      </div>
    </div>
  )
}
