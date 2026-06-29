/**
 * Curated series detection.
 *
 * Open Library's series data is unreliable, so we maintain a small map of
 * popular series and match titles against it. This covers ~80% of what
 * typical beta users will have in their libraries.
 *
 * To extend: add an entry to SERIES_MAP. Keys are matched against normalized
 * book titles (lowercased, stripped of "the/a/an" prefix, punctuation removed).
 */

export interface SeriesMatch {
  name: string
  position: number
  totalBooks: number
  authorMatch?: string
}

interface SeriesDefinition {
  name: string
  authorPattern?: RegExp  // optional author check to disambiguate (e.g. "Dune" by Herbert vs. covers)
  books: { title: string; position: number; isNovella?: boolean }[]
}

const SERIES_DEFINITIONS: SeriesDefinition[] = [
  // ─── Brandon Sanderson ─────────────────────────────────────────────────
  {
    name: 'The Stormlight Archive',
    authorPattern: /sanderson/i,
    books: [
      { title: 'The Way of Kings', position: 1 },
      { title: 'Words of Radiance', position: 2 },
      { title: 'Edgedancer', position: 2.5, isNovella: true },
      { title: 'Oathbringer', position: 3 },
      { title: 'Dawnshard', position: 3.5, isNovella: true },
      { title: 'Rhythm of War', position: 4 },
      { title: 'Wind and Truth', position: 5 },
    ],
  },
  {
    name: 'Mistborn: Era One',
    authorPattern: /sanderson/i,
    books: [
      { title: 'The Final Empire', position: 1 },
      { title: 'Mistborn', position: 1 },
      { title: 'Mistborn: The Final Empire', position: 1 },
      { title: 'The Well of Ascension', position: 2 },
      { title: 'The Hero of Ages', position: 3 },
    ],
  },
  {
    name: 'Mistborn: Era Two (Wax & Wayne)',
    authorPattern: /sanderson/i,
    books: [
      { title: 'The Alloy of Law', position: 1 },
      { title: 'Shadows of Self', position: 2 },
      { title: 'The Bands of Mourning', position: 3 },
      { title: 'The Lost Metal', position: 4 },
    ],
  },

  // ─── George R.R. Martin ────────────────────────────────────────────────
  {
    name: 'A Song of Ice and Fire',
    authorPattern: /martin/i,
    books: [
      { title: 'A Game of Thrones', position: 1 },
      { title: 'A Clash of Kings', position: 2 },
      { title: 'A Storm of Swords', position: 3 },
      { title: 'A Feast for Crows', position: 4 },
      { title: 'A Dance with Dragons', position: 5 },
    ],
  },

  // ─── Frank Herbert ─────────────────────────────────────────────────────
  {
    name: 'Dune',
    authorPattern: /herbert/i,
    books: [
      { title: 'Dune', position: 1 },
      { title: 'Dune Messiah', position: 2 },
      { title: 'Children of Dune', position: 3 },
      { title: 'God Emperor of Dune', position: 4 },
      { title: 'Heretics of Dune', position: 5 },
      { title: 'Chapterhouse: Dune', position: 6 },
    ],
  },

  // ─── Patrick Rothfuss ──────────────────────────────────────────────────
  {
    name: 'The Kingkiller Chronicle',
    authorPattern: /rothfuss/i,
    books: [
      { title: 'The Name of the Wind', position: 1 },
      { title: "The Wise Man's Fear", position: 2 },
      { title: 'The Slow Regard of Silent Things', position: 2.5, isNovella: true },
    ],
  },

  // ─── Rebecca Yarros ────────────────────────────────────────────────────
  {
    name: 'The Empyrean',
    authorPattern: /yarros/i,
    books: [
      { title: 'Fourth Wing', position: 1 },
      { title: 'Iron Flame', position: 2 },
      { title: 'Onyx Storm', position: 3 },
    ],
  },

  // ─── Liu Cixin ─────────────────────────────────────────────────────────
  {
    name: "Remembrance of Earth's Past",
    authorPattern: /cixin|liu/i,
    books: [
      { title: 'The Three-Body Problem', position: 1 },
      { title: 'The Dark Forest', position: 2 },
      { title: "Death's End", position: 3 },
    ],
  },

  // ─── Olivie Blake ──────────────────────────────────────────────────────
  {
    name: 'The Atlas',
    authorPattern: /blake/i,
    books: [
      { title: 'The Atlas Six', position: 1 },
      { title: 'The Atlas Paradox', position: 2 },
      { title: 'The Atlas Complicit', position: 3 },
    ],
  },

  // ─── N.K. Jemisin ──────────────────────────────────────────────────────
  {
    name: 'The Broken Earth',
    authorPattern: /jemisin/i,
    books: [
      { title: 'The Fifth Season', position: 1 },
      { title: 'The Obelisk Gate', position: 2 },
      { title: 'The Stone Sky', position: 3 },
    ],
  },

  // ─── Blake Crouch ──────────────────────────────────────────────────────
  // Note: Dark Matter and Recursion are standalones, not a series.

  // ─── J.R.R. Tolkien ────────────────────────────────────────────────────
  {
    name: 'The Lord of the Rings',
    authorPattern: /tolkien/i,
    books: [
      { title: 'The Fellowship of the Ring', position: 1 },
      { title: 'The Two Towers', position: 2 },
      { title: 'The Return of the King', position: 3 },
    ],
  },

  // ─── J.K. Rowling ──────────────────────────────────────────────────────
  {
    name: 'Harry Potter',
    authorPattern: /rowling/i,
    books: [
      { title: "Harry Potter and the Philosopher's Stone", position: 1 },
      { title: "Harry Potter and the Sorcerer's Stone", position: 1 },
      { title: 'Harry Potter and the Chamber of Secrets', position: 2 },
      { title: 'Harry Potter and the Prisoner of Azkaban', position: 3 },
      { title: 'Harry Potter and the Goblet of Fire', position: 4 },
      { title: 'Harry Potter and the Order of the Phoenix', position: 5 },
      { title: 'Harry Potter and the Half-Blood Prince', position: 6 },
      { title: 'Harry Potter and the Deathly Hallows', position: 7 },
    ],
  },

  // ─── Robert Jordan ─────────────────────────────────────────────────────
  {
    name: 'The Wheel of Time',
    authorPattern: /jordan|sanderson/i,
    books: [
      { title: 'The Eye of the World', position: 1 },
      { title: 'The Great Hunt', position: 2 },
      { title: 'The Dragon Reborn', position: 3 },
      { title: 'The Shadow Rising', position: 4 },
      { title: 'The Fires of Heaven', position: 5 },
      { title: 'Lord of Chaos', position: 6 },
      { title: 'A Crown of Swords', position: 7 },
      { title: 'The Path of Daggers', position: 8 },
      { title: "Winter's Heart", position: 9 },
      { title: 'Crossroads of Twilight', position: 10 },
      { title: 'Knife of Dreams', position: 11 },
      { title: 'The Gathering Storm', position: 12 },
      { title: 'Towers of Midnight', position: 13 },
      { title: 'A Memory of Light', position: 14 },
    ],
  },

  // ─── Sarah J. Maas ─────────────────────────────────────────────────────
  {
    name: 'A Court of Thorns and Roses',
    authorPattern: /maas/i,
    books: [
      { title: 'A Court of Thorns and Roses', position: 1 },
      { title: 'A Court of Mist and Fury', position: 2 },
      { title: 'A Court of Wings and Ruin', position: 3 },
      { title: 'A Court of Frost and Starlight', position: 3.5, isNovella: true },
      { title: 'A Court of Silver Flames', position: 4 },
    ],
  },
  {
    name: 'Throne of Glass',
    authorPattern: /maas/i,
    books: [
      { title: 'The Assassin\'s Blade', position: 0.1, isNovella: true },
      { title: 'Throne of Glass', position: 1 },
      { title: 'Crown of Midnight', position: 2 },
      { title: 'Heir of Fire', position: 3 },
      { title: 'Queen of Shadows', position: 4 },
      { title: 'Empire of Storms', position: 5 },
      { title: 'Tower of Dawn', position: 5.5 },
      { title: 'Kingdom of Ash', position: 6 },
    ],
  },
  {
    name: 'Crescent City',
    authorPattern: /maas/i,
    books: [
      { title: 'House of Earth and Blood', position: 1 },
      { title: 'House of Sky and Breath', position: 2 },
      { title: 'House of Flame and Shadow', position: 3 },
    ],
  },

  // ─── Leigh Bardugo ─────────────────────────────────────────────────────
  {
    name: 'Six of Crows',
    authorPattern: /bardugo/i,
    books: [
      { title: 'Six of Crows', position: 1 },
      { title: 'Crooked Kingdom', position: 2 },
    ],
  },
  {
    name: 'Shadow and Bone (Grishaverse)',
    authorPattern: /bardugo/i,
    books: [
      { title: 'Shadow and Bone', position: 1 },
      { title: 'Siege and Storm', position: 2 },
      { title: 'Ruin and Rising', position: 3 },
    ],
  },

  // ─── Suzanne Collins ───────────────────────────────────────────────────
  {
    name: 'The Hunger Games',
    authorPattern: /collins/i,
    books: [
      { title: 'The Hunger Games', position: 1 },
      { title: 'Catching Fire', position: 2 },
      { title: 'Mockingjay', position: 3 },
      { title: 'The Ballad of Songbirds and Snakes', position: 0 },
      { title: 'Sunrise on the Reaping', position: 0.5 },
    ],
  },

  // ─── Pierce Brown ──────────────────────────────────────────────────────
  {
    name: 'Red Rising Saga',
    authorPattern: /brown/i,
    books: [
      { title: 'Red Rising', position: 1 },
      { title: 'Golden Son', position: 2 },
      { title: 'Morning Star', position: 3 },
      { title: 'Iron Gold', position: 4 },
      { title: 'Dark Age', position: 5 },
      { title: 'Light Bringer', position: 6 },
    ],
  },

  // ─── Joe Abercrombie ───────────────────────────────────────────────────
  {
    name: 'The First Law',
    authorPattern: /abercrombie/i,
    books: [
      { title: 'The Blade Itself', position: 1 },
      { title: 'Before They Are Hanged', position: 2 },
      { title: 'Last Argument of Kings', position: 3 },
    ],
  },

  // ─── Tamsyn Muir ───────────────────────────────────────────────────────
  {
    name: 'The Locked Tomb',
    authorPattern: /muir/i,
    books: [
      { title: 'Gideon the Ninth', position: 1 },
      { title: 'Harrow the Ninth', position: 2 },
      { title: 'Nona the Ninth', position: 3 },
    ],
  },

  // ─── Andy Weir ─────────────────────────────────────────────────────────
  // Project Hail Mary, The Martian, Artemis — all standalones.

  // ─── Christopher Paolini ───────────────────────────────────────────────
  {
    name: 'The Inheritance Cycle',
    authorPattern: /paolini/i,
    books: [
      { title: 'Eragon', position: 1 },
      { title: 'Eldest', position: 2 },
      { title: 'Brisingr', position: 3 },
      { title: 'Inheritance', position: 4 },
    ],
  },
]

/**
 * Build a lookup index from normalized title → array of (definition, position).
 * Same title can appear in multiple series via aliases; we use author to disambiguate.
 */
function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[''`]/g, "'")
    .replace(/^(the|a|an)\s+/i, '')
    .replace(/[.,;:!?\-—()]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

interface IndexEntry {
  series: SeriesDefinition
  position: number
  isNovella?: boolean
}

const TITLE_INDEX: Map<string, IndexEntry[]> = (() => {
  const idx = new Map<string, IndexEntry[]>()
  for (const series of SERIES_DEFINITIONS) {
    for (const b of series.books) {
      const key = normalize(b.title)
      if (!idx.has(key)) idx.set(key, [])
      idx.get(key)!.push({ series, position: b.position, isNovella: b.isNovella })
    }
  }
  return idx
})()

export function detectSeries(title: string, authors: string[] = []): SeriesMatch | null {
  const norm = normalize(title)
  const candidates = TITLE_INDEX.get(norm)
  if (!candidates || candidates.length === 0) return null

  const authorStr = authors.join(' ')

  // If only one candidate, return it (no author disambiguation needed)
  if (candidates.length === 1) {
    const c = candidates[0]
    // Soft check: if there's an author pattern and we have authors, verify
    if (c.series.authorPattern && authorStr && !c.series.authorPattern.test(authorStr)) {
      return null
    }
    return {
      name: c.series.name,
      position: c.position,
      totalBooks: countUniqueSlots(c.series),
      authorMatch: c.series.authorPattern?.source,
    }
  }

  // Multiple candidates: use author to disambiguate
  for (const c of candidates) {
    if (c.series.authorPattern && c.series.authorPattern.test(authorStr)) {
      return {
        name: c.series.name,
        position: c.position,
        totalBooks: countUniqueSlots(c.series),
        authorMatch: c.series.authorPattern.source,
      }
    }
  }

  return null
}

/**
 * Count unique "slots" (positions) in a series.
 * Aliases share a position — they shouldn't count twice.
 * Novellas are included because they're real books a user can read; excluding
 * them caused "6 of 5 read" when users marked a novella as read.
 */
function countUniqueSlots(series: SeriesDefinition): number {
  return new Set(series.books.map(b => b.position)).size
}

/**
 * Returns all known series names (for UI dropdowns, autocomplete).
 */
export function getKnownSeriesNames(): string[] {
  return SERIES_DEFINITIONS.map(s => s.name)
}
