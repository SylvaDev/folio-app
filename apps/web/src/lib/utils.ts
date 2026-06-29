import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: string | null | undefined): string {
  if (!date) return '—'
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function getRatingLabel(rating: number): string {
  const labels: Record<number, string> = { 1: 'Didn\'t like', 2: 'It was ok', 3: 'Liked it', 4: 'Really liked it', 5: 'It was amazing' }
  return labels[rating] ?? ''
}

export function statusLabel(status: string): string {
  const map: Record<string, string> = {
    tbr: 'Want to Read',
    reading: 'Currently Reading',
    read: 'Read',
    dnf: 'Did Not Finish',
    paused: 'On Pause',
  }
  return map[status] ?? status
}

export function truncate(str: string, len: number): string {
  return str.length > len ? str.slice(0, len) + '…' : str
}
