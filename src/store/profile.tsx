import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

export interface Profile {
  /** Display name — shown in Settings and as the avatar fallback initial. */
  displayName: string
  /** Contact email, when available. */
  email: string
  /** Avatar image as a data URL (resized/compressed on upload); null = initials. */
  avatar: string | null
}

const DEFAULTS: Profile = {
  displayName: 'Forge Trader',
  email: 'you@example.com',
  avatar: null,
}

const STORAGE_KEY = 'forge.profile'

function load(): Profile {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULTS
    const parsed = JSON.parse(raw) as Partial<Profile>
    return {
      displayName: typeof parsed.displayName === 'string' ? parsed.displayName : DEFAULTS.displayName,
      email: typeof parsed.email === 'string' ? parsed.email : DEFAULTS.email,
      avatar: typeof parsed.avatar === 'string' ? parsed.avatar : null,
    }
  } catch {
    return DEFAULTS
  }
}

interface ProfileContextValue {
  profile: Profile
  updateProfile: (patch: Partial<Profile>) => void
  saveAvatar: (dataUrl: string) => void
  removeAvatar: () => void
}

const ProfileContext = createContext<ProfileContextValue | null>(null)

/**
 * The user profile for Forge V1 — one source of truth for the display
 * name, email and avatar, mounted at the app root so the header avatar
 * and Settings stay in sync on every page. Persisted to localStorage;
 * a real auth/backend layer can replace the load/persist pair later
 * without touching consumers.
 */
export function ProfileProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<Profile>(load)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(profile))
    } catch {
      /* storage unavailable — session-only */
    }
  }, [profile])

  const updateProfile = useCallback((patch: Partial<Profile>) => {
    setProfile((previous) => ({ ...previous, ...patch }))
  }, [])

  const saveAvatar = useCallback((dataUrl: string) => {
    setProfile((previous) => ({ ...previous, avatar: dataUrl }))
  }, [])

  const removeAvatar = useCallback(() => {
    setProfile((previous) => ({ ...previous, avatar: null }))
  }, [])

  const value = useMemo(
    () => ({ profile, updateProfile, saveAvatar, removeAvatar }),
    [profile, updateProfile, saveAvatar, removeAvatar],
  )

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>
}

export function useProfile(): ProfileContextValue {
  const context = useContext(ProfileContext)
  if (!context) throw new Error('useProfile must be used within a ProfileProvider')
  return context
}
