'use client'

import { useState, useMemo, useEffect } from 'react'
import Link from 'next/link'
import {
  Sparkles, ListTodo, ChevronUp, ChevronDown, Loader2,
  Leaf, Swords, Moon, Smile, Heart, GraduationCap,
} from 'lucide-react'
import { toast } from 'sonner'
import type { UserBook } from '@folio/shared'
import { scoreTBRQueue } from '@folio/shared'
import { createClient } from '@/lib/supabase/client'
import { BookCover } from '@/components/books/BookCover'
import { BookSearch } from '@/components/books/BookSearch'
import { cn } from '@/lib/utils'

type SubscriptionTier = 'free' | 'pro' | 'book_club'

interface QuotaSnapshot {
  used: number
  remaining: number
  limit: number
  resetsAt: string
  windowLabel: string
  tier: SubscriptionTier
}

function formatResetsAt(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now()
  if (ms <= 0) return 'soon'
  const hours = Math.round(ms / 3_600_000)
  if (hours < 1) return 'in less than an hour'
  if (hours < 24) return `in ${hours}h`
  const days = Math.round(hours / 24)
  return days === 1 ? 'in 1 day' : `in ${days} days`
}

const MOODS = [
  { key: 'calm',        label: 'Calm',        icon: Leaf },
  { key: 'adventurous', label: 'Adventurous', icon: Swords },
  { key: 'dark',        label: 'Dark',        icon: Moon },
  { key: 'funny',       label: 'Funny',       icon: Smile },
  { key: 'romantic',    label: 'Romantic',    icon: Heart },
  { key: 'educational', label: 'Learn',       icon: GraduationCap },
]

interface Props {
  initialBooks: UserBook[]
  subscription: SubscriptionTier
}

export function TBRClient({ initialBooks, subscription }: Props) {
  const [books, setBooks] = useState<UserBook[]>(initialBooks)
  const [selectedMood, setSelectedMood] = useState<string | null>(null)
  const [aiRec, setAiRec] = useState<string | null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [quota, setQuota] = useState<QuotaSnapshot | null>(null)
  const supabase = createClient()
  const isPaid = subscription !== 'free'

  // Fetch current quota state on mount so we can show "X recommendations left"
  useEffect(() => {
    let cancelled = false
    fetch('/api/ai/queue/status')
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (!cancelled && data?.quota) setQuota(data.quota as QuotaSnapshot)
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  const scored = useMemo(() =>
    scoreTBRQueue(books, selectedMood ?? undefined),
    [books, selectedMood]
  )

  const sortedBooks = useMemo(() => {
    const scoreMap = new Map(scored.map(s => [s.userBookId, s]))
    return [...books].sort((a, b) => {
      const sa = scoreMap.get(a.id)?.score ?? 0
      const sb = scoreMap.get(b.id)?.score ?? 0
      return sb - sa
    })
  }, [books, scored])

  async function getAIRecommendation() {
    if (sortedBooks.length === 0) {
      toast.info('Add some books to your TBR first')
      return
    }
    setAiLoading(true)
    setAiRec(null)
    try {
      const tbrTitles = sortedBooks.slice(0, 20).map(b => ({
        title: b.book?.title,
        author: b.book?.authors?.[0],
        genres: b.book?.genres?.slice(0, 3),
        priority: b.priority,
        mood_tags: b.mood_tags,
      }))

      const res = await fetch('/api/ai/queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ books: tbrTitles, mood: selectedMood }),
      })
      const data = await res.json()

      if (!res.ok) {
        if (res.status === 429 && data?.error === 'quota_exceeded') {
          if (data.quota) setQuota(data.quota as QuotaSnapshot)
          toast.error(data.message ?? 'Recommendation limit reached')
          return
        }
        toast.error(data?.error ?? 'AI recommendation failed, try again')
        return
      }

      setAiRec(data.recommendation)
      if (data.quota) setQuota(data.quota as QuotaSnapshot)
    } catch {
      toast.error('AI recommendation failed, try again')
    } finally {
      setAiLoading(false)
    }
  }

  async function setPriority(id: string, priority: number) {
    // Optimistic update
    let previous: number | null = null
    setBooks(prev => prev.map(b => {
      if (b.id === id) {
        previous = b.priority ?? 3
        return { ...b, priority }
      }
      return b
    }))
    const { error } = await supabase.from('user_books').update({ priority }).eq('id', id)
    if (error) {
      setBooks(prev => prev.map(b => b.id === id && previous !== null ? { ...b, priority: previous } : b))
      toast.error('Could not update priority, try again')
    }
  }

  async function startReading(id: string) {
    // Optimistic: remove from TBR list immediately
    let snapshot: UserBook | undefined
    setBooks(prev => {
      snapshot = prev.find(b => b.id === id)
      return prev.filter(b => b.id !== id)
    })

    const { error } = await supabase.from('user_books').update({
      status: 'reading',
      date_started: new Date().toISOString().split('T')[0],
    }).eq('id', id)

    if (error) {
      // Roll back
      if (snapshot) setBooks(prev => [...prev, snapshot!])
      toast.error('Could not start reading, try again')
      return
    }
    toast.success('Moved to Currently Reading')
  }

  async function refreshBooks() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase
      .from('user_books')
      .select('*, book:books(*)')
      .eq('user_id', user.id)
      .eq('status', 'tbr')
    if (data) setBooks(data as UserBook[])
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="page-title mb-1">TBR Queue</h1>
          <p className="text-gray-500 text-sm">{books.length} books waiting · Sorted by priority & mood</p>
        </div>
        <BookSearch onBookAdded={refreshBooks} />
      </div>

      {/* Mood picker */}
      <div className="card p-5 mb-5">
        <p className="text-sm font-semibold text-forest mb-3">What's your reading mood right now?</p>
        <div className="flex flex-wrap gap-2">
          {MOODS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setSelectedMood(selectedMood === key ? null : key)}
              className={cn(
                'flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium',
                'transition-[background-color,color,box-shadow,transform] duration-200 ease-out',
                'active:scale-[0.97]',
                'outline-none focus-visible:ring-2 focus-visible:ring-mint focus-visible:ring-offset-2',
                selectedMood === key
                  ? 'bg-forest text-white shadow-sm'
                  : 'bg-cream text-forest hover:bg-cream-dark',
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
          {selectedMood && (
            <button
              onClick={() => setSelectedMood(null)}
              className={cn(
                'px-4 py-2 rounded-full text-sm text-gray-400 hover:text-forest hover:bg-cream',
                'transition-[background-color,color,transform] duration-150 ease-out',
                'active:scale-[0.97]',
                'outline-none focus-visible:ring-2 focus-visible:ring-mint focus-visible:ring-offset-2',
              )}
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* AI Recommendation */}
      <div className="card p-5 mb-5 border-2 border-mint/20">
        <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-mint" aria-hidden />
            <h2 className="font-semibold text-forest text-sm">Folio AI</h2>
            {!isPaid && quota && quota.remaining > 0 && (
              <span className="badge bg-mint/15 text-forest text-xs tabular-nums">
                {quota.remaining} of {quota.limit} left this {quota.windowLabel}
              </span>
            )}
            {!isPaid && quota && quota.remaining === 0 && (
              <span className="badge bg-terra/15 text-terra text-xs">
                Resets {formatResetsAt(quota.resetsAt)}
              </span>
            )}
            {isPaid && (
              <span className="badge bg-gold/20 text-amber-700 text-xs">PRO</span>
            )}
          </div>

          {quota && quota.remaining === 0 && !isPaid ? (
            <Link
              href="/settings?tab=billing"
              className={cn(
                'inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-semibold',
                'bg-terra text-white hover:bg-terra-dark',
                'transition-[background-color,transform] duration-150 ease-out active:scale-[0.97]',
                'outline-none focus-visible:ring-2 focus-visible:ring-terra focus-visible:ring-offset-2',
              )}
            >
              <Sparkles className="w-3 h-3" aria-hidden />
              Upgrade for unlimited
            </Link>
          ) : (
            <button
              onClick={getAIRecommendation}
              disabled={aiLoading}
              className="btn-secondary text-xs px-4 py-1.5 gap-1.5"
            >
              {aiLoading ? <Loader2 className="w-3 h-3 animate-spin" aria-hidden /> : <Sparkles className="w-3 h-3" aria-hidden />}
              {aiLoading ? 'Thinking…' : 'Ask Folio AI'}
            </button>
          )}
        </div>

        {aiRec ? (
          <div className="text-sm text-gray-700 leading-relaxed bg-cream/50 rounded-xl p-4">
            {aiRec}
          </div>
        ) : (
          <p className="text-sm text-gray-400">
            {!isPaid && quota && quota.remaining === 0
              ? `You've used all ${quota.limit} recommendations this ${quota.windowLabel}. Upgrade to Pro for unlimited recommendations across mood, pace, and reading history.`
              : 'Ask Folio AI to pick your next read based on your TBR, mood, and reading history.'}
          </p>
        )}
      </div>

      {/* Queue */}
      {sortedBooks.length === 0 ? (
        <div className="text-center py-20 px-6">
          <div className="w-14 h-14 bg-cream rounded-2xl flex items-center justify-center mx-auto mb-4">
            <ListTodo className="w-6 h-6 text-forest/40" aria-hidden />
          </div>
          <p className="font-semibold text-forest">Your TBR is empty</p>
          <p className="text-gray-400 text-sm mt-1">Add books and they&apos;ll appear here for smart queuing</p>
        </div>
      ) : (
        <div className="space-y-2">
          {sortedBooks.map((book, index) => {
            const scoreData = scored.find(s => s.userBookId === book.id)
            return (
              <TBRRow
                key={book.id}
                userBook={book}
                rank={index + 1}
                reasons={scoreData?.reasons ?? []}
                onStartReading={startReading}
                onPriorityChange={setPriority}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}

function TBRRow({ userBook, rank, reasons, onStartReading, onPriorityChange }: {
  userBook: UserBook
  rank: number
  reasons: string[]
  onStartReading: (id: string) => void
  onPriorityChange: (id: string, priority: number) => void
}) {
  const { book } = userBook
  if (!book) return null

  return (
    <div className="flex items-center gap-4 p-4 bg-white rounded-2xl border border-gray-100 hover:border-mint/30 hover:shadow-card transition-all group">
      {/* Rank */}
      <div className="w-8 text-center flex-shrink-0">
        <span className="text-xl font-serif font-bold text-gray-200">#{rank}</span>
      </div>

      {/* Cover */}
      <BookCover
        title={book.title}
        authors={book.authors}
        coverUrl={book.cover_url}
        className="w-10 h-14 flex-shrink-0"
      />

      {/* Info */}
      <div className="flex-1 min-w-0">
        <h3 className="font-semibold text-forest text-sm line-clamp-1">{book.title}</h3>
        <p className="text-gray-400 text-xs">{book.authors.slice(0, 2).join(', ')}</p>
        {reasons.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {reasons.map(r => (
              <span key={r} className="px-2 py-0.5 bg-mint/10 text-forest-light text-xs rounded-full">
                {r}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Priority controls */}
      <div className="flex flex-col items-center gap-0.5 flex-shrink-0">
        <button
          onClick={() => onPriorityChange(userBook.id, Math.min(5, userBook.priority + 1))}
          className="text-gray-300 hover:text-forest transition-colors"
          disabled={userBook.priority >= 5}
        >
          <ChevronUp className="w-4 h-4" />
        </button>
        <div className="flex gap-0.5">
          {[1, 2, 3, 4, 5].map(p => (
            <div
              key={p}
              className={cn('w-1.5 h-3 rounded-full transition-colors', p <= userBook.priority ? 'bg-mint' : 'bg-gray-100')}
            />
          ))}
        </div>
        <button
          onClick={() => onPriorityChange(userBook.id, Math.max(1, userBook.priority - 1))}
          className="text-gray-300 hover:text-forest transition-colors"
          disabled={userBook.priority <= 1}
        >
          <ChevronDown className="w-4 h-4" />
        </button>
      </div>

      {/* Start reading */}
      <button
        onClick={() => onStartReading(userBook.id)}
        className="btn-secondary text-xs px-4 py-2 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
      >
        Start Reading →
      </button>
    </div>
  )
}
