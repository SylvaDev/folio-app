'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { BookMarked, Check, BookOpen, Clock, Sparkles, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import type { UserBook } from '@folio/shared'
import { BookCover } from '@/components/books/BookCover'
import { cn } from '@/lib/utils'
import type { SeriesInfo } from './types'

interface Props {
  userBooks: UserBook[]
  seriesMap: Record<string, SeriesInfo>
}

function ScanLibraryButton() {
  const router = useRouter()
  const [scanning, setScanning] = useState(false)

  async function handleScan() {
    setScanning(true)
    try {
      const res = await fetch('/api/series/detect', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'Scan failed')
        return
      }
      const seriesTouched = data.seriesCreated + data.seriesUpdated
      const didSomething = data.matched > 0 || seriesTouched > 0 || data.seriesAudited > 0

      if (!didSomething) {
        toast.info('Your library is up to date. No new series found.')
      } else {
        const parts: string[] = []
        if (data.matched > 0) {
          parts.push(`linked ${data.matched} book${data.matched === 1 ? '' : 's'}`)
        }
        if (seriesTouched > 0) {
          parts.push(`across ${seriesTouched} series`)
        }
        if (data.seriesAudited > 0) {
          parts.push(`(corrected ${data.seriesAudited} series count${data.seriesAudited === 1 ? '' : 's'})`)
        }
        toast.success(parts.join(' ') || 'Scan complete')
      }

      // Always refresh — even on no-op, since the user might be on a stale render
      router.refresh()
    } catch (e) {
      toast.error('Scan failed, try again')
    } finally {
      setScanning(false)
    }
  }

  return (
    <button
      onClick={handleScan}
      disabled={scanning}
      className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-mint/10 text-forest hover:bg-mint/20 text-sm font-medium transition-[background-color,transform] duration-150 ease-out active:scale-[0.97] outline-none focus-visible:ring-2 focus-visible:ring-mint focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {scanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4 text-mint" />}
      {scanning ? 'Scanning…' : 'Scan library for series'}
    </button>
  )
}

interface SeriesGroup {
  id: string
  name: string
  books: (UserBook & { position: number })[]
  totalBooks: number
  readCount: number
}

export function SeriesClient({ userBooks, seriesMap }: Props) {
  const seriesGroups = useMemo(() => {
    // Status priority — when the user has duplicate book rows at the same
    // position (e.g. one from Open Library, one from Google Books), we keep
    // the "best" status: read > reading > tbr > paused > dnf.
    const statusPriority: Record<UserBook['status'], number> = {
      read: 5, reading: 4, tbr: 3, paused: 2, dnf: 1,
    }

    // First pass: group by series_id, deduping at each position.
    const grouped = new Map<string, Map<number, UserBook & { position: number }>>()

    for (const ub of userBooks) {
      const book = ub.book as unknown as {
        id: string
        title: string
        authors: string[]
        cover_url: string | null
        series_id: string | null
        series_position: number | null
      } | null
      if (!book?.series_id) continue
      if (!seriesMap[book.series_id]) continue  // defensive

      const sid = book.series_id
      const position = book.series_position ?? 999

      if (!grouped.has(sid)) grouped.set(sid, new Map())
      const positionMap = grouped.get(sid)!

      const existing = positionMap.get(position)
      const candidate = { ...ub, book, position } as UserBook & { position: number }

      // Keep whichever has the higher-priority status.
      // Ties resolved by date_added (older wins — it's the "canonical" one).
      if (!existing) {
        positionMap.set(position, candidate)
      } else if (statusPriority[ub.status] > statusPriority[existing.status]) {
        positionMap.set(position, candidate)
      }
    }

    // Second pass: assemble groups
    const groups: SeriesGroup[] = []
    for (const [sid, positionMap] of grouped) {
      const seriesInfo = seriesMap[sid]
      const books = [...positionMap.values()].sort((a, b) => a.position - b.position)
      const readCount = books.filter(b => b.status === 'read').length

      groups.push({
        id: sid,
        name: seriesInfo.name,
        books,
        // Always show at least as many slots as the user actually has — so
        // if our curated count is stale, the user still sees a sensible
        // "X of Y" without exceeding 100%.
        totalBooks: Math.max(seriesInfo.book_count, books.length),
        readCount,
      })
    }

    return groups.sort((a, b) => b.readCount - a.readCount)
  }, [userBooks, seriesMap])

  if (seriesGroups.length === 0) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="page-title">Series</h1>
          <ScanLibraryButton />
        </div>
        <div className="text-center py-16 px-6">
          <div className="w-14 h-14 bg-cream rounded-2xl flex items-center justify-center mx-auto mb-4">
            <BookMarked className="w-6 h-6 text-forest/40" aria-hidden />
          </div>
          <p className="font-semibold text-forest">No series tracked yet</p>
          <p className="text-gray-400 text-sm mt-1 max-w-md mx-auto">
            Some series aren&apos;t auto-detected from your imports. Click <span className="font-medium text-forest">Scan library for series</span> above to find them.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="page-title mb-1">Series</h1>
          <p className="text-gray-500 text-sm">{seriesGroups.length} series in progress</p>
        </div>
        <ScanLibraryButton />
      </div>

      <div className="space-y-6">
        {seriesGroups.map(group => (
          <SeriesCard key={group.id} group={group} />
        ))}
      </div>
    </div>
  )
}

function SeriesCard({ group }: { group: SeriesGroup }) {
  // Defensive: never display readCount > totalBooks or progress > 100% —
  // even if upstream math glitches, users should never see "5 of 4 read".
  const safeReadCount = Math.min(group.readCount, group.totalBooks)
  const progress = group.totalBooks > 0 ? Math.min(100, (safeReadCount / group.totalBooks) * 100) : 0
  const nextBook = group.books.find(b => b.status === 'tbr' || b.status === 'reading')

  return (
    <div className="card p-5">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="font-serif text-xl font-bold text-forest">{group.name}</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {safeReadCount} of {group.totalBooks} books read
          </p>
        </div>
        <div className="text-right">
          <p className="font-serif text-2xl font-bold text-mint">{Math.round(progress)}%</p>
          <p className="text-xs text-gray-400">complete</p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-2 bg-gray-100 rounded-full mb-4 overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-forest to-mint rounded-full transition-[width] duration-500 ease-out"
          style={{ width: `${Math.min(100, progress)}%` }}
        />
      </div>

      {/* Books row */}
      <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
        {group.books.map(ub => {
          const book = ub.book as any
          return (
            <div key={ub.id} className="flex-shrink-0 flex flex-col items-center gap-2 w-16">
              <div className="relative">
                <BookCover
                  title={book.title}
                  authors={book.authors ?? []}
                  coverUrl={book.cover_url}
                  className="w-16 h-24"
                />
                <div className={cn(
                  'absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center shadow',
                  ub.status === 'read' ? 'bg-mint' :
                  ub.status === 'reading' ? 'bg-gold' : 'bg-gray-200',
                )}>
                  {ub.status === 'read' && <Check className="w-3 h-3 text-white" />}
                  {ub.status === 'reading' && <BookOpen className="w-3 h-3 text-white" />}
                  {ub.status === 'tbr' && <Clock className="w-3 h-3 text-gray-500" />}
                </div>
              </div>
              <span className="text-xs text-gray-500 text-center leading-tight line-clamp-2">
                {book.series_position && `#${book.series_position}`}
              </span>
            </div>
          )
        })}
      </div>

      {/* Next up */}
      {nextBook && (
        <div className="mt-4 pt-4 border-t border-gray-100 flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-terra" />
          <span className="text-sm text-gray-500">
            {nextBook.status === 'reading' ? 'Currently reading:' : 'Up next:'}
          </span>
          <span className="text-sm font-medium text-forest">{(nextBook.book as any)?.title}</span>
        </div>
      )}
    </div>
  )
}
