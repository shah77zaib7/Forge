import { motion } from 'framer-motion'
import { ChevronsLeft, ChevronsRight, Palette, X } from 'lucide-react'
import { NavLink } from 'react-router-dom'

import { Brand } from '@/components/brand'
import { cn } from '@/lib/cn'
import { playForgeInteraction } from '@/lib/ui-sound'

import { navItems, settingsItem, type NavItem } from './nav'

interface SidebarProps {
  collapsed: boolean
  mobileOpen: boolean
  onToggleCollapse: () => void
  onNavigate: () => void
}

interface SidebarLinkProps extends NavItem {
  collapsed: boolean
  onNavigate: () => void
}

function SidebarLink({ to, label, icon: Icon, collapsed, onNavigate }: SidebarLinkProps) {
  return (
    <NavLink
      to={to}
      onClick={() => {
        playForgeInteraction()
        onNavigate()
      }}
      title={collapsed ? label : undefined}
      className={({ isActive }) =>
        cn(
          'group relative flex h-10 items-center gap-3 rounded-full px-4 text-sm font-medium outline-none transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-tint/30',
          collapsed && 'lg:gap-0 lg:justify-center lg:px-0',
          isActive ? 'text-foreground' : 'text-muted hover:text-foreground',
        )
      }
    >
      {({ isActive }) => (
        <>
          {isActive && (
            <motion.span
              layoutId="nav-active-pill"
              transition={{ type: 'spring', bounce: 0.15, duration: 0.5 }}
              className="absolute inset-0 rounded-full border border-border-strong bg-tint/[0.09] shadow-inset-top"
            />
          )}
          <Icon
            size={18}
            strokeWidth={1.75}
            className={cn(
              'relative z-10 shrink-0 transition-colors duration-200',
              isActive ? 'text-foreground' : 'text-muted group-hover:text-foreground',
            )}
          />
          <span className={cn('relative z-10 whitespace-nowrap', collapsed && 'lg:hidden')}>
            {label}
          </span>
        </>
      )}
    </NavLink>
  )
}

/**
 * The floating liquid-glass sidebar.
 * - Desktop: fixed, floating card; collapses to an icon rail.
 * - Mobile: slides in as a drawer above a blurred backdrop.
 * A single instance handles both, so the active pill and all
 * transitions stay consistent across breakpoints.
 */
export function Sidebar({ collapsed, mobileOpen, onToggleCollapse, onNavigate }: SidebarProps) {
  return (
    <aside
      id="forge-sidebar"
      tabIndex={-1}
      className={cn(
        'fixed left-4 top-4 bottom-4 z-50 flex w-60 flex-col rounded-hero glass outline-none transition-[width,translate,transform] duration-300 ease-smooth',
        collapsed && 'lg:w-[76px]',
        mobileOpen ? 'max-lg:translate-x-0' : 'max-lg:-translate-x-[calc(100%_+_2rem)]',
        'lg:translate-x-0',
      )}
    >
      <button
        type="button"
        onClick={onToggleCollapse}
        title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        className="absolute -right-4 top-1/2 z-10 hidden size-7 -translate-y-1/2 items-center justify-center rounded-full glass-strong text-muted transition-colors duration-200 hover:text-foreground lg:flex"
      >
        {collapsed ? <ChevronsRight size={14} /> : <ChevronsLeft size={14} />}
      </button>

      <div
        className={cn(
          'flex h-16 shrink-0 items-center px-4',
          collapsed && 'lg:justify-center lg:px-0',
        )}
      >
        <Brand compact={collapsed} />
        <button
          type="button"
          onClick={onNavigate}
          aria-label="Close navigation"
          className="ml-auto flex size-8 items-center justify-center rounded-full text-muted transition-colors duration-200 hover:bg-tint/[0.06] hover:text-foreground lg:hidden"
        >
          <X size={16} />
        </button>
      </div>

      <nav aria-label="Main" className="flex flex-1 flex-col gap-1 overflow-y-auto px-4 py-4">
        <p
          className={cn(
            'px-2 pb-3 pt-1 text-[10px] font-medium uppercase tracking-[0.16em] text-faint',
            collapsed && 'lg:hidden',
          )}
        >
          Workspace
        </p>
        {navItems.map((item) => (
          <SidebarLink key={item.to} {...item} collapsed={collapsed} onNavigate={onNavigate} />
        ))}
      </nav>

      <footer className="shrink-0 border-t border-border p-4">
        <SidebarLink {...settingsItem} collapsed={collapsed} onNavigate={onNavigate} />
        <NavLink
          to="/design-system"
          onClick={() => {
            playForgeInteraction()
            onNavigate()
          }}
          title={collapsed ? 'Design System' : undefined}
          className={cn(
            'mt-2 flex h-8 items-center gap-2 rounded-full px-4 text-xs text-faint transition-colors duration-200 hover:bg-tint/[0.04] hover:text-foreground',
            collapsed && 'lg:justify-center lg:gap-0 lg:px-0',
          )}
        >
          <Palette size={14} strokeWidth={1.75} className="shrink-0" />
          <span className={cn('whitespace-nowrap', collapsed && 'lg:hidden')}>Design System</span>
        </NavLink>
      </footer>
    </aside>
  )
}
