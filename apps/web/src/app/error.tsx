'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { BookOpen, RotateCw, ArrowLeft } from 'lucide-react'

/**
 * Global error boundary. Renders when an unhandled error occurs
 * in any Server or Client Component below the root layout.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // In production this would forward to Sentry / your observability stack.
    // For now we surface the digest so we can correlate with server logs.
    console.error('[GlobalError]', error)
  }, [error])

  return (
    <div className="min-h-screen min-h-[100dvh] bg-forest flex items-center justify-center px-6 py-12">
      <div className="max-w-md w-full text-center">
        <Link
          href="/"
          className="inline-flex items-center gap-2 mb-12 group outline-none rounded-md focus-visible:ring-2 focus-visible:ring-mint focus-visible:ring-offset-2 focus-visible:ring-offset-forest"
        >
          <div className="w-8 h-8 bg-mint/20 rounded-lg flex items-center justify-center transition-transform duration-200 ease-out group-hover:scale-105">
            <BookOpen className="w-5 h-5 text-mint" aria-hidden />
          </div>
          <span className="font-serif text-xl font-black text-white">
            Folio<span className="text-terra">.</span>
          </span>
        </Link>

        <h1 className="font-serif text-3xl font-bold text-white mb-3">
          Something went sideways
        </h1>
        <p className="text-cream/70 text-sm leading-relaxed mb-8">
          We hit an unexpected error rendering this page. You can try again,
          or head back to your library.
        </p>

        {error.digest && (
          <p className="text-xs text-cream/40 font-mono mb-6">
            Error ID: {error.digest}
          </p>
        )}

        <div className="flex flex-col sm:flex-row gap-2 justify-center">
          <button
            onClick={() => reset()}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-full bg-terra text-white font-semibold text-sm transition-[background-color,transform] duration-200 ease-out hover:bg-terra-dark active:scale-[0.97] outline-none focus-visible:ring-2 focus-visible:ring-terra focus-visible:ring-offset-2 focus-visible:ring-offset-forest"
          >
            <RotateCw className="w-4 h-4" aria-hidden />
            Try again
          </button>
          <Link
            href="/library"
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-full bg-white/10 text-white font-medium text-sm transition-[background-color,transform] duration-200 ease-out hover:bg-white/15 active:scale-[0.97] outline-none focus-visible:ring-2 focus-visible:ring-mint focus-visible:ring-offset-2 focus-visible:ring-offset-forest"
          >
            <ArrowLeft className="w-4 h-4" aria-hidden />
            Back to library
          </Link>
        </div>
      </div>
    </div>
  )
}
