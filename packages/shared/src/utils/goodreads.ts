import type { UserBook, ReadingStatus } from '../types'

interface GoodreadsRow {
  Title: string
  Author: string
  'ISBN': string
  'ISBN13': string
  'My Rating': string
  'Date Read': string
  'Date Added': string
  'Exclusive Shelf': string
  'My Review': string
  'Number of Pages': string
  'Original Publication Year': string
  'Bookshelves': string
  'Bookshelves with positions': string
}

export function parseGoodreadsCSV(csvText: string): Partial<GoodreadsRow>[] {
  const lines = csvText.split('\n').filter(Boolean)
  if (lines.length < 2) return []

  const headers = lines[0].split(',').map(h => h.replace(/^"|"$/g, '').trim())

  return lines.slice(1).map(line => {
    const values = splitCSVRow(line)
    const row: Record<string, string> = {}
    headers.forEach((h, i) => { row[h] = (values[i] ?? '').replace(/^"|"$/g, '').trim() })
    return row as Partial<GoodreadsRow>
  })
}

function splitCSVRow(line: string): string[] {
  const result: string[] = []
  let inQuotes = false
  let current = ''

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current)
      current = ''
    } else {
      current += ch
    }
  }
  result.push(current)
  return result
}

export function mapGoodreadsShelfToStatus(shelf: string): ReadingStatus {
  const s = shelf.toLowerCase()
  if (s === 'read') return 'read'
  if (s === 'currently-reading') return 'reading'
  if (s === 'to-read') return 'tbr'
  return 'tbr'
}

export function formatGoodreadsDate(dateStr: string): string | null {
  if (!dateStr) return null
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return null
  return d.toISOString().split('T')[0]
}
