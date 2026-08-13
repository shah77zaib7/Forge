import { AccountSection } from './components/account-section'
import { AppearanceSection } from './components/appearance-section'
import { ForgeV2Section } from './components/forge-v2-section'
import { MarketPreferencesSection } from './components/market-preferences-section'
import { NotificationsSection } from './components/notifications-section'
import { OraclePreferencesSection } from './components/oracle-preferences-section'
import { ProfileSection } from './components/profile-section'

/**
 * Settings — Forge's V1 preferences surface. Choices persist locally and
 * drive the rest of the app (theme, Oracle persona, default windows) via
 * the shared preferences store. Account & API rows are structured for a
 * future backend/env config layer; secrets never render.
 */
export function SettingsPage() {
  return (
    <div className="mx-auto max-w-3xl pb-16">
      <header className="pb-8">
        <p className="mb-3 text-xs font-medium uppercase tracking-[0.18em] text-faint">Workspace</p>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">Settings</h1>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted">
          Workspace preferences, Oracle behavior and account connections.
        </p>
      </header>

      <div className="space-y-6">
        <ProfileSection />
        <AppearanceSection />
        <ForgeV2Section />
        <MarketPreferencesSection />
        <OraclePreferencesSection />
        <NotificationsSection />
        <AccountSection />
      </div>
    </div>
  )
}
