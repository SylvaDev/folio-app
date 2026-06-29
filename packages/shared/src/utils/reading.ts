import type { UserBook, ReadingStats } from '../types'

export function calcReadingStreak(sessions: { session_date: string }[]): { current: number; longest: number } {
  if (!sessions.length) return { current: 0, longest: 0 }

  const dates = [...new Set(sessions.map(s => s.session_date))].sort().reverse()
  const today = new Date().toISOString().split('T')[0]

  let current = 0
  let longest = 0
  let streak = 0
  let prev: string | null = null

  for (const date of dates) {
    if (!prev) {
      if (date === today || isYesterday(date, today)) {
        streak = 1
      } else {
        break
      }
    } else {
      if (isYesterday(date, prev)) {
        streak++
      } else {
        break
      }
    }
    prev = date
    if (streak > current) current = streak
  }

  // compute longest streak from all sessions
  const allDates = [...new Set(sessions.map(s => s.session_date))].sort()
  let run = 1
  for (let i = 1; i < allDates.length; i++) {
    if (isYesterday(allDates[i - 1], allDates[i])) {
      run++
    } else {
      if (run > longest) longest = run
      run = 1
    }
  }
  if (run > longest) longest = run

  return { current, longest }
}

function isYesterday(a: string, b: string): boolean {
  const da = new Date(a)
  const db = new Date(b)
  da.setDate(da.getDate() + 1)
  return da.toISOString().split('T')[0] === b
}

export function calcCompletionRate(books: UserBook[]): number {
  const started = books.filter(b => b.status === 'reading' || b.status === 'read' || b.status === 'dnf' || b.status === 'paused')
  if (!started.length) return 0
  const finished = started.filter(b => b.status === 'read')
  return Math.round((finished.length / started.length) * 100)
}

export function formatReadingTime(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

export function getBooksThisYear(books: UserBook[]): UserBook[] {
  const year = new Date().getFullYear().toString()
  return books.filter(b => b.date_finished?.startsWith(year) || b.date_started?.startsWith(year))
}
