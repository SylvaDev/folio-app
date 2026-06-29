'use client'

import { useState, useMemo, useCallback } from 'react'
import { BookOpen, LayoutGrid, List, Filter, SortAsc } from 'lucide-react'
import { toast } from 'sonner'
import type { UserBook } from '@folio/shared'
import { createClient } from '@/lib/supabase/client'
import { BookCard } from '@/components/books/BookCard'
import { BookSearch } from '@/components/books/BookSearch'
import { cn } from '@/lib/utils'

type Status = UserBook['status'] | 'all'
type SortKey = 'date_added' | 'title' | 'rating' | 'date_finished'
type ViewMode = 'grid' | 'list'

interface Props {
  initialBooks: UserBook[]
  stats: {
    total_read: number
    read_this_year: number
    tbr_count: number
    currently_reading: number
    avg_rating: number
  } | null
}

const STATUS_TABS = [
  { key: 'all' as Status, label: 'All Books' },
  { key: 'reading' as Status, label: 'Reading' },
  { key: 'tbr' as Status, label: 'TBR' },
  { key: 'read' as Status, label: 'Read' },
  { key: 'paused' as Status, label: 'Paused' },
  { key: 'dnf' as Status, label: 'DNF' },
]

export function LibraryClient({ initialBooks, stats }: Props) {
  const [books, setBooks] = useState<UserBook[]>(initialBooks)
  const [activeTab, setActiveTab] = useState<Status>('all')
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('date_added')
  const [view, setView] = useState<ViewMode>('grid')

  const supabase = createClient()

  async function refreshBooks() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase
      .from('user_books')
      .select('*, book:books(*)')
      .eq('user_id', user.id)
      .order('date_added', { ascending: false })
    if (data) setBooks(data as UserBook[])
  }

  const handleStatusChange = useCallback(async (id: string, status: UserBook['status']) => {
    // Snapshot the previous state in case we need to roll back
    let previous: UserBook['status'] | null = null
    setBooks(prev => prev.map(b => {
      if (b.id === id) {
        previous = b.status
        return { ...b, status }
      }
      return b
    }))

    const { error } = await supabase.from('user_books').update({ status }).eq('id', id)
    if (error) {
      // Roll back
      setBooks(prev => prev.map(b => b.id === id && previous !== null ? { ...b, status: previous } : b))
      toast.error('Could not update shelf, try again')
      return
    }
    toast.success('Shelf updated')
  }, [supabase])

  const handleRemove = useCallback(async (id: string) => {
    // Snapshot for rollback
    let snapshot: UserBook | undefined
    setBooks(prev => {
      snapshot = prev.find(b => b.id === id)
      return prev.filter(b => b.id !== id)
    })

    const { error } = await supabase.from('user_books').delete().eq('id', id)
    if (error) {
      // Roll back: re-insert at original position (or end)
      if (snapshot) setBooks(prev => [...prev, snapshot!])
      toast.error('Could not remove book, try again')
      return
    }
    toast.success('Removed from library')
  }, [supabase])

  const filtered = useMemo(() => {
    let list = books
    if (activeTab !== 'all') list = list.filter(b => b.status === activeTab)
    if (search.trim()) {
      const q = search.toLowerCase().trim()
      list = list.filter(b => {
        if (!b.book) return false
        const title = (b.book.title ?? '').toLowerCase()
        if (title.includes(q)) return true
        const authors = b.book.authors ?? []
        return authors.some(a => (a ?? '').toLowerCase().includes(q))
      })
    }
    return [...list].sort((a, b) => {
      if (sortKey === 'title') return (a.book?.title ?? '').localeCompare(b.book?.title ?? '')
      if (sortKey === 'rating') return (b.rating ?? 0) - (a.rating ?? 0)
      if (sortKey === 'date_finished') return (b.date_finished ?? '').localeCompare(a.date_finished ?? '')
      return (b.date_added ?? '').localeCompare(a.date_added ?? '')
    })
  }, [books, activeTab, search, sortKey])

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: books.length }
    books.forEach(b => { c[b.status] = (c[b.status] ?? 0) + 1 })
    return c
  }, [books])

  return (
    <div className="p-6 max-w-7xl mx-auto">

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="page-title mb-1">My Library</h1>
          <p className="text-gray-500 text-sm">
            {stats?.total_read ?? 0} books read · {stats?.currently_reading ?? 0} reading now · {stats?.tbr_count ?? 0} on TBR
          </p>
        </div>
        <BookSearch onBookAdded={refreshBooks} />
      </div>

      {/* Stats cards */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatCard label="Read this year" value={stats.read_this_year} color="forest" />
          <StatCard label="All time" value={stats.total_read} color="mint" />
          <StatCard label="On TBR" value={stats.tbr_count} color="gold" />
          <StatCard label="Avg rating" value={stats.avg_rating ? `${stats.avg_rating} ★` : '—'} color="terra" />
        </div>
      )}

      {/* Filters row */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        {/* Status tabs */}
        <div className="flex items-center bg-cream rounded-xl p-1 gap-0.5 overflow-x-auto">
          {STATUS_TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-[background-color,color,box-shadow] duration-150',
                activeTab === tab.key
                  ? 'bg-white text-forest shadow-sm'
                  : 'text-gray-500 hover:text-forest',
              )}
            >
              {tab.label}
              {counts[tab.key] !== undefined && counts[tab.key] > 0 && (
                <span className="ml-1.5 text-xs opacity-60">{counts[tab.key]}</span>
              )}
            </button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-2">
          {/* Search */}
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Title or author…"
            aria-label="Filter books by title or author"
            className="input h-9 text-sm w-48 py-0"
          />

          {/* Sort */}
          <select
            value={sortKey}
            onChange={e => setSortKey(e.target.value as SortKey)}
            aria-label="Sort books by"
            className="input h-9 text-sm py-0 pr-8 w-36"
          >
            <option value="date_added">Recently Added</option>
            <option value="title">A → Z</option>
            <option value="rating">Highest Rated</option>
            <option value="date_finished">Date Finished</option>
          </select>

          {/* View toggle */}
          <div className="flex items-center bg-cream rounded-lg p-0.5" role="group" aria-label="View mode">
            <button
              onClick={() => setView('grid')}
              aria-label="Grid view"
              aria-pressed={view === 'grid'}
              className={cn(
                'p-1.5 rounded-md transition-[background-color,color] duration-150',
                'outline-none focus-visible:ring-2 focus-visible:ring-mint focus-visible:ring-offset-1',
                view === 'grid' ? 'bg-white text-forest shadow-sm' : 'text-gray-400 hover:text-forest',
              )}
            >
              <LayoutGrid className="w-4 h-4" aria-hidden />
            </button>
            <button
              onClick={() => setView('list')}
              aria-label="List view"
              aria-pressed={view === 'list'}
              className={cn(
                'p-1.5 rounded-md transition-[background-color,color] duration-150',
                'outline-none focus-visible:ring-2 focus-visible:ring-mint focus-visible:ring-offset-1',
                view === 'list' ? 'bg-white text-forest shadow-sm' : 'text-gray-400 hover:text-forest',
              )}
            >
              <List className="w-4 h-4" aria-hidden />
            </button>
          </div>
        </div>
      </div>

      {/* Book grid/list */}
      {filtered.length === 0 ? (
        <EmptyState status={activeTab} search={search} />
      ) : view === 'grid' ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {filtered.map(ub => (
            <BookCard
              key={ub.id}
              userBook={ub}
              view="grid"
              onStatusChange={handleStatusChange}
              onRemove={handleRemove}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map(ub => (
            <BookCard
              key={ub.id}
              userBook={ub}
              view="list"
              onStatusChange={handleStatusChange}
              onRemove={handleRemove}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function StatCard({ label, value, color }: { label: string; value: number | string; color: string }) {
  const colors: Record<string, string> = {
    forest: 'text-forest',
    mint: 'text-forest-light',
    gold: 'text-amber-600',
    terra: 'text-terra',
  }
  return (
    <div className="card p-4">
      <p className={cn('font-serif text-2xl font-bold', colors[color])}>{value}</p>
      <p className="text-xs text-gray-500 mt-1">{label}</p>
    </div>
  )
}

function EmptyState({ status, search }: { status: Status; search: string }) {
  return (
    <div className="text-center py-20 px-6">
      <div className="w-14 h-14 bg-cream rounded-2xl flex items-center justify-center mx-auto mb-4">
        <BookOpen className="w-6 h-6 text-forest/40" aria-hidden />
      </div>
      {search ? (
        <>
          <p className="font-semibold text-forest">No matches for &ldquo;{search}&rdquo;</p>
          <p className="text-gray-400 text-sm mt-1">Try a different search term</p>
        </>
      ) : status === 'all' ? (
        <>
          <p className="font-semibold text-forest">Your library is empty</p>
          <p className="text-gray-400 text-sm mt-1">Add your first book to get started</p>
        </>
      ) : (
        <>
          <p className="font-semibold text-forest">No {status} books yet</p>
          <p className="text-gray-400 text-sm mt-1">Add books and move them to this shelf</p>
        </>
      )}
    </div>
  )
}
