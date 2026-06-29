export type ReadingStatus = 'tbr' | 'reading' | 'read' | 'dnf' | 'paused'

export interface Book {
  id: string
  ol_key: string          // Open Library key e.g. "/works/OL45804W"
  title: string
  authors: string[]
  cover_url: string | null
  cover_id: number | null // Open Library cover ID
  description: string | null
  first_publish_year: number | null
  page_count: number | null
  isbn_13: string | null
  isbn_10: string | null
  genres: string[]
  series_id: string | null
  series_position: number | null
  created_at: string
  updated_at: string
}

export interface UserBook {
  id: string
  user_id: string
  book_id: string
  status: ReadingStatus
  rating: number | null       // 1-5
  date_started: string | null
  date_finished: string | null
  date_added: string
  notes: string | null
  review: string | null
  is_favorite: boolean
  owned: boolean
  format: 'physical' | 'ebook' | 'audio' | null
  priority: number            // 1-5 for TBR queue ordering
  mood_tags: string[]         // calm, adventurous, dark, funny, etc.
  pages_read: number | null
  book?: Book
}

export interface OpenLibrarySearchResult {
  key: string
  title: string
  author_name: string[] | undefined
  cover_i: number | undefined
  first_publish_year: number | undefined
  number_of_pages_median: number | undefined
  isbn: string[] | undefined
  subject: string[] | undefined
  series: string[] | undefined
  /** Used when the result came from a non-OpenLibrary provider (e.g. Google Books). */
  cover_url_override?: string
  /** Tags which catalog provider returned this result. Useful for UI badges + telemetry. */
  provider?: 'openlibrary' | 'google-books'
}

export interface OpenLibraryWork {
  key: string
  title: string
  description: string | { value: string } | undefined
  covers: number[] | undefined
  subjects: string[] | undefined
  first_publish_date: string | undefined
}
