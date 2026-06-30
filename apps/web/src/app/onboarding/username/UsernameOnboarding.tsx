'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { BookOpen, Loader2, Check, AlertCircle, Sparkles } from 'lucide-react'
import { toast } from 'sonner'

interface Props {
  initialSuggestion: string
  displayName: string | null
}

type CheckState =
  | { kind: 'idle' }
  | { kind: 'checking' }
  | { kind: 'available' }
  | { kind: 'unavailable'; reason: string }

export function UsernameOnboarding({ initialSuggestion, displayName }: Props) {
  const router = useRouter()
  const [username, setUsername] = useState(initialSuggestion)
  const [check, setCheck] = useState<CheckState>({ kind: 'idle' })
  const [submitting, setSubmitting] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined)
  const inputRef = useRef<HTMLInputElement>(null)

  // Normalize as the user types — strip uppercase/spaces, replace with dashes
  function normalize(raw: string): string {
    return raw
      .toLowerCase()
      .replace(/[^a-z0-9 -]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .slice(0, 30)
  }

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Debounced availability check
  useEffect(() => {
    clearTimeout(debounceRef.current)
    if (!username) {
      setCheck({ kind: 'idle' })
      return
    }
    setCheck({ kind: 'checking' })
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/username?check=${encodeURIComponent(username)}`)
        const data = await res.json()
        if (data.available) setCheck({ kind: 'available' })
        else setCheck({ kind: 'unavailable', reason: data.error ?? 'Not available' })
      } catch {
        setCheck({ kind: 'idle' })
      }
    }, 350)
    return () => clearTimeout(debounceRef.current)
  }, [username])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (check.kind !== 'available') return
    setSubmitting(true)
    try {
      const res = await fetch('/api/username', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'Could not claim that username')
        return
      }
      toast.success(`Welcome to Folio, @${data.username}`)
      router.push('/library')
      router.refresh()
    } catch {
      toast.error('Network error, try again')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-forest flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-6">
            <BookOpen className="w-7 h-7 text-mint" />
            <span className="font-serif text-2xl font-black text-white">
              Folio<span className="text-terra">.</span>
            </span>
          </div>
          <h1 className="font-serif text-3xl font-bold text-white mb-2">
            {displayName ? `Welcome, ${displayName.split(' ')[0]}` : 'Welcome to Folio'}
          </h1>
          <p className="text-cream/70 text-sm">
            Pick a username — it&apos;s your public profile URL.
          </p>
        </div>

        <div className="bg-white rounded-3xl p-6 shadow-2xl">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Your username</label>
              <div className="relative">
                <input
                  ref={inputRef}
                  value={username}
                  onChange={e => setUsername(normalize(e.target.value))}
                  className="input pr-10 font-mono"
                  placeholder="your-name"
                  maxLength={30}
                  autoComplete="off"
                  spellCheck={false}
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2">
                  {check.kind === 'checking' && <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />}
                  {check.kind === 'available' && <Check className="w-4 h-4 text-mint" />}
                  {check.kind === 'unavailable' && <AlertCircle className="w-4 h-4 text-terra" />}
                </span>
              </div>
              <div className="mt-2 min-h-[20px] text-xs">
                {check.kind === 'unavailable' ? (
                  <span className="text-terra">{check.reason}</span>
                ) : username ? (
                  <span className={check.kind === 'available' ? 'text-mint font-medium' : 'text-gray-500'}>
                    Your profile: <span className="font-mono text-forest">foliotbr.app/u/{username}</span>
                  </span>
                ) : (
                  <span className="text-gray-400">3-30 lowercase letters, numbers, or dashes</span>
                )}
              </div>
            </div>

            <button
              type="submit"
              disabled={check.kind !== 'available' || submitting}
              className="btn-primary w-full justify-center"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {submitting ? 'Claiming…' : 'Claim my profile'}
            </button>

            <p className="text-xs text-gray-400 text-center pt-2">
              You can&apos;t change this later (yet). Pick something you&apos;ll love.
            </p>
          </form>
        </div>
      </div>
    </div>
  )
}
