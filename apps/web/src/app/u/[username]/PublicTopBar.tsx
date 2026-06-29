import Link from 'next/link'
import { BookOpen } from 'lucide-react'

/**
 * Slim, brand-aligned top bar for unauthenticated visitors viewing a profile.
 * Provides logo (home link) + sign-in / get-started CTAs.
 */
export function PublicTopBar() {
  return (
    <header className="sticky top-0 z-40 bg-white/85 backdrop-blur-md border-b border-gray-100">
      <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
        <Link
          href="/"
          className="flex items-center gap-2 group outline-none rounded-md focus-visible:ring-2 focus-visible:ring-mint focus-visible:ring-offset-2"
        >
          <div className="w-7 h-7 bg-forest rounded-lg flex items-center justify-center transition-transform duration-200 ease-out group-hover:scale-105 group-active:scale-95">
            <BookOpen className="w-4 h-4 text-mint" />
          </div>
          <span className="font-serif text-lg font-black text-forest">
            Folio<span className="text-terra">.</span>
          </span>
        </Link>

        <nav className="flex items-center gap-1">
          <Link
            href="/login"
            className="px-3 py-1.5 rounded-full text-sm font-medium text-gray-500 hover:text-forest transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-mint focus-visible:ring-offset-2"
          >
            Sign in
          </Link>
          <Link
            href="/signup"
            className="px-4 py-1.5 rounded-full text-sm font-semibold bg-terra text-white hover:bg-terra-dark transition-all duration-150 ease-out active:scale-[0.97] outline-none focus-visible:ring-2 focus-visible:ring-terra focus-visible:ring-offset-2"
          >
            Get started
          </Link>
        </nav>
      </div>
    </header>
  )
}
