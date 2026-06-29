import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { badRequest, parseJson, serverError, unauthorized } from '@/lib/api-errors'

const USERNAME_RE = /^[a-z0-9][a-z0-9-]{2,29}$/
const RESERVED = new Set([
  'admin', 'root', 'system', 'about', 'help', 'support', 'login', 'signup',
  'logout', 'auth', 'api', 'app', 'settings', 'profile', 'feed', 'home',
  'discover', 'explore', 'search', 'library', 'tbr', 'series', 'analytics',
  'clubs', 'import', 'onboarding', 'u', 'b', 'book', 'books', 'user', 'users',
  'folio', 'getfolio', 'undefined', 'null',
])

function validate(username: string): { ok: boolean; error?: string } {
  if (!username) return { ok: false, error: 'Username is required' }
  if (username.length < 3) return { ok: false, error: 'Must be at least 3 characters' }
  if (username.length > 30) return { ok: false, error: 'Must be 30 characters or fewer' }
  if (!USERNAME_RE.test(username)) {
    return { ok: false, error: 'Use lowercase letters, numbers, and dashes only. Must start with a letter or number.' }
  }
  if (RESERVED.has(username)) return { ok: false, error: 'That username is reserved' }
  return { ok: true }
}

/**
 * GET /api/username?check=irving-silva
 * Returns { available: true|false, error?: string }
 */
export async function GET(req: Request) {
  const url = new URL(req.url)
  const candidate = (url.searchParams.get('check') ?? '').toLowerCase().trim()

  const v = validate(candidate)
  if (!v.ok) return NextResponse.json({ available: false, error: v.error })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: existing } = await supabase
    .from('profiles')
    .select('id')
    .eq('username', candidate)
    .maybeSingle()

  // If it's already taken by someone else, mark unavailable.
  // If it's the current user's existing username, mark as "available" (no-op).
  const isMine = existing?.id === user?.id
  return NextResponse.json({
    available: !existing || isMine,
    error: existing && !isMine ? 'Already taken' : undefined,
  })
}

/**
 * POST /api/username  { username: 'irving-silva' }
 * Claims the username for the authenticated user.
 */
export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return unauthorized()

  const parsed = await parseJson<{ username?: string }>(req)
  if (!parsed.ok) return parsed.response

  const username = (parsed.body.username ?? '').toLowerCase().trim()
  const v = validate(username)
  if (!v.ok) return badRequest(v.error ?? 'Invalid username')

  // Check availability one last time (race conditions)
  const { data: existing } = await supabase
    .from('profiles')
    .select('id')
    .eq('username', username)
    .maybeSingle()

  if (existing && existing.id !== user.id) {
    return NextResponse.json({ error: 'Already taken' }, { status: 409 })
  }

  const { error: updateErr } = await supabase
    .from('profiles')
    .update({ username })
    .eq('id', user.id)

  if (updateErr) return serverError('api.username.POST', updateErr)
  return NextResponse.json({ ok: true, username })
}
