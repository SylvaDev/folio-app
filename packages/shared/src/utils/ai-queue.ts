import type { UserBook } from '../types'

export interface QueueScore {
  userBookId: string
  score: number
  reasons: string[]
}

const MOOD_WEIGHTS: Record<string, string[]> = {
  calm: ['literary fiction', 'contemporary', 'poetry', 'memoir'],
  adventurous: ['fantasy', 'adventure', 'science fiction', 'thriller'],
  dark: ['horror', 'dark fantasy', 'psychological thriller', 'noir'],
  funny: ['humor', 'comedy', 'satire', 'cozy mystery'],
  romantic: ['romance', 'contemporary romance', 'historical romance'],
  educational: ['nonfiction', 'history', 'science', 'biography', 'self-help'],
}

/**
 * Score TBR books to recommend what to read next.
 * Used server-side to pre-rank the queue before AI enhancement.
 */
export function scoreTBRQueue(
  books: UserBook[],
  currentMood?: string,
  recentlyReadGenres: string[] = [],
): QueueScore[] {
  return books
    .filter(b => b.status === 'tbr')
    .map(b => {
      let score = 0
      const reasons: string[] = []

      // Priority (user-set, 1-5)
      if (b.priority) {
        score += b.priority * 10
        if (b.priority >= 4) reasons.push('High priority')
      }

      // Mood match
      if (currentMood && b.mood_tags?.length) {
        const moodGenres = MOOD_WEIGHTS[currentMood] ?? []
        const bookGenres = b.book?.genres ?? []
        const overlap = moodGenres.filter(g =>
          bookGenres.some(bg => bg.toLowerCase().includes(g))
        )
        if (overlap.length > 0) {
          score += overlap.length * 8
          reasons.push(`Matches your ${currentMood} mood`)
        }
      }

      // Avoid genre fatigue — penalize genres read in last 3 books
      const bookGenres = b.book?.genres ?? []
      const fatigue = recentlyReadGenres.filter(g =>
        bookGenres.some(bg => bg.toLowerCase().includes(g))
      )
      score -= fatigue.length * 5

      // Shorter books score slightly higher when queue is long
      const pages = b.book?.page_count ?? 300
      if (pages < 250) score += 3
      else if (pages > 600) score -= 3

      // Favorite flag bonus
      if (b.is_favorite) { score += 5; reasons.push('Favorited') }

      // Recency — recently added books get a small bump
      const daysAgo = Math.floor((Date.now() - new Date(b.date_added).getTime()) / 86400000)
      if (daysAgo < 14) { score += 2; reasons.push('Recently added') }

      return { userBookId: b.id, score, reasons }
    })
    .sort((a, b) => b.score - a.score)
}
