import { motion } from 'framer-motion'
import { AlertCircle, Camera, CheckCircle2, Loader2, Trash2 } from 'lucide-react'
import { useRef, useState, type ChangeEvent } from 'react'

import { Button } from '@/components/ui/button'
import { fileToAvatarDataUrl } from '@/lib/avatar'
import { cn } from '@/lib/cn'
import { useProfile } from '@/store/profile'

import { SectionCard } from './setting-row'

/** The displayed avatar — photo, pending preview, or the name's initial. */
function AvatarImage({
  src,
  initial,
  size = 'lg',
}: {
  src: string | null
  initial: string
  size?: 'sm' | 'lg'
}) {
  const cls =
    size === 'lg'
      ? 'size-20 rounded-full border border-border bg-tint/[0.08] text-2xl'
      : 'size-9 rounded-full border border-border bg-tint/[0.08] text-xs'

  if (src) {
    return <img src={src} alt="" className={cn(cls, 'object-cover')} />
  }
  return (
    <span
      aria-hidden
      className={cn('flex items-center justify-center font-medium text-foreground', cls)}
    >
      {initial}
    </span>
  )
}

type StagedAvatar = { kind: 'set'; dataUrl: string } | { kind: 'remove' } | null

/** Profile — avatar, display name and account info, saved through the shared store. */
export function ProfileSection() {
  const { profile, updateProfile, saveAvatar, removeAvatar } = useProfile()
  const [nameDraft, setNameDraft] = useState(profile.displayName)
  const [staged, setStaged] = useState<StagedAvatar>(null)
  const [busy, setBusy] = useState(false) // file processing or saving
  const [status, setStatus] = useState<{ kind: 'success' | 'error'; text: string } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const hasPhoto = profile.avatar !== null
  const trimmedName = nameDraft.trim()
  const dirty = trimmedName !== profile.displayName || staged !== null

  function clearStatus() {
    setStatus(null)
  }

  function handlePick(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    // Reset the input so picking the same file again re-triggers change.
    event.target.value = ''
    if (!file) return
    clearStatus()
    setBusy(true)
    fileToAvatarDataUrl(file)
      .then((dataUrl) => {
        setStaged({ kind: 'set', dataUrl })
        setBusy(false)
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : 'Could not read that image. Try again.'
        setStatus({ kind: 'error', text: message })
        setBusy(false)
      })
  }

  function handleSave() {
    if (!dirty || !trimmedName || busy) return
    clearStatus()
    setBusy(true)
    // Brief simulated save so the loading state reads clearly; the store
    // write itself is synchronous localStorage in V1.
    window.setTimeout(() => {
      updateProfile({ displayName: trimmedName })
      if (staged?.kind === 'set') saveAvatar(staged.dataUrl)
      if (staged?.kind === 'remove') removeAvatar()
      setStaged(null)
      setBusy(false)
      setStatus({ kind: 'success', text: 'Profile saved.' })
    }, 500)
  }

  // Which image to show: a staged preview wins, then the saved photo,
  // then the initial fallback.
  const previewSrc =
    staged?.kind === 'set' ? staged.dataUrl : staged?.kind === 'remove' ? null : profile.avatar
  const initial = (trimmedName || profile.displayName).charAt(0).toUpperCase() || 'F'
  const showRemove = hasPhoto || staged !== null

  return (
    <SectionCard overline="Profile" title="Your Profile">
      <div className="flex flex-wrap items-center gap-5 py-4">
        <div className="group relative shrink-0">
          <AvatarImage src={previewSrc} initial={initial} />
          <button
            type="button"
            aria-label="Change photo"
            onClick={() => fileRef.current?.click()}
            className="absolute inset-0 flex items-end justify-center rounded-full bg-black/45 pb-2 text-[10px] font-medium text-white opacity-0 backdrop-blur-[1px] transition-opacity duration-200 group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100 focus-visible:outline-none"
          >
            <Camera size={14} strokeWidth={1.75} aria-hidden />
          </button>
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold tracking-tight text-foreground">{trimmedName || '—'}</p>
          <p className="mt-0.5 text-xs text-faint">{profile.email}</p>
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            <Button size="sm" variant="secondary" onClick={() => fileRef.current?.click()}>
              <Camera size={13} strokeWidth={1.75} />
              Change photo
            </Button>
            {showRemove && (
              <Button size="sm" variant="ghost" onClick={() => setStaged({ kind: 'remove' })}>
                <Trash2 size={13} strokeWidth={1.75} />
                Remove photo
              </Button>
            )}
          </div>
        </div>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handlePick}
        className="hidden"
        aria-label="Upload profile photo"
      />

      <div className="border-t border-border/60 pt-4">
        <label htmlFor="profile-display-name" className="text-[11px] font-medium uppercase tracking-[0.14em] text-faint">
          Display name
        </label>
        <input
          id="profile-display-name"
          type="text"
          value={nameDraft}
          onChange={(event) => {
            setNameDraft(event.target.value)
            clearStatus()
          }}
          placeholder="Your name"
          maxLength={40}
          className="mt-2 h-10 w-full rounded-control border border-border bg-tint/[0.04] px-3.5 text-sm text-foreground outline-none transition-colors duration-200 placeholder:text-faint hover:border-border-strong focus-visible:border-border-strong focus-visible:ring-2 focus-visible:ring-tint/30"
        />
        <p className="mt-1.5 text-xs text-faint">Shown across Forge; your initial appears when there is no photo.</p>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button size="sm" onClick={handleSave} disabled={!dirty || !trimmedName || busy}>
            {busy && <Loader2 size={13} strokeWidth={1.75} className="animate-spin" aria-hidden />}
            {busy ? 'Saving…' : 'Save changes'}
          </Button>

          <motion.span
            key={status ? `${status.kind}-${status.text}` : 'idle'}
            initial={status ? { opacity: 0, y: 2 } : false}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className={cn(
              'flex items-center gap-1.5 text-xs',
              status?.kind === 'success' && 'text-positive',
              status?.kind === 'error' && 'text-negative',
            )}
            role="status"
            aria-live="polite"
          >
            {status?.kind === 'success' && <CheckCircle2 size={13} strokeWidth={1.75} aria-hidden />}
            {status?.kind === 'error' && <AlertCircle size={13} strokeWidth={1.75} aria-hidden />}
            {status?.text}
          </motion.span>
        </div>
      </div>
    </SectionCard>
  )
}
