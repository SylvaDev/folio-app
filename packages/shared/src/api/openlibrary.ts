import type { OpenLibrarySearchResult, OpenLibraryWork, Book } from '../types'
import {
  searchGoogleBooks,
  searchGoogleBooksByIsbn,
  searchGoogleBooksByTitleAuthor,
} from './google-books'

const OL_BASE = 'https://openlibrary.org'
const COVERS_BASE = 'https://covers.openlibrary.org'

export function getCoverUrl(coverId: number, size: 'S' | 'M' | 'L' = 'M'): string {
  return `${COVERS_BASE}/b/id/${coverId}-${size}.jpg`
}

export function getCoverUrlByIsbn(isbn: string, size: 'S' | 'M' | 'L' = 'M'): string {
  return `${COVERS_BASE}/b/isbn/${isbn}-${size}.jpg`
}

export async function searchBooks(query: string, limit = 20, offset = 0): Promise<{
  docs: OpenLibrarySearchResult[]
  numFound: number
}> {
  const params = new URLSearchParams({
    q: query,
    limit: String(limit),
    offset: String(offset),
    fields: 'key,title,author_name,cover_i,first_publish_year,number_of_pages_median,isbn,subject,series',
  })
  const res = await fetch(`${OL_BASE}/search.json?${params}`)
  if (!res.ok) throw new Error(`OpenLibrary search failed: ${res.status}`)
  return res.json()
}

export async function getWork(workKey: string): Promise<OpenLibraryWork> {
  const key = workKey.startsWith('/works/') ? workKey : `/works/${workKey}`
  const res = await fetch(`${OL_BASE}${key}.json`)
  if (!res.ok) throw new Error(`OpenLibrary work fetch failed: ${res.status}`)
  return res.json()
}

/**
 * Search by ISBN using the search endpoint so we get the same shape as title search.
 * Returns the top-ranked match or null. Accepts ISBN-10 or ISBN-13.
 */
export async function searchByIsbn(isbn: string): Promise<OpenLibrarySearchResult | null> {
  const clean = isbn.replace(/[^0-9Xx]/g, '')
  if (clean.length !== 10 && clean.length !== 13) return null

  const params = new URLSearchParams({
    isbn: clean,
    limit: '1',
    fields: 'key,title,author_name,cover_i,first_publish_year,number_of_pages_median,isbn,subject,series',
  })
  const res = await fetch(`${OL_BASE}/search.json?${params}`)
  if (!res.ok) return null
  const data = await res.json()
  return data.docs?.[0] ?? null
}

/**
 * Multi-provider, multi-strategy book search optimized for Goodreads imports.
 *
 * Order of attempts:
 *   Open Library (primary, deeper catalog of classics + mainstream):
 *     1. ISBN-13
 *     2. ISBN-10
 *     3. Title + Author (cleaned title)
 *     4. Title only (cleaned title)
 *   Google Books (fallback, deeper catalog of recent indie/romantasy):
 *     5. ISBN (either ISBN-13 or ISBN-10)
 *     6. Title + Author
 *
 * Returns the result + which strategy + provider matched it.
 */
export type SearchStrategy = 'isbn13' | 'isbn10' | 'title+author' | 'title'
export type SearchProvider = 'openlibrary' | 'google-books'

export interface SearchResolution {
  result: OpenLibrarySearchResult
  strategy: SearchStrategy
  provider: SearchProvider
}

export async function resolveBook(opts: {
  title: string
  author?: string
  isbn13?: string | null
  isbn10?: string | null
}): Promise<SearchResolution | null> {
  // 1. Open Library — ISBN-13
  if (opts.isbn13) {
    const r = await searchByIsbn(opts.isbn13)
    if (r) return { result: r, strategy: 'isbn13', provider: 'openlibrary' }
  }
  // 2. Open Library — ISBN-10
  if (opts.isbn10) {
    const r = await searchByIsbn(opts.isbn10)
    if (r) return { result: r, strategy: 'isbn10', provider: 'openlibrary' }
  }

  const cleanTitle = stripGoodreadsTitleAnnotations(opts.title)
  if (!cleanTitle) return null

  // 3. Open Library — Title + Author
  if (opts.author) {
    const params = new URLSearchParams({
      title: cleanTitle,
      author: opts.author.replace(/\s+/g, ' ').trim(),
      limit: '1',
      fields: 'key,title,author_name,cover_i,first_publish_year,number_of_pages_median,isbn,subject,series',
    })
    const res = await fetch(`${OL_BASE}/search.json?${params}`)
    if (res.ok) {
      const data = await res.json()
      const result = data.docs?.[0]
      if (result) return { result, strategy: 'title+author', provider: 'openlibrary' }
    }
  }

  // 4. Open Library — Title only
  {
    const params = new URLSearchParams({
      title: cleanTitle,
      limit: '1',
      fields: 'key,title,author_name,cover_i,first_publish_year,number_of_pages_median,isbn,subject,series',
    })
    const res = await fetch(`${OL_BASE}/search.json?${params}`)
    if (res.ok) {
      const data = await res.json()
      const result = data.docs?.[0]
      if (result) return { result, strategy: 'title', provider: 'openlibrary' }
    }
  }

  // 5. Google Books — ISBN (try ISBN-13 first then ISBN-10)
  if (opts.isbn13) {
    const r = await searchGoogleBooksByIsbn(opts.isbn13)
    if (r) return { result: r, strategy: 'isbn13', provider: 'google-books' }
  }
  if (opts.isbn10) {
    const r = await searchGoogleBooksByIsbn(opts.isbn10)
    if (r) return { result: r, strategy: 'isbn10', provider: 'google-books' }
  }

  // 6. Google Books — Title + Author (Google's title search is generally stronger than OL's)
  if (opts.author) {
    const r = await searchGoogleBooksByTitleAuthor(cleanTitle, opts.author)
    if (r) return { result: r, strategy: 'title+author', provider: 'google-books' }
  } else {
    const r = await searchGoogleBooksByTitleAuthor(cleanTitle)
    if (r) return { result: r, strategy: 'title', provider: 'google-books' }
  }

  return null
}

/**
 * Strips Goodreads' trailing series annotation from a title.
 *   "The Assassin's Blade (Throne of Glass, #0.1-0.5)" → "The Assassin's Blade"
 *   "Recursion"                                        → "Recursion"
 *   "Half City (Harker Academy, #1)"                   → "Half City"
 */
export function stripGoodreadsTitleAnnotations(title: string): string {
  // Remove trailing "(...)" if it contains a # (series position) or "Book" / a digit
  return title
    .replace(/\s*\((?:[^()]*#\d|[^()]*\bbook\s+\d|[^()]*,\s*#)[^()]*\)\s*$/i, '')
    .replace(/\s*\(.*\bvol\.?\s+\d+.*\)\s*$/i, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Live search across BOTH Open Library and Google Books, with deduplication.
 *
 * Behavior:
 *   - If the query looks like an ISBN, hit both providers' ISBN endpoints in parallel.
 *   - Otherwise: query Open Library first; if it returns < 4 results, supplement with
 *     Google Books to give the user something to choose from.
 *   - Dedupe by ISBN-overlap and normalized title+author so the same book doesn't
 *     appear twice in the list.
 *
 * Every returned result has `.provider` set so the UI can show a small badge.
 */
export async function combinedSearch(query: string, limit = 12): Promise<OpenLibrarySearchResult[]> {
  const trimmed = query.trim()
  if (!trimmed) return []

  const isbnCandidate = trimmed.replace(/[-\s]/g, '')
  const isIsbn = /^\d{10}$|^(?:\d{13}|\d{9}X)$/i.test(isbnCandidate)

  if (isIsbn) {
    const [ol, gb] = await Promise.all([
      searchByIsbn(isbnCandidate),
      searchGoogleBooksByIsbn(isbnCandidate),
    ])
    const out: OpenLibrarySearchResult[] = []
    if (ol) out.push({ ...ol, provider: 'openlibrary' })
    if (gb && !sameBook(ol, gb)) out.push({ ...gb, provider: 'google-books' })
    return out
  }

  // Text search — OL first
  const olResp = await searchBooks(trimmed, limit).catch(() => ({ docs: [], numFound: 0 }))
  const olTagged: OpenLibrarySearchResult[] = olResp.docs.map(d => ({ ...d, provider: 'openlibrary' }))

  // If OL gave us a healthy list, return that alone — no need to hit GB
  if (olTagged.length >= 4) return olTagged.slice(0, limit)

  // Supplement with Google Books for thin results
  const remaining = Math.max(limit - olTagged.length, 4)
  const gbResults = await searchGoogleBooks(trimmed, remaining).catch(() => [] as OpenLibrarySearchResult[])
  const gbTagged: OpenLibrarySearchResult[] = gbResults.map(r => ({ ...r, provider: 'google-books' }))

  // Dedupe: drop any Google result whose ISBN appears in an OL result,
  // OR whose normalized title+author matches an OL result.
  const olIsbns = new Set(olTagged.flatMap(o => o.isbn ?? []))
  const olKeys = new Set(olTagged.map(o => titleAuthorKey(o)))
  const dedupedGb = gbTagged.filter(g => {
    if (g.isbn?.some(i => olIsbns.has(i))) return false
    if (olKeys.has(titleAuthorKey(g))) return false
    return true
  })

  return [...olTagged, ...dedupedGb].slice(0, limit)
}

/** Two results are the "same book" if they share any ISBN or have the same normalized title+author. */
function sameBook(a: OpenLibrarySearchResult | null, b: OpenLibrarySearchResult | null): boolean {
  if (!a || !b) return false
  const aIsbns = new Set(a.isbn ?? [])
  if ((b.isbn ?? []).some(i => aIsbns.has(i))) return true
  return titleAuthorKey(a) === titleAuthorKey(b)
}

function titleAuthorKey(r: OpenLibrarySearchResult): string {
  const t = (r.title ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')
  const a = (r.author_name?.[0] ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')
  return `${t}|${a}`
}

export function mapSearchResultToBook(result: OpenLibrarySearchResult): Omit<Book, 'id' | 'created_at' | 'updated_at' | 'series_id' | 'series_position'> {
  const coverId = result.cover_i ?? null
  // Pick best cover: explicit override (Google) → OL numeric ID → OL ISBN-derived URL → null
  const isbn13 = result.isbn?.find(i => i.length === 13) ?? null
  const coverUrl =
    result.cover_url_override
    ?? (coverId ? getCoverUrl(coverId, 'M') : null)
    ?? (isbn13 ? getCoverUrlByIsbn(isbn13, 'M') : null)

  return {
    ol_key: result.key,
    title: result.title,
    authors: result.author_name ?? [],
    cover_url: coverUrl,
    cover_id: coverId,
    description: null,
    first_publish_year: result.first_publish_year ?? null,
    page_count: result.number_of_pages_median ?? null,
    isbn_13: isbn13,
    isbn_10: result.isbn?.find(i => i.length === 10) ?? null,
    genres: result.subject?.slice(0, 10) ?? [],
  }
}
