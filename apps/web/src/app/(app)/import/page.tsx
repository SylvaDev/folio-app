'use client'

import { useState, useRef } from 'react'
import { Upload, FileText, Check, Loader2, AlertCircle, BookOpen, Download } from 'lucide-react'
import { toast } from 'sonner'
import {
  parseGoodreadsCSV,
  mapGoodreadsShelfToStatus,
  formatGoodreadsDate,
  resolveBook,
  stripGoodreadsTitleAnnotations,
} from '@folio/shared'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

interface ParsedBook {
  title: string            // cleaned (no series annotation)
  rawTitle: string         // original from Goodreads
  author: string
  isbn13: string | null
  isbn10: string | null
  rating: number | null
  dateRead: string | null
  dateAdded: string | null
  status: string
  review: string | null
  pages: number | null
}

interface FailedBook {
  title: string
  author: string
  reason: 'no-match' | 'db-error' | 'network'
}

type ImportStep = 'upload' | 'preview' | 'importing' | 'done'

export default function ImportPage() {
  const [step, setStep] = useState<ImportStep>('upload')
  const [parsedBooks, setParsedBooks] = useState<ParsedBook[]>([])
  const [importCount, setImportCount] = useState(0)
  const [progressIndex, setProgressIndex] = useState(0)
  const [failed, setFailed] = useState<FailedBook[]>([])
  const [dragging, setDragging] = useState(false)
  const [strategyCounts, setStrategyCounts] = useState({
    isbn13: 0, isbn10: 0, 'title+author': 0, title: 0,
  })
  const [providerCounts, setProviderCounts] = useState({
    'openlibrary': 0, 'google-books': 0,
  })
  const fileRef = useRef<HTMLInputElement>(null)

  function cleanIsbn(raw: string | undefined): string | null {
    if (!raw) return null
    // Goodreads wraps ISBNs as ="123456789" to keep Excel from mangling them
    const cleaned = raw.replace(/[="]/g, '').trim()
    if (!cleaned) return null
    const digits = cleaned.replace(/[^0-9Xx]/g, '')
    if (digits.length !== 10 && digits.length !== 13) return null
    return digits
  }

  function handleFile(file: File) {
    const reader = new FileReader()
    reader.onload = e => {
      const text = e.target?.result as string
      const rows = parseGoodreadsCSV(text)

      const books: ParsedBook[] = rows
        .map(row => {
          const rawTitle = row['Title'] ?? ''
          const isbn13Raw = cleanIsbn(row['ISBN13'])
          const isbn10Raw = cleanIsbn(row['ISBN'])
          return {
            rawTitle,
            title: stripGoodreadsTitleAnnotations(rawTitle),
            author: (row['Author'] ?? '').replace(/\s+/g, ' ').trim(),
            isbn13: isbn13Raw && isbn13Raw.length === 13 ? isbn13Raw : null,
            isbn10: isbn10Raw && isbn10Raw.length === 10 ? isbn10Raw : null,
            rating: row['My Rating'] ? parseInt(row['My Rating']) || null : null,
            dateRead: formatGoodreadsDate(row['Date Read'] ?? ''),
            dateAdded: formatGoodreadsDate(row['Date Added'] ?? ''),
            status: mapGoodreadsShelfToStatus(row['Exclusive Shelf'] ?? 'to-read'),
            review: row['My Review'] || null,
            pages: row['Number of Pages'] ? parseInt(row['Number of Pages']) || null : null,
          }
        })
        .filter(b => b.title)

      setParsedBooks(books)
      setStep('preview')
    }
    reader.readAsText(file)
  }

  async function runImport() {
    setStep('importing')
    setProgressIndex(0)
    setFailed([])
    setStrategyCounts({ isbn13: 0, isbn10: 0, 'title+author': 0, title: 0 })

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    let imported = 0
    const failures: FailedBook[] = []
    const strategies = { isbn13: 0, isbn10: 0, 'title+author': 0, title: 0 }
    const providers = { 'openlibrary': 0, 'google-books': 0 }
    const BATCH = 5  // smaller batch — fewer fallback requests at once
    const BATCH_DELAY_MS = 300  // be polite to Open Library

    for (let i = 0; i < parsedBooks.length; i += BATCH) {
      const batch = parsedBooks.slice(i, i + BATCH)

      await Promise.all(batch.map(async (pb) => {
        try {
          const resolution = await resolveBook({
            title: pb.title,
            author: pb.author,
            isbn13: pb.isbn13,
            isbn10: pb.isbn10,
          })

          if (!resolution) {
            failures.push({ title: pb.rawTitle, author: pb.author, reason: 'no-match' })
            return
          }

          strategies[resolution.strategy]++
          providers[resolution.provider]++
          const result = resolution.result

          // Pick the best cover URL:
          //  - Google Books results carry their own URL via `cover_url_override`
          //  - Open Library results give us a numeric cover ID
          //  - Fall back to OL's ISBN-based cover URL (works for many editions)
          const coverUrl = result.cover_url_override
            ?? (result.cover_i ? `https://covers.openlibrary.org/b/id/${result.cover_i}-M.jpg` : null)
            ?? (pb.isbn13 ? `https://covers.openlibrary.org/b/isbn/${pb.isbn13}-M.jpg` : null)

          const bookData = {
            ol_key: result.key, // can be "/works/OL..." or "google:VOLUMEID"
            title: pb.title || result.title,
            authors: result.author_name?.length ? result.author_name : [pb.author],
            cover_url: coverUrl,
            cover_id: result.cover_i ?? null,
            page_count: pb.pages ?? result.number_of_pages_median ?? null,
            isbn_13: pb.isbn13 ?? result.isbn?.find((s: string) => s.length === 13) ?? null,
            isbn_10: pb.isbn10 ?? result.isbn?.find((s: string) => s.length === 10) ?? null,
            genres: result.subject?.slice(0, 10) ?? [],
            description: null,
            first_publish_year: result.first_publish_year ?? null,
          }

          const { data: book, error: bookErr } = await supabase
            .from('books')
            .upsert(bookData, { onConflict: 'ol_key' })
            .select()
            .single()

          if (bookErr || !book) {
            failures.push({ title: pb.rawTitle, author: pb.author, reason: 'db-error' })
            return
          }

          const { error: ubErr } = await supabase.from('user_books').upsert({
            user_id: user.id,
            book_id: book.id,
            status: pb.status,
            rating: pb.rating && pb.rating > 0 ? pb.rating : null,
            date_finished: pb.dateRead,
            date_added: pb.dateAdded ?? new Date().toISOString(),
            review: pb.review,
          }, { onConflict: 'user_id,book_id' })

          if (ubErr) {
            failures.push({ title: pb.rawTitle, author: pb.author, reason: 'db-error' })
            return
          }

          imported++
        } catch {
          failures.push({ title: pb.rawTitle, author: pb.author, reason: 'network' })
        }
      }))

      setProgressIndex(Math.min(i + BATCH, parsedBooks.length))
      // throttle batches to stay polite with Open Library
      if (i + BATCH < parsedBooks.length) {
        await new Promise(resolve => setTimeout(resolve, BATCH_DELAY_MS))
      }
    }

    await supabase.from('profiles').update({ goodreads_imported: true }).eq('id', user.id)

    setImportCount(imported)
    setFailed(failures)
    setStrategyCounts(strategies)
    setProviderCounts(providers)
    setStep('done')
    toast.success(`Imported ${imported} of ${parsedBooks.length} books from Goodreads`)
  }

  function downloadFailedList() {
    if (failed.length === 0) return
    const csv = [
      'Title,Author,Reason',
      ...failed.map(f => `"${f.title.replace(/"/g, '""')}","${f.author.replace(/"/g, '""')}",${f.reason}`),
    ].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'folio-import-unmatched.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="page-title mb-1">Import from Goodreads</h1>
        <p className="text-gray-500 text-sm">Bring your entire reading history to Folio in minutes.</p>
      </div>

      {step === 'upload' && (
        <div>
          {/* Instructions */}
          <div className="card p-5 mb-5">
            <h2 className="font-semibold text-forest mb-3">How to export from Goodreads</h2>
            <ol className="space-y-2">
              {[
                'Go to goodreads.com → My Books',
                'Click "Import and Export" at the bottom of the left sidebar',
                'Click "Export Library" and wait for the file',
                'Upload the CSV file below',
              ].map((step, i) => (
                <li key={i} className="flex items-start gap-3 text-sm text-gray-600">
                  <span className="w-6 h-6 rounded-full bg-cream text-forest text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                    {i + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
          </div>

          {/* Drop zone */}
          <div
            onClick={() => fileRef.current?.click()}
            onDragOver={e => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={e => {
              e.preventDefault()
              setDragging(false)
              const file = e.dataTransfer.files[0]
              if (file?.name.endsWith('.csv')) handleFile(file)
              else toast.error('Please upload a CSV file')
            }}
            className={cn(
              'border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all',
              dragging ? 'border-mint bg-mint/5' : 'border-gray-200 hover:border-mint/50 hover:bg-cream/30',
            )}
          >
            <input
              ref={fileRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
            />
            <Upload className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="font-semibold text-forest">Drop your Goodreads CSV here</p>
            <p className="text-sm text-gray-400 mt-1">or click to browse</p>
          </div>
        </div>
      )}

      {step === 'preview' && (
        <div>
          <div className="card p-5 mb-5">
            <div className="flex items-center gap-3 mb-4">
              <FileText className="w-5 h-5 text-mint" />
              <div>
                <p className="font-semibold text-forest">{parsedBooks.length} books found</p>
                <p className="text-sm text-gray-500">Ready to import to your Folio library</p>
              </div>
            </div>

            {/* Sample */}
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {parsedBooks.slice(0, 8).map((book, i) => (
                <div key={i} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
                  <BookOpen className="w-4 h-4 text-gray-300 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-forest truncate">{book.title}</p>
                    <p className="text-xs text-gray-400 truncate">{book.author}</p>
                  </div>
                  <span className={cn('badge text-xs', `badge-${book.status}`)}>
                    {book.status === 'tbr' ? 'TBR' : book.status === 'reading' ? 'Reading' : 'Read'}
                  </span>
                </div>
              ))}
              {parsedBooks.length > 8 && (
                <p className="text-xs text-gray-400 text-center pt-1">
                  +{parsedBooks.length - 8} more books
                </p>
              )}
            </div>
          </div>

          <div className="flex gap-3">
            <button onClick={() => setStep('upload')} className="btn-ghost">
              ← Back
            </button>
            <button onClick={runImport} className="btn-primary flex-1 justify-center">
              Import {parsedBooks.length} books →
            </button>
          </div>
        </div>
      )}

      {step === 'importing' && (
        <div className="card p-12 text-center">
          <Loader2 className="w-12 h-12 text-mint animate-spin mx-auto mb-4" />
          <p className="font-semibold text-forest">Importing your books…</p>
          <p className="text-sm text-gray-500 mt-1">
            {progressIndex} of {parsedBooks.length} processed
          </p>
          <p className="text-xs text-gray-400 mt-1">
            Trying ISBN match first, then title + author
          </p>
          <div className="h-2 bg-gray-100 rounded-full mt-4 overflow-hidden max-w-xs mx-auto">
            <div
              className="h-full bg-mint rounded-full transition-all"
              style={{ width: `${(progressIndex / parsedBooks.length) * 100}%` }}
            />
          </div>
        </div>
      )}

      {step === 'done' && (
        <div className="card p-8">
          <div className="text-center">
            <div className="w-16 h-16 bg-mint/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check className="w-8 h-8 text-mint" />
            </div>
            <h2 className="font-serif text-2xl font-bold text-forest mb-2">Import complete!</h2>
            <p className="text-gray-500 mb-1">
              <span className="font-semibold text-forest">{importCount} books</span> added to your library
              <span className="text-gray-400"> · </span>
              <span className="text-gray-400">{Math.round((importCount / parsedBooks.length) * 100)}% match rate</span>
            </p>
          </div>

          {/* Strategy breakdown */}
          {importCount > 0 && (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-6 max-w-lg mx-auto">
                {[
                  { label: 'Via ISBN-13', value: strategyCounts.isbn13, color: 'bg-mint/15 text-forest' },
                  { label: 'Via ISBN-10', value: strategyCounts.isbn10, color: 'bg-mint/15 text-forest' },
                  { label: 'Title + author', value: strategyCounts['title+author'], color: 'bg-cream text-forest' },
                  { label: 'Title only', value: strategyCounts.title, color: 'bg-cream text-forest' },
                ].map(s => (
                  <div key={s.label} className={cn('rounded-xl p-3 text-center', s.color)}>
                    <p className="font-serif text-xl font-bold">{s.value}</p>
                    <p className="text-xs opacity-70 leading-tight">{s.label}</p>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-center gap-4 mt-3 mb-2 text-xs text-gray-500">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-forest" />
                  {providerCounts['openlibrary']} via Open Library
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-terra" />
                  {providerCounts['google-books']} via Google Books
                </span>
              </div>
            </>
          )}

          {/* Unmatched list */}
          {failed.length > 0 && (
            <div className="mt-6 pt-6 border-t border-gray-100">
              <div className="flex items-start gap-3 mb-3">
                <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-semibold text-forest">
                    {failed.length} book{failed.length === 1 ? '' : 's'} couldn&apos;t be matched
                  </p>
                  <p className="text-sm text-gray-500">
                    Mostly indie/very-new titles Open Library doesn&apos;t have yet. You can add them
                    manually via the search bar, or download the list to come back to.
                  </p>
                </div>
              </div>

              <div className="bg-gray-50 rounded-xl max-h-48 overflow-y-auto p-3 space-y-1 mb-3">
                {failed.slice(0, 20).map((f, i) => (
                  <div key={i} className="text-xs text-gray-600 flex items-start gap-2">
                    <span className="text-gray-300">·</span>
                    <span className="flex-1">
                      <span className="font-medium text-forest">{f.title}</span>
                      <span className="text-gray-400"> · {f.author}</span>
                    </span>
                  </div>
                ))}
                {failed.length > 20 && (
                  <p className="text-xs text-gray-400 text-center pt-1">
                    +{failed.length - 20} more
                  </p>
                )}
              </div>

              <button
                onClick={downloadFailedList}
                className="btn-ghost text-xs"
              >
                <Download className="w-3.5 h-3.5" aria-hidden />
                Download unmatched list (CSV)
              </button>
            </div>
          )}

          <div className="flex justify-center mt-6">
            <a href="/library" className="btn-primary inline-flex">
              Go to my library →
            </a>
          </div>
        </div>
      )}
    </div>
  )
}
