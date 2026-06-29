'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { BookOpen, Loader2, Sparkles, Users, Rss } from 'lucide-react'
import { ActivityCard, type ActivityHydrated } from '@/components/social/ActivityCard'
import { ActivityFeedSkeleton } from '@/components/social/ActivityCardSkeleton'
import { cn } from '@/lib/utils'

type Scope = 'follows' | 'self' | 'all'

// ─── Scope tabs ────────────────────────────────────────────────────────────
function ScopeTabs({ scope, onChange }: { scope: Scope; onChange: (s: Scope) => void }) {
  const tabs: { key: Scope; label: string; icon: typeof Rss; hint: string }[] = [
    { key: 'follows', label: 'Following', icon: Rss, hint: 'You + people you follow' },
    { key: 'all', label: 'Discover', icon: Sparkles, hint: 'Everyone on Folio' },
    { key: 'self', label: 'You', icon: Users, hint: 'Only your activity' },
  ]
  return (
    <div className="flex gap-1 bg-cream rounded-full p-1 w-fit" role="tablist" aria-label="Feed scope">
      {tabs.map(({ key, label, icon: Icon, hint }) => (
        <button
          key={key}
          onClick={() => onChange(key)}
          title={hint}
          role="tab"
          aria-selected={scope === key}
          className={cn(
            'inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium',
            'transition-[background-color,color,box-shadow] duration-150',
            'outline-none focus-visible:ring-2 focus-visible:ring-mint focus-visible:ring-offset-2',
            scope === key
              ? 'bg-white text-forest shadow-sm'
              : 'text-gray-500 hover:text-forest',
          )}
        >
          <Icon className="w-3 h-3" aria-hidden />
          {label}
        </button>
      ))}
    </div>
  )
}

// ─── Empty states (contextual per scope) ──────────────────────────────────
function EmptyFeed({ scope }: { scope: Scope }) {
  if (scope === 'self') {
    return (
      <div className="text-center py-16 px-6">
        <div className="w-14 h-14 rounded-2xl bg-cream flex items-center justify-center mx-auto mb-4">
          <BookOpen className="w-6 h-6 text-forest/40" aria-hidden />
        </div>
        <h2 className="font-serif text-lg font-bold text-forest mb-1">Your feed starts with your next read</h2>
        <p className="text-gray-500 text-sm mb-4 max-w-md mx-auto">
          Start a book, finish one, or write a review. Your activity shows up here so people who follow you can see what you&apos;re reading.
        </p>
        <Link href="/library" className="btn-ghost gap-1.5 inline-flex">
          Go to library
        </Link>
      </div>
    )
  }
  if (scope === 'follows') {
    return (
      <div className="text-center py-16 px-6">
        <div className="w-14 h-14 rounded-2xl bg-cream flex items-center justify-center mx-auto mb-4">
          <Users className="w-6 h-6 text-forest/40" aria-hidden />
        </div>
        <h2 className="font-serif text-lg font-bold text-forest mb-1">Nothing to read here yet</h2>
        <p className="text-gray-500 text-sm mb-4 max-w-md mx-auto">
          Follow other readers on Folio and their activity will land here. Try the <span className="font-medium text-forest">Discover</span> tab to find people.
        </p>
      </div>
    )
  }
  return (
    <div className="text-center py-16 px-6">
      <div className="w-14 h-14 rounded-2xl bg-cream flex items-center justify-center mx-auto mb-4">
        <Sparkles className="w-6 h-6 text-forest/40" aria-hidden />
      </div>
      <h2 className="font-serif text-lg font-bold text-forest mb-1">Folio is just getting started</h2>
      <p className="text-gray-500 text-sm max-w-md mx-auto">
        No public activity yet. As more readers join and finish books, this feed will fill up.
      </p>
    </div>
  )
}

// ─── Main client ───────────────────────────────────────────────────────────
interface FeedClientProps {
  viewerId: string | null
}

export function FeedClient({ viewerId }: FeedClientProps) {
  const [activities, setActivities] = useState<ActivityHydrated[]>([])
  const [scope, setScope] = useState<Scope>('follows')
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const loadPage = useCallback(
    async (cursorParam: string | null, currentScope: Scope, append: boolean) => {
      if (append) setLoadingMore(true)
      else setLoading(true)
      setError(null)
      try {
        const params = new URLSearchParams()
        if (cursorParam) params.set('cursor', cursorParam)
        params.set('scope', currentScope)
        const res = await fetch(`/api/feed?${params}`)
        const data = await res.json()
        if (!res.ok) {
          setError(data.error ?? 'Could not load feed')
          return
        }
        setActivities(prev => (append ? [...prev, ...data.activities] : data.activities))
        setNextCursor(data.nextCursor)
      } catch {
        setError('Network error, try again')
      } finally {
        setLoading(false)
        setLoadingMore(false)
      }
    },
    [],
  )

  useEffect(() => {
    loadPage(null, scope, false)
  }, [scope, loadPage])

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <header className="flex items-center justify-between mb-6">
        <div>
          <h1 className="page-title mb-1">Feed</h1>
          <p className="text-gray-500 text-sm">Your reading community.</p>
        </div>
      </header>

      <div className="mb-5">
        <ScopeTabs scope={scope} onChange={setScope} />
      </div>

      {loading ? (
        <ActivityFeedSkeleton count={4} />
      ) : error ? (
        <div className="text-center py-16 text-red-500 text-sm">{error}</div>
      ) : activities.length === 0 ? (
        <EmptyFeed scope={scope} />
      ) : (
        <div className="space-y-4">
          {activities.map(a => (
            <ActivityCard key={a.id} activity={a} viewerId={viewerId} />
          ))}

          {nextCursor && (
            <button
              onClick={() => loadPage(nextCursor, scope, true)}
              disabled={loadingMore}
              className="w-full py-3 text-sm font-medium text-gray-500 hover:text-forest hover:bg-cream rounded-2xl transition-[background-color,color] duration-150 disabled:opacity-50"
            >
              {loadingMore ? (
                <Loader2 className="w-4 h-4 animate-spin inline" aria-hidden />
              ) : (
                'Load more'
              )}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
