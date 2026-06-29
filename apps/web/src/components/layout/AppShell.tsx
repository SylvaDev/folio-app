'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import type { User } from '@supabase/supabase-js'
import {
  BookOpen, Library, ListTodo, BarChart3, BookMarked,
  Users, Settings, Upload, LogOut, Menu, X, ChevronRight,
  Search, Sparkles, Rss,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { NotificationBell } from '@/components/social/NotificationBell'

interface Props {
  user: User
  profile: {
    display_name: string | null
    avatar_url: string | null
    subscription: string
    username: string | null
  } | null
  betaActive?: boolean
  children: React.ReactNode
}

const NAV_ITEMS = [
  { href: '/feed',      label: 'Feed',        icon: Rss,        description: 'Your reading community' },
  { href: '/library',   label: 'My Library',  icon: Library,    description: 'All your books' },
  { href: '/tbr',       label: 'TBR Queue',   icon: ListTodo,   description: 'What to read next' },
  { href: '/analytics', label: 'Analytics',   icon: BarChart3,  description: 'Reading stats' },
  { href: '/series',    label: 'Series',      icon: BookMarked, description: 'Track your series' },
  { href: '/clubs',     label: 'Book Clubs',  icon: Users,      description: 'Read together' },
]

const SECONDARY_ITEMS = [
  { href: '/import',   label: 'Import Books', icon: Upload },
  { href: '/settings', label: 'Settings',     icon: Settings },
]

export function AppShell({ user, profile, betaActive, children }: Props) {
  const pathname = usePathname()
  const router = useRouter()
  const [mobileOpen, setMobileOpen] = useState(false)

  async function signOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  const displayName = profile?.display_name ?? user.email?.split('@')[0] ?? 'Reader'
  const initials = displayName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)

  return (
    <div className="flex h-[100dvh] min-h-[100dvh] bg-[#F9F7F3] overflow-hidden">

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-forest/50 z-30 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        'fixed lg:static inset-y-0 left-0 z-40 w-64 bg-forest flex flex-col transition-transform duration-300',
        mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
      )}>

        {/* Logo */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-white/8">
          <Link href="/library" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 bg-mint/20 rounded-lg flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-mint" />
            </div>
            <span className="font-serif text-xl font-black text-white">
              Folio<span className="text-terra">.</span>
            </span>
            {betaActive && (
              <span
                className="ml-1 px-1.5 py-0.5 rounded-md bg-mint/15 text-mint text-[9px] font-bold tracking-wider"
                title="You have early access to beta features"
              >
                BETA
              </span>
            )}
          </Link>
          <button
            onClick={() => setMobileOpen(false)}
            className="lg:hidden text-white/50 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick search */}
        <div className="px-4 py-3 border-b border-white/8">
          <Link
            href="/library?search=1"
            className="flex items-center gap-2 w-full px-3 py-2 rounded-lg bg-white/8 text-white/50 text-sm hover:bg-white/12 transition-colors"
          >
            <Search className="w-4 h-4" />
            <span>Search books…</span>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          <p className="px-3 text-xs font-semibold text-white/30 uppercase tracking-widest mb-2">Library</p>
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || (href !== '/library' && pathname.startsWith(href))
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150',
                  active
                    ? 'bg-white/12 text-white'
                    : 'text-white/60 hover:text-white hover:bg-white/8',
                )}
              >
                <Icon className={cn('w-4 h-4 flex-shrink-0', active ? 'text-mint' : '')} />
                {label}
                {active && <ChevronRight className="w-3 h-3 ml-auto text-white/30" />}
              </Link>
            )
          })}

          <div className="pt-4">
            <p className="px-3 text-xs font-semibold text-white/30 uppercase tracking-widest mb-2">Account</p>
            {SECONDARY_ITEMS.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150',
                  pathname === href
                    ? 'bg-white/12 text-white'
                    : 'text-white/60 hover:text-white hover:bg-white/8',
                )}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                {label}
              </Link>
            ))}
          </div>
        </nav>

        {/* Pro upgrade banner */}
        {profile?.subscription === 'free' && (
          <div className="mx-3 mb-3 p-3 bg-terra/15 border border-terra/20 rounded-xl">
            <div className="flex items-center gap-2 mb-1.5">
              <Sparkles className="w-4 h-4 text-terra" />
              <span className="text-xs font-semibold text-white">Upgrade to Pro</span>
            </div>
            <p className="text-xs text-white/50 mb-2">Unlock AI queue, unlimited books, and full analytics.</p>
            <Link href="/settings?tab=billing" className="inline-flex text-xs font-semibold text-terra hover:text-terra-dark">
              $4.99/mo →
            </Link>
          </div>
        )}

        {/* User */}
        <div className="px-4 py-4 border-t border-white/8">
          <div className="flex items-center gap-3">
            {profile?.username ? (
              <Link
                href={`/u/${profile.username}`}
                className="flex items-center gap-3 flex-1 min-w-0 group"
                title="View my public profile"
              >
                <div className="w-8 h-8 rounded-full bg-mint/20 flex items-center justify-center flex-shrink-0 group-hover:ring-2 group-hover:ring-mint/40 transition-all">
                  {profile?.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={profile.avatar_url} alt={displayName} className="w-8 h-8 rounded-full object-cover" />
                  ) : (
                    <span className="text-xs font-bold text-mint">{initials}</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate group-hover:text-mint transition-colors">{displayName}</p>
                  <p className="text-xs text-white/40 truncate">@{profile.username}</p>
                </div>
              </Link>
            ) : (
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="w-8 h-8 rounded-full bg-mint/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-bold text-mint">{initials}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{displayName}</p>
                  <p className="text-xs text-white/40 truncate capitalize">{profile?.subscription ?? 'free'}</p>
                </div>
              </div>
            )}
            <NotificationBell />
            <button
              onClick={signOut}
              className="w-8 h-8 rounded-full flex items-center justify-center text-white/40 hover:text-white hover:bg-white/8 transition-[background-color,color,transform] duration-150 ease-out active:scale-[0.95] outline-none focus-visible:ring-2 focus-visible:ring-mint focus-visible:ring-offset-2 focus-visible:ring-offset-forest"
              title="Sign out"
              aria-label="Sign out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Mobile top bar */}
        <div className="lg:hidden flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-100">
          <button onClick={() => setMobileOpen(true)} className="text-forest">
            <Menu className="w-5 h-5" />
          </button>
          <span className="font-serif font-bold text-forest">
            Folio<span className="text-terra">.</span>
          </span>
        </div>

        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
