'use client'

import { useState, useEffect, useRef } from 'react'
import { Search, Loader2, Plus, BookOpen, Check } from 'lucide-react'
import { toast } from 'sonner'
import { combinedSearch, mapSearchResultToBook } from '@folio/shared'
import type { OpenLibrarySearchResult } from '@folio/shared'
import { createClient } from '@/lib/supabase/client'
import { BookCover } from '@/components/books/BookCover'
import { cn } from '@/lib/utils'

export function DiscoverClient() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<OpenLibrarySearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [adding, setAdding] = useState<string | null>(null)
  const [addedKeys, setAddedKeys] = useState<Set<string>>(new Set())
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

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
        const docs = await combinedSearch(query, 20)
        setResults(docs)
      } catch (err) {
        console.error('[Discover.search]', err)
        toast.error('Search failed, try again')
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 400)
    return () => clearTimeout(debounceRef.current)
  }, [query])

  async function addBook(result: OpenLibrarySearchResult) {
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
          status: 'tbr',
          date_added: new Date().toISOString(),
        }, { onConflict: 'user_id,book_id' })
      if (ubError) throw new Error(ubError.message)

      toast.success(`Added "${book.title}" to your TBR`)
      setAddedKeys(prev => new Set(prev).add(result.key))
    } catch (err) {
      console.error('[Discover.addBook]', err)
      toast.error('Could not add book, try again')
    } finally {
      setAdding(null)
    }
  }

  const trimmed = query.trim()
  const isbnLike = /^[\d-]{10,17}$/.test(trimmed) && trimmed.replace(/-/g, '').length >= 10

  return (
    <div className="px-4 sm:px-8 py-8 max-w-3xl mx-auto">
      <header className="mb-6">
        <h1 className="font-serif text-3xl font-bold text-forest">Discover</h1>
        <p className="text-forest/60 mt-1 text-sm">
          Look up any book by title, author, or ISBN, then add it to your library.
        </p>
      </header>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" aria-hidden />
        <input
          ref={inputRef}
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search by title, author, or ISBN…"
          aria-label="Search books"
          autoComplete="off"
          spellCheck={false}
          className="w-full pl-11 pr-11 py-3 bg-white rounded-2xl border border-gray-200 text-forest placeholder:text-gray-400 outline-none focus:border-mint focus:ring-2 focus:ring-mint/20 transition-[border-color,box-shadow] duration-200 ease-out"
        />
        {loading && (
          <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 animate-spin" aria-hidden />
        )}
      </div>

      <div className="min-h-[20px] mt-2 text-xs">
        {isbnLike && (
          <span className="text-forest/60">Looks like an ISBN, searching for an exact match.</span>
        )}
      </div>

      <div className="space-y-3 mt-4">
        {results.length === 0 && !query && (
          <div className="py-16 text-center">
            <div className="w-14 h-14 bg-cream rounded-2xl flex items-center justify-center mx-auto mb-3">
              <BookOpen className="w-6 h-6 text-forest/40" aria-hidden />
            </div>
            <p className="text-sm font-semibold text-forest">Find your next read</p>
            <p className="text-forest/40 text-xs mt-1">Catalog spans Open Library and Google Books</p>
          </div>
        )}
        {results.length === 0 && query && !loading && (
          <div className="py-16 text-center">
            <p className="text-sm font-semibold text-forest">No results for &ldquo;{query}&rdquo;</p>
            <p className="text-forest/40 text-xs mt-1">Try the ISBN if you have it. It gives the most accurate match.</p>
          </div>
        )}
        {results.map(result => (
          <ResultRow
            key={result.key}
            result={result}
            adding={adding === result.key}
            added={addedKeys.has(result.key)}
            onAdd={addBook}
          />
        ))}
      </div>
    </div>
  )
}

interface ResultRowProps {
  result: OpenLibrarySearchResult
  adding: boolean
  added: boolean
  onAdd: (r: OpenLibrarySearchResult) => void
}

function ResultRow({ result, adding, added, onAdd }: ResultRowProps) {
  const isbn13 = result.isbn?.find(i => i.length === 13) ?? null
  const coverUrl =
    result.cover_url_override
    ?? (result.cover_i ? `https://covers.openlibrary.org/b/id/${result.cover_i}-M.jpg` : null)
    ?? (isbn13 ? `https://covers.openlibrary.org/b/isbn/${isbn13}-M.jpg` : null)
  const isGoogle = result.provider === 'google-books'

  return (
    <div className="flex gap-4 bg-white border border-gray-100 rounded-2xl p-4">
      <BookCover
        title={result.title}
        authors={result.author_name ?? []}
        coverUrl={coverUrl}
        className="w-16 h-24 flex-shrink-0"
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-2">
          <p className="font-semibold text-forest line-clamp-2">{result.title}</p>
          {isGoogle && (
            <span
              className="flex-shrink-0 text-[9px] uppercase tracking-wide font-semibold px-1.5 py-0.5 rounded bg-terra/10 text-terra mt-1"
              title="From Google Books, used when Open Library does not have a book"
            >
              GB
            </span>
          )}
        </div>
        <p className="text-forest/60 text-sm line-clamp-1 mt-0.5">
          {result.author_name?.slice(0, 2).join(', ') ?? 'Unknown author'}
          {result.first_publish_year && ` · ${result.first_publish_year}`}
        </p>
        {isbn13 && (
          <p className="text-forest/40 text-xs mt-0.5 font-mono">ISBN {isbn13}</p>
        )}

        <div className="flex flex-wrap items-center gap-2 mt-3">
          <button
            onClick={() => onAdd(result)}
            disabled={adding || added}
            aria-label={added ? `${result.title} added` : `Add ${result.title} to TBR`}
            className={cn(
              'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold',
              'transition-[background-color,transform,color] duration-150 ease-out',
              'active:scale-[0.97]',
              'outline-none focus-visible:ring-2 focus-visible:ring-mint focus-visible:ring-offset-1',
              'disabled:cursor-not-allowed',
              added
                ? 'bg-mint/15 text-forest disabled:opacity-100'
                : 'bg-cream text-forest hover:bg-cream-dark disabled:opacity-60',
            )}
          >
            {adding ? (
              <Loader2 className="w-3 h-3 animate-spin" aria-hidden />
            ) : added ? (
              <Check className="w-3 h-3" aria-hidden />
            ) : (
              <Plus className="w-3 h-3" aria-hidden />
            )}
            {added ? 'In your TBR' : 'Add to TBR'}
          </button>
        </div>
      </div>
    </div>
  )
}
