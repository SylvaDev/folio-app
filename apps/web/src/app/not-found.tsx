import Link from 'next/link'
import { BookOpen, ArrowLeft } from 'lucide-react'

export const metadata = {
  title: 'Page not found',
}

/**
 * Global 404 page. Rendered when notFound() is called anywhere
 * (e.g. /u/[username] for a username that doesn't exist) or when
 * the URL doesn't match any route.
 */
export default function NotFound() {
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

        <p className="font-serif text-7xl font-black text-mint/30 leading-none mb-4 tabular-nums">
          404
        </p>
        <h1 className="font-serif text-3xl font-bold text-white mb-3">
          This page is off the shelf
        </h1>
        <p className="text-cream/70 text-sm leading-relaxed mb-8">
          The page you&apos;re looking for has moved, been deleted, or never existed.
          Let&apos;s get you back to something readable.
        </p>

        <div className="flex flex-col sm:flex-row gap-2 justify-center">
          <Link
            href="/library"
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-full bg-terra text-white font-semibold text-sm transition-[background-color,transform] duration-200 ease-out hover:bg-terra-dark active:scale-[0.97] outline-none focus-visible:ring-2 focus-visible:ring-terra focus-visible:ring-offset-2 focus-visible:ring-offset-forest"
          >
            <ArrowLeft className="w-4 h-4" aria-hidden />
            Back to library
          </Link>
          <Link
            href="/feed"
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-full bg-white/10 text-white font-medium text-sm transition-[background-color,transform] duration-200 ease-out hover:bg-white/15 active:scale-[0.97] outline-none focus-visible:ring-2 focus-visible:ring-mint focus-visible:ring-offset-2 focus-visible:ring-offset-forest"
          >
            Open the feed
          </Link>
        </div>
      </div>
    </div>
  )
}
