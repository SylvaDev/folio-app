export interface ReadingSession {
  id: string
  user_id: string
  user_book_id: string
  pages_read: number
  minutes_read: number | null
  session_date: string
  created_at: string
}

export interface ReadingStats {
  books_read_this_year: number
  books_read_all_time: number
  pages_read_this_year: number
  avg_books_per_month: number
  avg_days_per_book: number
  completion_rate: number       // % of started books finished
  dnf_rate: number
  top_genres: { genre: string; count: number }[]
  top_authors: { author: string; count: number }[]
  reading_pace: { month: string; count: number }[]  // last 12 months
  author_diversity: number      // unique authors / total books read
  longest_book: { title: string; pages: number } | null
  shortest_book: { title: string; pages: number } | null
  current_streak: number        // consecutive days with reading session
  longest_streak: number
}
