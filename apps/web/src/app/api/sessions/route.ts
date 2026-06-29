import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { badRequest, notFound, serverError, unauthorized } from '@/lib/api-errors'
import { enforceRateLimit } from '@/lib/rate-limit'

/**
 * POST /api/sessions
 *
 * Body: {
 *   user_book_id: string
 *   pages_read: number
 *   minutes_read?: number
 *   session_date?: string (YYYY-MM-DD, defaults to today)
 * }
 *
 * Creates a reading session, increments user_books.pages_read,
 * and auto-marks the book as 'read' if the running total reaches page_count.
 */
export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return unauthorized()

  const limited = await enforceRateLimit(supabase, user.id, 'session.log')
  if (limited) return limited

  let body
  try {
    body = await req.json()
  } catch {
    return badRequest('Invalid JSON')
  }

  const { user_book_id, pages_read, minutes_read, session_date } = body
  const pagesNum = Number(pages_read)
  const minutesNum = minutes_read != null ? Number(minutes_read) : null

  if (!user_book_id || isNaN(pagesNum) || pagesNum < 0) {
    return badRequest('user_book_id and pages_read are required')
  }
  if (pagesNum > 5000) {
    return badRequest('Pages read seems off, max 5000 per session')
  }
  if (minutesNum != null && (isNaN(minutesNum) || minutesNum < 0 || minutesNum > 1440)) {
    return badRequest('Minutes read must be between 0 and 1440')
  }

  // Fetch the user_book and the linked book to compute completion
  const { data: ub, error: ubErr } = await supabase
    .from('user_books')
    .select('id, user_id, status, pages_read, book:books(id, page_count)')
    .eq('id', user_book_id)
    .eq('user_id', user.id)
    .single()

  if (ubErr || !ub) {
    return notFound('Book not found in your library')
  }

  // Insert the session
  const { data: session, error: insertErr } = await supabase
    .from('reading_sessions')
    .insert({
      user_id: user.id,
      user_book_id,
      pages_read: pagesNum,
      minutes_read: minutesNum,
      session_date: session_date ?? new Date().toISOString().split('T')[0],
    })
    .select()
    .single()

  if (insertErr) return serverError('api.sessions.POST', insertErr)

  // Update running pages_read total + flip to 'reading' if currently 'tbr'
  const newTotal = (ub.pages_read ?? 0) + pagesNum
  const book = ub.book as unknown as { id: string; page_count: number | null } | null
  const totalPages = book?.page_count ?? null

  const updates: Record<string, unknown> = { pages_read: newTotal }
  let autoFinished = false

  if (ub.status === 'tbr') {
    updates.status = 'reading'
    updates.date_started = new Date().toISOString().split('T')[0]
  }

  // Auto-finish if we reached the page count
  if (totalPages && newTotal >= totalPages && ub.status !== 'read') {
    updates.status = 'read'
    updates.date_finished = new Date().toISOString().split('T')[0]
    autoFinished = true
  }

  await supabase.from('user_books').update(updates).eq('id', user_book_id)

  return NextResponse.json({ session, newTotal, autoFinished })
}
