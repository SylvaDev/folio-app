export interface Series {
  id: string
  name: string
  ol_series_key: string | null
  description: string | null
  book_count: number
  created_at: string
}

export interface SeriesBook {
  series_id: string
  book_id: string
  position: number      // 1-indexed
  is_prequel: boolean
  is_novella: boolean
}

export interface UserSeriesProgress {
  user_id: string
  series_id: string
  current_position: number | null
  status: 'reading' | 'completed' | 'paused' | 'abandoned'
  last_updated: string
}
