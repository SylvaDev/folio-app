'use client'

import { useMemo } from 'react'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts'
import { BookOpen, TrendingUp, Target, Star, Flame, Clock, Timer, Gauge } from 'lucide-react'
import type { UserBook } from '@folio/shared'
import { calcCompletionRate, calcReadingStreak, formatReadingTime } from '@folio/shared'
import { cn } from '@/lib/utils'

interface Props {
  userBooks: UserBook[]
  sessions: { session_date: string; pages_read: number; minutes_read: number | null }[]
  stats: {
    total_read: number
    read_this_year: number
    tbr_count: number
    currently_reading: number
    avg_rating: number | null
    total_pages_read: number | null
    favorites_count: number
  } | null
}

const CHART_COLORS = ['#2D6A4F', '#52B788', '#E07A5F', '#D4A853', '#74C69D', '#C9603E']

export function AnalyticsClient({ userBooks, sessions, stats }: Props) {
  const readBooks = useMemo(() => userBooks.filter(b => b.status === 'read'), [userBooks])

  // Books per month (last 12 months)
  const monthlyData = useMemo(() => {
    const now = new Date()
    const months: { month: string; count: number; pages: number }[] = []
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const key = d.toISOString().slice(0, 7)
      const label = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
      const booksThisMonth = readBooks.filter(b => b.date_finished?.startsWith(key))
      const pagesThisMonth = booksThisMonth.reduce((sum, b) => sum + (b.book?.page_count ?? 0), 0)
      months.push({ month: label, count: booksThisMonth.length, pages: pagesThisMonth })
    }
    return months
  }, [readBooks])

  // Genre breakdown
  const genreData = useMemo(() => {
    const map: Record<string, number> = {}
    readBooks.forEach(b => {
      b.book?.genres?.slice(0, 3).forEach(g => {
        const clean = g.split(' -- ')[0].slice(0, 30)
        map[clean] = (map[clean] ?? 0) + 1
      })
    })
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name, value]) => ({ name, value }))
  }, [readBooks])

  // Rating distribution
  const ratingData = useMemo(() => [1, 2, 3, 4, 5].map(r => ({
    rating: `${r}★`,
    count: readBooks.filter(b => b.rating === r).length,
  })), [readBooks])

  const completionRate = useMemo(() => calcCompletionRate(userBooks), [userBooks])
  const { current: currentStreak, longest: longestStreak } = useMemo(
    () => calcReadingStreak(sessions),
    [sessions],
  )

  const avgDaysPerBook = useMemo(() => {
    const withDates = readBooks.filter(b => b.date_started && b.date_finished)
    if (!withDates.length) return null
    const avg = withDates.reduce((sum, b) => {
      const days = Math.floor(
        (new Date(b.date_finished!).getTime() - new Date(b.date_started!).getTime()) / 86400000
      )
      return sum + days
    }, 0) / withDates.length
    return Math.round(avg)
  }, [readBooks])

  const uniqueAuthors = useMemo(
    () => new Set(readBooks.flatMap(b => b.book?.authors ?? [])).size,
    [readBooks],
  )

  // Reading-time aggregates from sessions
  const sessionStats = useMemo(() => {
    const totalMinutes = sessions.reduce((sum, s) => sum + (s.minutes_read ?? 0), 0)
    const totalPagesFromSessions = sessions.reduce((sum, s) => sum + (s.pages_read ?? 0), 0)
    const sessionsWithBoth = sessions.filter(s => s.minutes_read && s.pages_read > 0)
    const avgPace =
      sessionsWithBoth.length > 0
        ? sessionsWithBoth.reduce((sum, s) => sum + s.pages_read / (s.minutes_read ?? 1), 0) / sessionsWithBoth.length
        : 0

    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    const recentSessions = sessions.filter(s => new Date(s.session_date) >= thirtyDaysAgo)
    const minutesLast30 = recentSessions.reduce((sum, s) => sum + (s.minutes_read ?? 0), 0)

    return {
      totalMinutes,
      totalPagesFromSessions,
      avgPace,
      sessionCount: sessions.length,
      minutesLast30,
    }
  }, [sessions])

  // Build a daily reading-time series for the last 30 days
  const dailyTimeData = useMemo(() => {
    const days: { day: string; minutes: number; pages: number }[] = []
    const now = new Date()
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now)
      d.setDate(now.getDate() - i)
      const key = d.toISOString().slice(0, 10)
      const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      const todays = sessions.filter(s => s.session_date === key)
      const minutes = todays.reduce((sum, s) => sum + (s.minutes_read ?? 0), 0)
      const pages = todays.reduce((sum, s) => sum + (s.pages_read ?? 0), 0)
      days.push({ day: label, minutes, pages })
    }
    return days
  }, [sessions])

  const KPIS = [
    { icon: BookOpen, label: 'Books read (year)', value: stats?.read_this_year ?? 0, color: 'text-forest' },
    { icon: TrendingUp, label: 'Total read', value: stats?.total_read ?? 0, color: 'text-forest-light' },
    { icon: Target, label: 'Completion rate', value: `${completionRate}%`, color: 'text-terra' },
    { icon: Star, label: 'Avg rating', value: stats?.avg_rating ? `${stats.avg_rating} ★` : '—', color: 'text-gold' },
    {
      icon: Timer,
      label: 'Total reading time',
      value: sessionStats.totalMinutes > 0 ? formatReadingTime(sessionStats.totalMinutes) : '—',
      color: 'text-mint',
    },
    {
      icon: Gauge,
      label: 'Avg pace',
      value: sessionStats.avgPace > 0 ? `${sessionStats.avgPace.toFixed(1)} p/min` : '—',
      color: 'text-forest-light',
    },
    { icon: Flame, label: 'Current streak', value: currentStreak ? `${currentStreak}d` : '—', color: 'text-terra' },
    { icon: Clock, label: 'Avg days/book', value: avgDaysPerBook ? `${avgDaysPerBook}d` : '—', color: 'text-forest-light' },
  ]

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="page-title mb-1">Reading Analytics</h1>
        <p className="text-gray-500 text-sm">{uniqueAuthors} unique authors · {stats?.total_pages_read?.toLocaleString() ?? 0} total pages</p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-8 gap-4 mb-8">
        {KPIS.map(({ icon: Icon, label, value, color }) => (
          <div key={label} className="card p-4">
            <Icon className={cn('w-4 h-4 mb-2', color)} />
            <p className={cn('font-serif text-2xl font-bold', color)}>{value}</p>
            <p className="text-xs text-gray-500 mt-0.5 leading-tight">{label}</p>
          </div>
        ))}
      </div>

      {/* Reading time — last 30 days */}
      {sessionStats.sessionCount > 0 && (
        <div className="card p-5 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-semibold text-forest">Reading time, last 30 days</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                {formatReadingTime(sessionStats.minutesLast30)} across {sessionStats.sessionCount} session{sessionStats.sessionCount === 1 ? '' : 's'}
              </p>
            </div>
            <span className="badge bg-mint/15 text-forest">
              {sessionStats.totalPagesFromSessions.toLocaleString()} pages logged
            </span>
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={dailyTimeData} barSize={8}>
              <XAxis
                dataKey="day"
                tick={{ fontSize: 9, fill: '#9CA3AF' }}
                axisLine={false}
                tickLine={false}
                interval={4}
              />
              <YAxis tick={{ fontSize: 10, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: '#1B3A2D', border: 'none', borderRadius: 12, color: '#F5EDD8', fontSize: 12 }}
                itemStyle={{ color: '#52B788' }}
                formatter={(value: number, name: string) => [
                  name === 'minutes' ? `${value} min` : `${value} pages`,
                  name === 'minutes' ? 'Reading time' : 'Pages',
                ]}
              />
              <Bar dataKey="minutes" name="minutes" fill="#52B788" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">

        {/* Monthly books */}
        <div className="card p-5">
          <h2 className="font-semibold text-forest mb-4">Books per month</h2>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={monthlyData}>
              <defs>
                <linearGradient id="greenGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2D6A4F" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#2D6A4F" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#9CA3AF' }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip
                contentStyle={{ background: '#1B3A2D', border: 'none', borderRadius: 12, color: '#F5EDD8', fontSize: 12 }}
                itemStyle={{ color: '#52B788' }}
              />
              <Area type="monotone" dataKey="count" name="Books" stroke="#2D6A4F" strokeWidth={2.5} fill="url(#greenGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Rating distribution */}
        <div className="card p-5">
          <h2 className="font-semibold text-forest mb-4">Rating breakdown</h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={ratingData} barSize={28}>
              <XAxis dataKey="rating" tick={{ fontSize: 12, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#9CA3AF' }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip
                contentStyle={{ background: '#1B3A2D', border: 'none', borderRadius: 12, color: '#F5EDD8', fontSize: 12 }}
                itemStyle={{ color: '#D4A853' }}
              />
              <Bar dataKey="count" name="Books" fill="#D4A853" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Charts row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Genre breakdown */}
        <div className="card p-5">
          <h2 className="font-semibold text-forest mb-4">Genres read</h2>
          {genreData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={genreData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={85}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {genreData.map((_, index) => (
                    <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: '#1B3A2D', border: 'none', borderRadius: 12, color: '#F5EDD8', fontSize: 12 }}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-48 flex items-center justify-center text-gray-300 text-sm">
              Read more books to see genre data
            </div>
          )}
          <div className="flex flex-wrap gap-2 mt-2">
            {genreData.slice(0, 6).map((g, i) => (
              <span key={g.name} className="flex items-center gap-1.5 text-xs text-gray-500">
                <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                {g.name} ({g.value})
              </span>
            ))}
          </div>
        </div>

        {/* Reading streaks / pace */}
        <div className="card p-5">
          <h2 className="font-semibold text-forest mb-4">Reading pace</h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={monthlyData.slice(-6)}>
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: '#1B3A2D', border: 'none', borderRadius: 12, color: '#F5EDD8', fontSize: 12 }}
                itemStyle={{ color: '#52B788' }}
              />
              <Bar dataKey="pages" name="Pages" fill="#52B788" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>

          <div className="grid grid-cols-2 gap-3 mt-4">
            <div className="bg-cream rounded-xl p-3">
              <p className="font-serif text-2xl font-bold text-terra">{currentStreak}d</p>
              <p className="text-xs text-gray-500">Current streak</p>
            </div>
            <div className="bg-cream rounded-xl p-3">
              <p className="font-serif text-2xl font-bold text-forest">{longestStreak}d</p>
              <p className="text-xs text-gray-500">Longest streak</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
