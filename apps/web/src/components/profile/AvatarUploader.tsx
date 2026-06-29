'use client'

import { useRef, useState } from 'react'
import { Camera, Loader2, Trash2, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

interface Props {
  userId: string
  username: string | null
  displayName: string | null
  currentAvatarUrl: string | null
  onChange?: (url: string | null) => void
}

const MAX_BYTES = 2 * 1024 * 1024  // 2 MB, must match bucket setting
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const

/**
 * Avatar upload + display + remove control.
 *
 * Flow:
 *   1. User picks an image (or drops one in)
 *   2. Client validates type + size
 *   3. Direct upload to Supabase Storage at `avatars/{user_id}/{timestamp}.{ext}`
 *   4. On success, update profiles.avatar_url to the public URL
 *   5. Notify the parent via onChange so headers/sidebars can refresh
 *
 * Optimistic preview: while the upload is in flight, we show the picked file
 * as a local blob URL so the user gets immediate feedback.
 */
export function AvatarUploader({ userId, username, displayName, currentAvatarUrl, onChange }: Props) {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(currentAvatarUrl)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const initials = (displayName ?? username ?? '?')
    .split(/\s+/)
    .slice(0, 2)
    .map(s => s[0]?.toUpperCase())
    .join('') || '?'

  const displayed = previewUrl ?? avatarUrl

  async function handleFile(file: File) {
    setError(null)

    if (!ACCEPTED_TYPES.includes(file.type as typeof ACCEPTED_TYPES[number])) {
      setError('Use JPEG, PNG, or WebP')
      return
    }
    if (file.size > MAX_BYTES) {
      setError('File is too large (max 2 MB)')
      return
    }

    // Optimistic preview while we upload
    const blobUrl = URL.createObjectURL(file)
    setPreviewUrl(blobUrl)
    setUploading(true)

    try {
      const supabase = createClient()
      const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
      const path = `${userId}/${Date.now()}.${ext}`

      // Upload to Storage. RLS enforces that {user_id}/* must match auth.uid().
      const { error: uploadErr } = await supabase.storage
        .from('avatars')
        .upload(path, file, {
          cacheControl: '3600',
          upsert: false,
          contentType: file.type,
        })

      if (uploadErr) {
        throw new Error(uploadErr.message)
      }

      // Resolve the public URL (bucket is public-read)
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(path)

      // Cache-bust so the browser fetches the new image immediately
      const finalUrl = `${publicUrl}?v=${Date.now()}`

      const { error: updateErr } = await supabase
        .from('profiles')
        .update({ avatar_url: finalUrl })
        .eq('id', userId)

      if (updateErr) {
        throw new Error(updateErr.message)
      }

      setAvatarUrl(finalUrl)
      onChange?.(finalUrl)
      toast.success('Profile picture updated')
    } catch (err) {
      console.error('[AvatarUploader.upload]', err)
      setError(err instanceof Error ? err.message : 'Upload failed')
      // Roll back preview
      setPreviewUrl(null)
    } finally {
      setUploading(false)
      // Free the blob URL after the new image loads (or fails)
      window.setTimeout(() => {
        if (blobUrl) URL.revokeObjectURL(blobUrl)
        setPreviewUrl(null)
      }, 1000)
    }
  }

  async function handleRemove() {
    if (!avatarUrl) return
    if (!confirm('Remove your profile picture?')) return

    setUploading(true)
    setError(null)
    try {
      const supabase = createClient()
      const { error: updateErr } = await supabase
        .from('profiles')
        .update({ avatar_url: null })
        .eq('id', userId)

      if (updateErr) throw new Error(updateErr.message)

      // Optionally clean up the old file in storage. We do it best-effort —
      // failure here doesn't matter, the profile no longer references it.
      const oldPath = extractStoragePath(avatarUrl)
      if (oldPath) {
        await supabase.storage.from('avatars').remove([oldPath]).catch(() => {})
      }

      setAvatarUrl(null)
      onChange?.(null)
      toast.success('Profile picture removed')
    } catch (err) {
      console.error('[AvatarUploader.remove]', err)
      setError(err instanceof Error ? err.message : 'Could not remove')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-4">
        {/* Avatar preview (clickable to upload) */}
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          aria-label="Change profile picture"
          className={cn(
            'relative w-20 h-20 rounded-full bg-cream flex items-center justify-center flex-shrink-0 overflow-hidden',
            'border-2 border-white shadow-md',
            'transition-[transform,box-shadow] duration-200 ease-out',
            'hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]',
            'outline-none focus-visible:ring-2 focus-visible:ring-mint focus-visible:ring-offset-2',
            'disabled:cursor-not-allowed disabled:opacity-70',
            'group',
          )}
        >
          {displayed ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={displayed} alt="" className="w-full h-full object-cover" />
          ) : (
            <span className="font-serif text-xl font-bold text-forest">{initials}</span>
          )}

          {/* Camera overlay on hover */}
          <div
            className={cn(
              'absolute inset-0 flex items-center justify-center',
              'bg-forest/60 opacity-0 group-hover:opacity-100',
              'transition-opacity duration-200 ease-out',
            )}
          >
            <Camera className="w-5 h-5 text-white" aria-hidden />
          </div>

          {uploading && (
            <div className="absolute inset-0 flex items-center justify-center bg-forest/60">
              <Loader2 className="w-5 h-5 text-white animate-spin" aria-hidden />
            </div>
          )}
        </button>

        {/* Actions */}
        <div className="flex flex-col gap-1 items-start">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className={cn(
              'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium',
              'bg-cream text-forest hover:bg-cream-dark',
              'transition-[background-color,transform] duration-150 ease-out active:scale-[0.97]',
              'outline-none focus-visible:ring-2 focus-visible:ring-mint focus-visible:ring-offset-2',
              'disabled:opacity-60 disabled:cursor-not-allowed',
            )}
          >
            <Camera className="w-3.5 h-3.5" aria-hidden />
            {avatarUrl ? 'Change' : 'Upload'}
          </button>

          {avatarUrl && (
            <button
              type="button"
              onClick={handleRemove}
              disabled={uploading}
              className={cn(
                'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium',
                'text-gray-400 hover:text-red-500 hover:bg-red-50',
                'transition-[background-color,color] duration-150 ease-out',
                'outline-none focus-visible:ring-2 focus-visible:ring-red-300 focus-visible:ring-offset-1',
                'disabled:opacity-60 disabled:cursor-not-allowed',
              )}
            >
              <Trash2 className="w-3 h-3" aria-hidden />
              Remove
            </button>
          )}

          <p className="text-xs text-gray-400 mt-1">JPEG, PNG, or WebP. Max 2 MB.</p>
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_TYPES.join(',')}
        onChange={e => {
          const file = e.target.files?.[0]
          if (file) handleFile(file)
          // Reset so picking the same file twice re-fires onChange
          e.target.value = ''
        }}
        className="hidden"
        aria-label="Profile picture file"
      />

      {error && (
        <div className="flex items-start gap-2 text-xs text-red-500">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" aria-hidden />
          <span>{error}</span>
        </div>
      )}
    </div>
  )
}

/**
 * Pull the storage path (e.g. "userId/123.jpg") out of a Supabase public URL.
 * Returns null if the URL isn't a recognized avatar path (e.g. external avatar).
 */
function extractStoragePath(url: string): string | null {
  const match = url.match(/\/storage\/v1\/object\/public\/avatars\/(.+?)(?:\?|$)/)
  return match ? match[1] : null
}
