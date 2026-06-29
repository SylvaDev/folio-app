import type { OpenLibrarySearchResult } from '../types'

/**
 * Google Books API client — used as a second-tier fallback when Open Library
 * doesn't have a book (common for newer indie / romantasy titles).
 *
 * Quota: 1000 requests/day per IP unauthenticated.
 * Set NEXT_PUBLIC_GOOGLE_BOOKS_API_KEY (optional) to raise the quota.
 *
 * Returns results in OpenLibrarySearchResult shape so they plug into the same
 * downstream code without any branching.
 */

const GB_BASE = 'https://www.googleapis.com/books/v1/volumes'

interface GoogleVolumeInfo {
  title?: string
  subtitle?: string
  authors?: string[]
  publishedDate?: string
  description?: string
  industryIdentifiers?: { type: string; identifier: string }[]
  pageCount?: number
  categories?: string[]
  imageLinks?: {
    smallThumbnail?: string
    thumbnail?: string
    small?: string
    medium?: string
    large?: string
  }
  language?: string
}

interface GoogleVolume {
  id: string
  volumeInfo: GoogleVolumeInfo
}

interface GoogleBooksSearchResponse {
  totalItems: number
  items?: GoogleVolume[]
}

function getApiKeyParam(): string {
  const key = typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_GOOGLE_BOOKS_API_KEY : undefined
  return key ? `&key=${key}` : ''
}

/**
 * Google Books image URLs come with `&edge=curl` (an ugly page-curl effect)
 * and as http. Strip the curl effect and upgrade to https for cleaner covers.
 */
function cleanCoverUrl(url: string | undefined): string | null {
  if (!url) return null
  return url
    .replace(/^http:/, 'https:')
    .replace(/&edge=curl/g, '')
    .replace(/&zoom=\d+/g, '&zoom=1')
}

/**
 * Map a Google volume to the same shape as an Open Library search result.
 * The `key` is synthesized as `google:VOLUMEID` so the database's unique
 * constraint on `ol_key` continues to work without schema changes.
 */
export function mapGoogleVolumeToSearchResult(vol: GoogleVolume): OpenLibrarySearchResult {
  const info = vol.volumeInfo
  const isbns = (info.industryIdentifiers ?? [])
    .filter(i => i.type === 'ISBN_13' || i.type === 'ISBN_10')
    .map(i => i.identifier)

  const year = info.publishedDate ? parseInt(info.publishedDate.slice(0, 4), 10) : undefined
  const cover = cleanCoverUrl(info.imageLinks?.large)
    ?? cleanCoverUrl(info.imageLinks?.medium)
    ?? cleanCoverUrl(info.imageLinks?.thumbnail)
    ?? cleanCoverUrl(info.imageLinks?.small)
    ?? cleanCoverUrl(info.imageLinks?.smallThumbnail)

  return {
    key: `google:${vol.id}`,
    title: info.title ?? '',
    author_name: info.authors ?? [],
    cover_i: undefined,  // Google doesn't use OL's numeric cover IDs
    cover_url_override: cover ?? undefined,
    first_publish_year: year,
    number_of_pages_median: info.pageCount,
    isbn: isbns.length > 0 ? isbns : undefined,
    subject: info.categories?.flatMap(c => c.split(' / ')).slice(0, 10),
  } as OpenLibrarySearchResult & { cover_url_override?: string }
}

async function fetchGoogleBooks(query: string, maxResults = 1): Promise<GoogleVolume[]> {
  const clampedMax = Math.min(Math.max(maxResults, 1), 40)
  const url = `${GB_BASE}?q=${encodeURIComponent(query)}&maxResults=${clampedMax}${getApiKeyParam()}`
  const res = await fetch(url)
  if (!res.ok) return []
  const data = (await res.json()) as GoogleBooksSearchResponse
  return data.items ?? []
}

/**
 * Multi-result text search across the Google Books catalog.
 * Used by the live BookSearch modal as a second-tier provider.
 */
export async function searchGoogleBooks(query: string, limit = 10): Promise<OpenLibrarySearchResult[]> {
  if (!query.trim()) return []
  const items = await fetchGoogleBooks(query, limit)
  return items.map(mapGoogleVolumeToSearchResult)
}

/**
 * Search Google Books by ISBN. ISBN-13 or ISBN-10 both work.
 * Google's ISBN search is very precise — returns the exact edition.
 */
export async function searchGoogleBooksByIsbn(isbn: string): Promise<OpenLibrarySearchResult | null> {
  const clean = isbn.replace(/[^0-9Xx]/g, '')
  if (clean.length !== 10 && clean.length !== 13) return null
  const items = await fetchGoogleBooks(`isbn:${clean}`)
  if (items.length === 0) return null
  return mapGoogleVolumeToSearchResult(items[0])
}

export async function searchGoogleBooksByTitleAuthor(
  title: string,
  author?: string,
): Promise<OpenLibrarySearchResult | null> {
  if (!title) return null
  const q = author
    ? `intitle:${title} inauthor:${author}`
    : `intitle:${title}`
  const items = await fetchGoogleBooks(q)
  if (items.length === 0) return null
  return mapGoogleVolumeToSearchResult(items[0])
}
