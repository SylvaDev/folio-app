import { NextResponse } from 'next/server'

/**
 * Standardized API error responses.
 *
 * The DB-level message (`detail.message`) is LOGGED server-side but never
 * sent to the client. This prevents schema leaks ("constraint X on table Y
 * failed", "column Z not found") that an attacker could use to map the
 * database structure or infer RLS behavior.
 *
 * Pass `tag` to identify the route in server logs (e.g. 'api.comments.POST').
 */

export function serverError(tag: string, detail: unknown): NextResponse {
  console.error(`[${tag}]`, detail)
  return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
}

export function badRequest(message: string, status = 400): NextResponse {
  return NextResponse.json({ error: message }, { status })
}

export function unauthorized(): NextResponse {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}

export function notFound(message = 'Not found'): NextResponse {
  return NextResponse.json({ error: message }, { status: 404 })
}

/**
 * Parse JSON body with a clean 400 fallback. Returns the parsed body OR
 * a Response if parsing failed (caller should `return` it immediately).
 */
export async function parseJson<T = unknown>(
  req: Request,
): Promise<{ ok: true; body: T } | { ok: false; response: NextResponse }> {
  try {
    const body = await req.json()
    return { ok: true, body: body as T }
  } catch {
    return { ok: false, response: badRequest('Invalid JSON body') }
  }
}
