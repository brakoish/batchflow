'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import AppShell from '@/app/components/AppShell'
import { ChevronLeftIcon, ClockIcon } from '@heroicons/react/24/solid'
import { formatDuration } from '@/lib/format'
import { formatDateInTz, formatTimeInTz } from '@/lib/timezone'
import type { Session } from '@/lib/session'

type Shift = {
  id: string
  status: string
  startedAt: string
  endedAt: string | null
  hours: number
}

// Get the Monday of the week containing the given date, anchored to org timezone.
function mondayOfWeek(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day // Sunday rolls back to Monday
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

export default function MyTimesheetClient({ session }: { session: Session }) {
  const [shifts, setShifts] = useState<Shift[]>([])
  const [timezone, setTimezone] = useState('America/New_York')
  const [loading, setLoading] = useState(true)
  const [weekStart, setWeekStart] = useState<Date>(() => mondayOfWeek(new Date()))

  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekStart.getDate() + 7)

  const fetchShifts = async () => {
    setLoading(true)
    try {
      const from = weekStart.toISOString()
      const to = weekEnd.toISOString()
      const res = await fetch(`/api/shifts/my?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`, { cache: 'no-store' })
      if (res.ok) {
        const data = await res.json()
        setShifts(data.shifts || [])
        setTimezone(data.timezone || 'America/New_York')
      }
    } catch {}
    setLoading(false)
  }

  useEffect(() => {
    fetchShifts()
  }, [weekStart])

  const shiftHours = shifts.filter((s) => s.endedAt).reduce((sum, s) => sum + s.hours, 0)

  // Group shifts by local date so each day gets its own card
  const byDay: Record<string, Shift[]> = {}
  for (const s of shifts) {
    const key = formatDateInTz(s.startedAt, timezone)
    if (!byDay[key]) byDay[key] = []
    byDay[key].push(s)
  }
  const dayKeys = Object.keys(byDay) // already desc because the API returns desc

  const prevWeek = () => {
    const d = new Date(weekStart)
    d.setDate(d.getDate() - 7)
    setWeekStart(d)
  }
  const nextWeek = () => {
    const d = new Date(weekStart)
    d.setDate(d.getDate() + 7)
    setWeekStart(d)
  }
  const isThisWeek = mondayOfWeek(new Date()).getTime() === weekStart.getTime()

  const weekRangeLabel = (() => {
    const endInclusive = new Date(weekStart)
    endInclusive.setDate(weekStart.getDate() + 6)
    const start = weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    const end = endInclusive.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: endInclusive.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
    })
    return `${start} – ${end}`
  })()

  return (
    <AppShell session={session}>
      <main className="max-w-2xl mx-auto px-4 py-5 pb-24">
        {/* Header */}
        <div className="flex items-center gap-2 mb-5">
          <Link
            href="/workers/me"
            className="p-2 -ml-2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            aria-label="Back to My Day"
          >
            <ChevronLeftIcon className="w-5 h-5" />
          </Link>
          <h1 className="text-lg font-semibold tracking-tight text-foreground">My Timesheet</h1>
        </div>

        {/* Week selector */}
        <div className="flex items-center justify-between gap-2 mb-4">
          <button
            onClick={prevWeek}
            className="min-h-[44px] px-4 py-2 rounded-xl bg-muted hover:bg-muted/80 border border-input active:scale-[0.97] text-foreground text-sm font-medium transition-all"
          >
            ← Prev
          </button>
          <div className="flex-1 text-center">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
              {isThisWeek ? 'This Week' : 'Week of'}
            </p>
            <p className="text-sm font-semibold text-foreground">{weekRangeLabel}</p>
          </div>
          <button
            onClick={nextWeek}
            disabled={isThisWeek}
            className="min-h-[44px] px-4 py-2 rounded-xl bg-muted hover:bg-muted/80 border border-input active:scale-[0.97] text-foreground text-sm font-medium transition-all disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Next →
          </button>
        </div>

        {/* Weekly total card */}
        <div className="rounded-2xl bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border border-emerald-500/20 p-5 mb-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 mb-1">
                Total this week
              </p>
              <p className="text-3xl font-bold text-foreground tabular-nums">
                {loading ? '—' : formatDuration(shiftHours)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {shifts.filter((s) => s.endedAt).length} completed shift
                {shifts.filter((s) => s.endedAt).length === 1 ? '' : 's'}
                {shifts.some((s) => !s.endedAt) && ' · 1 in progress'}
              </p>
            </div>
            <ClockIcon className="w-10 h-10 text-emerald-500/60" />
          </div>
        </div>

        {/* Shift list, grouped by day */}
        {loading ? (
          <div className="rounded-2xl border border-border bg-card p-8 text-center">
            <p className="text-sm text-muted-foreground">Loading…</p>
          </div>
        ) : shifts.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card p-8 text-center">
            <p className="text-sm text-muted-foreground">No shifts this week yet.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {dayKeys.map((dayKey) => {
              const dayShifts = byDay[dayKey]
              const dayTotal = dayShifts.filter((s) => s.endedAt).reduce((sum, s) => sum + s.hours, 0)
              // Weekday + short date, computed from the first shift's start in org tz
              const sample = new Date(dayShifts[0].startedAt)
              const weekdayLabel = sample.toLocaleDateString('en-US', { weekday: 'long', timeZone: timezone })
              return (
                <div key={dayKey} className="rounded-2xl border border-border bg-card overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-2.5 bg-muted/40 border-b border-border">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{weekdayLabel}</p>
                      <p className="text-[11px] text-muted-foreground">{dayKey}</p>
                    </div>
                    <p className="text-sm font-semibold text-foreground tabular-nums">
                      {dayTotal > 0 ? formatDuration(dayTotal) : '—'}
                    </p>
                  </div>
                  <ul className="divide-y divide-border">
                    {dayShifts.map((s) => (
                      <li key={s.id} className="px-4 py-3 flex items-center justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-foreground tabular-nums">
                            {formatTimeInTz(s.startedAt, timezone)}
                            <span className="text-muted-foreground"> → </span>
                            {s.endedAt ? (
                              formatTimeInTz(s.endedAt, timezone)
                            ) : (
                              <span className="text-emerald-600 dark:text-emerald-400 font-medium">In progress</span>
                            )}
                          </p>
                        </div>
                        <p className="text-sm font-semibold text-foreground tabular-nums shrink-0">
                          {formatDuration(s.hours)}
                        </p>
                      </li>
                    ))}
                  </ul>
                </div>
              )
            })}
          </div>
        )}

        <p className="mt-6 text-[11px] text-muted-foreground/70 text-center">
          Need a correction? Ask your supervisor — they can edit shifts from the Timesheets page.
        </p>
      </main>
    </AppShell>
  )
}
