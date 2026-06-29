import { createClient } from '@/lib/supabase/server'
import { SeriesClient } from './SeriesClient'
import type { SeriesInfo } from './types'

export const metadata = { title: 'Series' }

export default async function SeriesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // 1. Pull every user_book + its joined book record (single flat select).
  //    No filtering at the DB level — we filter client-side so the query
  //    can't silently return zero rows due to PostgREST embed-filter quirks.
  const { data: userBooks, error: ubErr } = await supabase
    .from('user_books')
    .select(`
      id, status, rating, date_added, date_finished, pages_read,
      book:books(
        id, title, authors, cover_url, page_count, series_id, series_position
      )
    `)
    .eq('user_id', user!.id)

  if (ubErr) {
    console.error('[SeriesPage] user_books query failed:', ubErr)
  }

  // 2. Collect the unique series IDs referenced by the user's books and
  //    fetch them in one second query. Avoids the brittle 2-level nested embed.
  const seriesIds = Array.from(
    new Set(
      (userBooks ?? [])
        .map(ub => (ub.book as unknown as { series_id?: string | null } | null)?.series_id)
        .filter((id): id is string => !!id),
    ),
  )

  let seriesMap: Record<string, SeriesInfo> = {}
  if (seriesIds.length > 0) {
    const { data: seriesRows, error: sErr } = await supabase
      .from('series')
      .select('id, name, book_count')
      .in('id', seriesIds)

    if (sErr) {
      console.error('[SeriesPage] series query failed:', sErr)
    }
    if (seriesRows) {
      seriesMap = Object.fromEntries(seriesRows.map(s => [s.id, s as SeriesInfo]))
    }
  }

  return <SeriesClient userBooks={userBooks ?? []} seriesMap={seriesMap} />
}
