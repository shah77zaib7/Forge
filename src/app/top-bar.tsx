import { Bell, ChevronRight, Menu, Search } from 'lucide-react'
import type { Ref } from 'react'
import { useNavigate } from 'react-router-dom'

import { useProfile } from '@/store/profile'

import { ThemeToggle } from './theme-toggle'

interface TopBarProps {
  onMenuClick: () => void
  currentLabel: string
  mobileOpen: boolean
  menuButtonRef: Ref<HTMLButtonElement>
}

/**
 * Sticky glass top bar. On mobile it carries the menu trigger and
 * collapses the breadcrumb; on desktop it hosts search and actions.
 */
export function TopBar({ onMenuClick, currentLabel, mobileOpen, menuButtonRef }: TopBarProps) {
  const navigate = useNavigate()
  const { profile } = useProfile()
  const initial = profile.displayName.trim().charAt(0).toUpperCase() || 'F'

  return (
    <header className="sticky top-4 z-30 mb-6 flex h-14 items-center gap-2 rounded-hero glass px-4">
      <button
        type="button"
        ref={menuButtonRef}
        onClick={onMenuClick}
        aria-label="Open navigation"
        aria-expanded={mobileOpen}
        aria-controls="forge-sidebar"
        className="flex size-9 shrink-0 items-center justify-center rounded-full text-muted transition-colors duration-200 hover:bg-tint/[0.06] hover:text-foreground lg:hidden"
      >
        <Menu size={18} />
      </button>

      <div className="flex min-w-0 items-center gap-2 text-sm">
        <span className="hidden shrink-0 text-faint sm:inline">Workspace</span>
        <ChevronRight size={14} className="hidden shrink-0 text-faint sm:block" />
        <span className="truncate font-medium text-foreground">{currentLabel}</span>
      </div>

      <div className="ml-auto flex items-center gap-2">
        <button
          type="button"
          className="hidden h-9 items-center gap-2 rounded-full border border-border bg-tint/[0.04] px-4 text-xs text-muted transition-colors duration-200 hover:border-border-strong hover:bg-tint/[0.06] md:flex"
        >
          <Search size={14} strokeWidth={1.75} />
          <span>Search</span>
          <kbd className="ml-1 flex h-5 items-center rounded-md border border-border bg-tint/[0.04] px-2 font-mono text-[10px] text-faint">
            ⌘K
          </kbd>
        </button>

        <ThemeToggle />

        <button
          type="button"
          aria-label="Notifications"
          className="flex size-9 items-center justify-center rounded-full text-muted transition-colors duration-200 hover:bg-tint/[0.06] hover:text-foreground"
        >
          <Bell size={17} strokeWidth={1.75} />
        </button>

        <button
          type="button"
          aria-label="Open profile settings"
          title="Profile"
          onClick={() => navigate('/settings')}
          className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-tint/[0.08] text-xs font-medium text-foreground transition-colors duration-200 hover:border-border-strong hover:bg-tint/[0.12] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tint/30"
        >
          {profile.avatar ? (
            <img src={profile.avatar} alt="" className="size-full object-cover" />
          ) : (
            <span aria-hidden>{initial}</span>
          )}
        </button>
      </div>
    </header>
  )
}
