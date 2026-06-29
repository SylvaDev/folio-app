import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { detectSeries } from '@folio/shared'
import { serverError, unauthorized } from '@/lib/api-errors'
import { enforceRateLimit } from '@/lib/rate-limit'

/**
 * POST /api/series/detect
 *
 * Scans the user's library for books that belong to known series and links
 * them. Creates `series` rows if they don't exist, then updates each book's
 * `series_id` and `series_position`.
 *
 * Returns counts: { matched, seriesCreated, seriesUpdated, skipped }
 */
export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return unauthorized()

  const limited = await enforceRateLimit(supabase, user.id, 'series.scan')
  if (limited) return limited

  // Fetch all the user's books (with the joined book record)
  const { data: userBooks, error: ubErr } = await supabase
    .from('user_books')
    .select('id, book:books(id, title, authors, series_id)')
    .eq('user_id', user.id)

  if (ubErr) return serverError('api.series.detect', ubErr)

  // Collect detection results, grouped by series name.
  // We also track the curated `totalBooks` from the detection so the series row
  // reflects the actual series length (not just how many the user happens to own).
  type BookMatch = { bookId: string; position: number }
  type GroupData = { books: BookMatch[]; curatedTotal: number }
  const groups = new Map<string, GroupData>()
  let skipped = 0

  for (const ub of userBooks ?? []) {
    const book = ub.book as unknown as {
      id: string
      title: string
      authors: string[]
      series_id: string | null
    } | null
    if (!book) continue
    if (book.series_id) {
      skipped++
      continue
    }
    const match = detectSeries(book.title, book.authors ?? [])
    if (!match) continue
    if (!groups.has(match.name)) {
      groups.set(match.name, { books: [], curatedTotal: match.totalBooks })
    }
    groups.get(match.name)!.books.push({ bookId: book.id, position: match.position })
  }

  // Upsert series rows and update books
  let seriesCreated = 0
  let seriesUpdated = 0
  let booksMatched = 0

  for (const [name, group] of groups) {
    // Find or create the series
    const { data: existing } = await supabase
      .from('series')
      .select('id, book_count')
      .eq('name', name)
      .maybeSingle()

    let seriesId: string
    // Use the larger of: curated total from detection, existing stored count.
    // Never shrink the count, but always grow toward the canonical total.
    const desiredCount = Math.max(group.curatedTotal, existing?.book_count ?? 0)

    if (existing) {
      seriesId = existing.id
      if (desiredCount !== existing.book_count) {
        await supabase
          .from('series')
          .update({ book_count: desiredCount })
          .eq('id', seriesId)
        seriesUpdated++
      }
    } else {
      const { data: created, error: createErr } = await supabase
        .from('series')
        .insert({ name, book_count: desiredCount })
        .select('id')
        .single()
      if (createErr || !created) continue
      seriesId = created.id
      seriesCreated++
    }

    // Link each book
    for (const b of group.books) {
      const { error: updateErr } = await supabase
        .from('books')
        .update({ series_id: seriesId, series_position: b.position })
        .eq('id', b.bookId)
      if (!updateErr) booksMatched++
    }

    // Also populate the join table for completeness (idempotent)
    if (group.books.length > 0) {
      const rows = group.books.map(b => ({
        series_id: seriesId,
        book_id: b.bookId,
        position: b.position,
      }))
      await supabase.from('series_books').upsert(rows, { onConflict: 'series_id,book_id' })
    }
  }

  // ─── AUDIT PASS ────────────────────────────────────────────────────────────
  // Books that already had series_id set (from a previous scan) were skipped above.
  // Earlier versions of this route stored an incorrect `book_count` (= user's
  // count, not the curated total). Walk through all series the user has and
  // realign their counts with the curated map.
  const alreadyLinked = new Map<string, { title: string; authors: string[] }>()
  for (const ub of userBooks ?? []) {
    const book = ub.book as unknown as {
      title: string
      authors: string[]
      series_id: string | null
    } | null
    if (book?.series_id && book.title && !alreadyLinked.has(book.series_id)) {
      alreadyLinked.set(book.series_id, { title: book.title, authors: book.authors ?? [] })
    }
  }

  let seriesAudited = 0
  for (const [seriesId, sample] of alreadyLinked) {
    const match = detectSeries(sample.title, sample.authors)
    if (!match) continue
    const { data: existing } = await supabase
      .from('series')
      .select('book_count')
      .eq('id', seriesId)
      .maybeSingle()
    if (!existing) continue
    if (existing.book_count !== match.totalBooks) {
      await supabase
        .from('series')
        .update({ book_count: match.totalBooks })
        .eq('id', seriesId)
      seriesAudited++
    }
  }

  return NextResponse.json({
    matched: booksMatched,
    seriesCreated,
    seriesUpdated,
    seriesAudited,
    skipped,
    totalScanned: userBooks?.length ?? 0,
  })
}
