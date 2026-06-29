'use client'

import { useState, useEffect, useRef } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { Search, X, Loader2, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { combinedSearch, mapSearchResultToBook } from '@folio/shared'
import type { OpenLibrarySearchResult } from '@folio/shared'
import { createClient } from '@/lib/supabase/client'
import { BookCover } from './BookCover'
import { cn } from '@/lib/utils'

interface Props {
  onBookAdded?: () => void
}

export function BookSearch({ onBookAdded }: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<OpenLibrarySearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [adding, setAdding] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  // Focus the input shortly after the dialog opens (after Radix animates in)
  useEffect(() => {
    if (open) {
      const t = setTimeout(() => inputRef.current?.focus(), 100)
      return () => clearTimeout(t)
    }
  }, [open])

  // Reset state when closing so a stale query/results don't reappear next time
  useEffect(() => {
    if (!open) {
      setQuery('')
      setResults([])
      setLoading(false)
    }
  }, [open])

  // Debounced live search
  useEffect(() => {
    if (!query.trim()) {
      setResults([])
      setLoading(false)
      return
    }
    clearTimeout(debounceRef.current)
    setLoading(true)
    debounceRef.current = setTimeout(async () => {
      try {
        const docs = await combinedSearch(query, 12)
        setResults(docs)
      } catch (err) {
        console.error('[BookSearch.search]', err)
        toast.error('Search failed, try again')
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 400)
    return () => clearTimeout(debounceRef.current)
  }, [query])

  async function addBook(result: OpenLibrarySearchResult, status: 'tbr' | 'reading' = 'tbr') {
    setAdding(result.key)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      toast.error('You need to be signed in')
      setAdding(null)
      return
    }

    try {
      const bookData = mapSearchResultToBook(result)

      const { data: book, error: bookError } = await supabase
        .from('books')
        .upsert(bookData, { onConflict: 'ol_key', ignoreDuplicates: false })
        .select()
        .single()

      if (bookError || !book) {
        throw new Error(bookError?.message ?? 'Could not save book to catalog')
      }

      const { error: ubError } = await supabase
        .from('user_books')
        .upsert({
          user_id: user.id,
          book_id: book.id,
          status,
          date_added: new Date().toISOString(),
        }, { onConflict: 'user_id,book_id' })

      if (ubError) throw new Error(ubError.message)

      toast.success(`Added "${book.title}" to your ${status === 'tbr' ? 'TBR' : 'reading list'}`)
      onBookAdded?.()
      setOpen(false)
    } catch (err) {
      console.error('[BookSearch.addBook]', err)
      toast.error('Could not add book, try again')
    } finally {
      setAdding(null)
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button className="btn-primary gap-2" aria-label="Add a book to your library">
          <Plus className="w-4 h-4" aria-hidden />
          Add Book
        </button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-forest/50 backdrop-blur-sm" />
        <Dialog.Content
          className={cn(
            'fixed left-1/2 top-[10vh] z-50 w-[92vw] max-w-lg -translate-x-1/2',
            'bg-white rounded-2xl shadow-2xl overflow-hidden',
            'focus:outline-none',
          )}
          aria-describedby={undefined}
        >
          <Dialog.Title className="sr-only">Search for books</Dialog.Title>

          {/* Search input */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
            <Search className="w-5 h-5 text-gray-400 flex-shrink-0" aria-hidden />
            <input
              ref={inputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search by title, author, or ISBN…"
              aria-label="Search books"
              autoComplete="off"
              spellCheck={false}
              className="flex-1 text-sm outline-none text-forest placeholder:text-gray-400 bg-transparent"
            />
            {loading && <Loader2 className="w-4 h-4 text-gray-400 animate-spin flex-shrink-0" aria-hidden />}
            <Dialog.Close
              className="text-gray-400 hover:text-forest p-1 -m-1 rounded-full hover:bg-gray-100 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-mint focus-visible:ring-offset-1"
              aria-label="Close search"
            >
              <X className="w-5 h-5" aria-hidden />
            </Dialog.Close>
          </div>

          {/* Results */}
          <div className="max-h-[60vh] overflow-y-auto divide-y divide-gray-50">
            {results.length === 0 && query && !loading && (
              <div className="py-12 text-center text-gray-400 text-sm px-6">
                <p>No results for &ldquo;{query}&rdquo;</p>
                <p className="text-xs mt-1">Try the ISBN if you have it. It gives the most accurate match.</p>
              </div>
            )}
            {results.length === 0 && !query && (
              <div className="py-12 text-center px-6">
                <div className="w-14 h-14 bg-cream rounded-2xl flex items-center justify-center mx-auto mb-3">
                  <Search className="w-6 h-6 text-forest/40" aria-hidden />
                </div>
                <p className="text-sm font-semibold text-forest">Search the open book catalog</p>
                <p className="text-gray-400 text-xs mt-1">Open Library + Google Books, ~30M books</p>
              </div>
            )}

            {results.map(result => {
              const isbn13 = result.isbn?.find(i => i.length === 13)
              const coverUrl =
                result.cover_url_override
                ?? (result.cover_i ? `https://covers.openlibrary.org/b/id/${result.cover_i}-M.jpg` : null)
                ?? (isbn13 ? `https://covers.openlibrary.org/b/isbn/${isbn13}-M.jpg` : null)
              const isAdding = adding === result.key
              const isGoogle = result.provider === 'google-books'

              return (
                <div key={result.key} className="flex items-center gap-3 px-4 py-3 hover:bg-cream/40 transition-colors">
                  <BookCover
                    title={result.title}
                    authors={result.author_name ?? []}
                    coverUrl={coverUrl}
                    className="w-10 h-14 flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="font-medium text-forest text-sm line-clamp-1">{result.title}</p>
                      {isGoogle && (
                        <span
                          className="flex-shrink-0 text-[9px] uppercase tracking-wide font-semibold px-1.5 py-0.5 rounded bg-terra/10 text-terra"
                          title="From Google Books, used when Open Library doesn't have a book"
                        >
                          GB
                        </span>
                      )}
                    </div>
                    <p className="text-gray-400 text-xs line-clamp-1">
                      {result.author_name?.slice(0, 2).join(', ') ?? 'Unknown author'}
                      {result.first_publish_year && ` · ${result.first_publish_year}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => addBook(result, 'tbr')}
                      disabled={!!isAdding}
                      aria-label={`Add ${result.title} to TBR`}
                      className={cn(
                        'px-3 py-1.5 rounded-full text-xs font-semibold',
                        'bg-cream text-forest hover:bg-cream-dark',
                        'transition-[background-color,transform] duration-150 ease-out',
                        'active:scale-[0.97]',
                        'outline-none focus-visible:ring-2 focus-visible:ring-mint focus-visible:ring-offset-1',
                        'disabled:opacity-60 disabled:cursor-not-allowed',
                      )}
                    >
                      {isAdding ? <Loader2 className="w-3 h-3 animate-spin" aria-hidden /> : 'TBR'}
                    </button>
                    <button
                      onClick={() => addBook(result, 'reading')}
                      disabled={!!isAdding}
                      aria-label={`Add ${result.title} to Reading`}
                      className={cn(
                        'px-3 py-1.5 rounded-full text-xs font-semibold',
                        'bg-forest text-white hover:bg-forest-light',
                        'transition-[background-color,transform] duration-150 ease-out',
                        'active:scale-[0.97]',
                        'outline-none focus-visible:ring-2 focus-visible:ring-forest focus-visible:ring-offset-1',
                        'disabled:opacity-60 disabled:cursor-not-allowed',
                      )}
                    >
                      {isAdding ? <Loader2 className="w-3 h-3 animate-spin" aria-hidden /> : 'Reading'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
