'use client'

import { useState, useEffect } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Clock, BookOpen, Loader2, X, PartyPopper } from 'lucide-react'
import type { UserBook } from '@folio/shared'
import { cn } from '@/lib/utils'

interface Props {
  userBook: UserBook
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function LogSessionDialog({ userBook, open, onOpenChange }: Props) {
  const router = useRouter()
  const book = userBook.book
  const [pages, setPages] = useState('')
  const [minutes, setMinutes] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      setPages('')
      setMinutes('')
    }
  }, [open])

  const pagesNum = parseInt(pages, 10) || 0
  const minutesNum = parseInt(minutes, 10) || 0
  const totalPages = book?.page_count ?? null
  const currentProgress = userBook.pages_read ?? 0
  const newTotal = currentProgress + pagesNum
  const newPercent = totalPages ? Math.min(100, (newTotal / totalPages) * 100) : 0
  const willFinish = totalPages !== null && newTotal >= totalPages
  const pace = pagesNum > 0 && minutesNum > 0 ? (pagesNum / minutesNum).toFixed(1) : null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (pagesNum <= 0) {
      toast.error('Enter the number of pages you read.')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_book_id: userBook.id,
          pages_read: pagesNum,
          minutes_read: minutesNum || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'Could not log session')
        return
      }
      if (data.autoFinished) {
        toast.success(`You finished ${book?.title}.`)
      } else {
        toast.success(`Logged ${pagesNum} pages${minutesNum ? ` (${minutesNum} min)` : ''}.`)
      }
      onOpenChange(false)
      router.refresh()
    } catch {
      toast.error('Network error, try again')
    } finally {
      setSubmitting(false)
    }
  }

  if (!book) return null

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-forest/30 backdrop-blur-sm data-[state=open]:animate-in data-[state=open]:fade-in" />
        <Dialog.Content
          className={cn(
            'fixed left-1/2 top-1/2 z-50 w-[92vw] max-w-md -translate-x-1/2 -translate-y-1/2',
            'bg-white rounded-3xl shadow-2xl p-6 focus:outline-none',
          )}
        >
          <div className="flex items-start justify-between mb-1">
            <Dialog.Title className="font-serif text-2xl font-bold text-forest">
              Log reading session
            </Dialog.Title>
            <Dialog.Close className="text-gray-400 hover:text-forest p-1 -m-1 rounded-full hover:bg-gray-100 transition-colors">
              <X className="w-5 h-5" />
            </Dialog.Close>
          </div>

          <Dialog.Description className="text-sm text-gray-500 mb-5 line-clamp-1">
            {book.title} · {book.authors?.[0]}
          </Dialog.Description>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Pages read */}
            <div>
              <label className="label flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5 text-forest" />
                Pages read
              </label>
              <input
                type="number"
                inputMode="numeric"
                min={1}
                max={5000}
                autoFocus
                value={pages}
                onChange={e => setPages(e.target.value)}
                className="input"
                placeholder="e.g. 42"
              />
              {totalPages && (
                <p className="text-xs text-gray-400 mt-1">
                  Currently on page {currentProgress} of {totalPages}
                </p>
              )}
            </div>

            {/* Minutes read */}
            <div>
              <label className="label flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-forest" />
                Time read <span className="text-gray-400 font-normal normal-case">(optional)</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={1440}
                  value={minutes}
                  onChange={e => setMinutes(e.target.value)}
                  className="input pr-16"
                  placeholder="e.g. 45"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-gray-400">minutes</span>
              </div>
              {pace && (
                <p className="text-xs text-mint mt-1">
                  Pace: {pace} pages/min · {(Number(pace) * 60).toFixed(0)} pages/hr
                </p>
              )}
            </div>

            {/* Progress preview */}
            {totalPages && pagesNum > 0 && (
              <div className="bg-cream rounded-2xl p-4">
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="text-gray-500">After this session</span>
                  <span className="font-semibold text-forest">
                    {newTotal} / {totalPages} pages
                  </span>
                </div>
                <div className="h-2 bg-white rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-forest to-mint rounded-full transition-all duration-500"
                    style={{ width: `${newPercent}%` }}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1.5 text-right">
                  {newPercent.toFixed(0)}% complete
                </p>
                {willFinish && (
                  <div className="mt-3 flex items-center gap-2 p-2.5 bg-mint/15 rounded-xl">
                    <PartyPopper className="w-4 h-4 text-forest flex-shrink-0" />
                    <p className="text-xs text-forest font-medium">
                      This session will finish the book! It&apos;ll be moved to Read.
                    </p>
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <Dialog.Close asChild>
                <button
                  type="button"
                  className="flex-1 px-4 py-3 rounded-full text-sm font-medium text-gray-500 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
              </Dialog.Close>
              <button
                type="submit"
                disabled={submitting || pagesNum <= 0}
                className="btn-primary flex-1 justify-center"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {submitting ? 'Saving…' : 'Log session'}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
