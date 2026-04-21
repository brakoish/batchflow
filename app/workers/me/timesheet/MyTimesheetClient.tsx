'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import AppShell from '@/app/components/AppShell'
import { ChevronLeftIcon, ClockIcon, ArrowDownTrayIcon, ShareIcon } from '@heroicons/react/24/solid'
import { formatDuration } from '@/lib/format'
import { formatDateInTz, formatTimeInTz } from '@/lib/timezone'
import { haptic } from '@/lib/haptic'
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

function sanitizeFilename(s: string): string {
  return s.replace(/[^a-z0-9-_]+/gi, '-').replace(/^-+|-+$/g, '')
}

export default function MyTimesheetClient({ session, organizationName }: { session: Session; organizationName: string }) {
  const [shifts, setShifts] = useState<Shift[]>([])
  const [timezone, setTimezone] = useState('America/New_York')
  const [loading, setLoading] = useState(true)
  const [weekStart, setWeekStart] = useState<Date>(() => mondayOfWeek(new Date()))
  const [sharing, setSharing] = useState(false)
  const [shareMsg, setShareMsg] = useState<string | null>(null)
  const shareCardRef = useRef<HTMLDivElement>(null)

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
  const completedCount = shifts.filter((s) => s.endedAt).length
  const inProgressCount = shifts.filter((s) => !s.endedAt).length

  // Group shifts by local date so each day gets its own card
  const byDay: Record<string, Shift[]> = {}
  for (const s of shifts) {
    const key = formatDateInTz(s.startedAt, timezone)
    if (!byDay[key]) byDay[key] = []
    byDay[key].push(s)
  }
  const dayKeys = Object.keys(byDay)

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

  // --- Share / download handlers ---

  const buildCsv = (): string => {
    const lines: string[] = []
    lines.push('Worker,Week Start,Day,Date,Start,End,Hours,Status')
    const escape = (v: string) => {
      if (v.includes(',') || v.includes('"') || v.includes('\n')) {
        return '"' + v.replace(/"/g, '""') + '"'
      }
      return v
    }
    const workerName = session.name || 'Worker'
    const wkStart = weekStart.toISOString().slice(0, 10)
    for (const s of [...shifts].reverse()) {
      const sample = new Date(s.startedAt)
      const weekday = sample.toLocaleDateString('en-US', { weekday: 'long', timeZone: timezone })
      const dateStr = formatDateInTz(s.startedAt, timezone)
      const startStr = formatTimeInTz(s.startedAt, timezone)
      const endStr = s.endedAt ? formatTimeInTz(s.endedAt, timezone) : 'In progress'
      const hoursStr = s.endedAt ? s.hours.toFixed(2) : ''
      const status = s.endedAt ? 'Completed' : 'In progress'
      lines.push([workerName, wkStart, weekday, dateStr, startStr, endStr, hoursStr, status].map(v => escape(String(v))).join(','))
    }
    lines.push('')
    lines.push(['', '', '', '', '', 'Total', shiftHours.toFixed(2), ''].map(v => escape(String(v))).join(','))
    return lines.join('\n')
  }

  const handleDownloadCsv = () => {
    haptic('light')
    const csv = buildCsv()
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    const filename = `timesheet-${sanitizeFilename(session.name || 'worker').toLowerCase()}-${weekStart.toISOString().slice(0,10)}.csv`
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const generatePngBlob = async (): Promise<Blob | null> => {
    if (!shareCardRef.current) return null
    const { toPng } = await import('html-to-image')
    // 2x pixel ratio for crisp screenshots on retina phones
    const dataUrl = await toPng(shareCardRef.current, {
      pixelRatio: 2,
      cacheBust: true,
      backgroundColor: '#0f172a', // slate-900 so transparent root doesn't look bad
    })
    const res = await fetch(dataUrl)
    return await res.blob()
  }

  const handleShare = async () => {
    haptic('medium')
    setSharing(true)
    setShareMsg(null)
    try {
      const blob = await generatePngBlob()
      if (!blob) { setShareMsg('Could not generate image'); return }
      const filename = `timesheet-${sanitizeFilename(session.name || 'worker').toLowerCase()}-${weekStart.toISOString().slice(0,10)}.png`
      const file = new File([blob], filename, { type: 'image/png' })

      const shareData: ShareData = {
        title: `${session.name || 'My'} timesheet — ${weekRangeLabel}`,
        text: `My hours for ${weekRangeLabel}: ${formatDuration(shiftHours)}`,
        files: [file],
      }

      // Try native share sheet first (iOS Safari, Android Chrome)
      const nav: any = navigator
      if (nav.canShare && nav.canShare({ files: [file] }) && nav.share) {
        try {
          await nav.share(shareData)
          setShareMsg('Shared!')
          return
        } catch (e: any) {
          if (e?.name === 'AbortError') { setShareMsg(null); return } // user cancelled, silent
          // fall through to download
        }
      }

      // Fallback: download the PNG so they can attach it manually
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      setShareMsg('Downloaded — attach it to your text')
    } catch (err) {
      setShareMsg('Could not generate image. Try again?')
    } finally {
      setSharing(false)
      if (shareMsg) setTimeout(() => setShareMsg(null), 4000)
    }
  }

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
        <div className="rounded-2xl bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border border-emerald-500/20 p-5 mb-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 mb-1">
                Total this week
              </p>
              <p className="text-3xl font-bold text-foreground tabular-nums">
                {loading ? '—' : formatDuration(shiftHours)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {completedCount} completed shift{completedCount === 1 ? '' : 's'}
                {inProgressCount > 0 && ` · ${inProgressCount} in progress`}
              </p>
            </div>
            <ClockIcon className="w-10 h-10 text-emerald-500/60" />
          </div>
        </div>

        {/* Share / Download actions */}
        {!loading && completedCount > 0 && (
          <div className="grid grid-cols-2 gap-2 mb-5">
            <button
              onClick={handleShare}
              disabled={sharing}
              className="min-h-[48px] px-4 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-[0.97] text-white text-sm font-semibold transition-all flex items-center justify-center gap-2 disabled:opacity-60"
            >
              <ShareIcon className="w-4 h-4" />
              {sharing ? 'Preparing…' : 'Send to boss'}
            </button>
            <button
              onClick={handleDownloadCsv}
              className="min-h-[48px] px-4 py-3 rounded-xl bg-muted hover:bg-muted/80 border border-input active:scale-[0.97] text-foreground text-sm font-medium transition-all flex items-center justify-center gap-2"
            >
              <ArrowDownTrayIcon className="w-4 h-4" />
              CSV
            </button>
          </div>
        )}
        {shareMsg && (
          <div className="mb-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-3 py-2">
            <p className="text-xs text-emerald-700 dark:text-emerald-400 text-center font-medium">{shareMsg}</p>
          </div>
        )}

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

      {/*
        Off-screen share card — rendered in the DOM so html-to-image can snapshot it,
        but positioned way off-screen so users never see it. Uses inline styles with
        explicit colors (no Tailwind-only tokens) to guarantee faithful rendering
        across html-to-image / Safari / Chrome.
      */}
      <div
        aria-hidden="true"
        style={{ position: 'fixed', left: '-10000px', top: 0, pointerEvents: 'none' }}
      >
        <div
          ref={shareCardRef}
          style={{
            width: '720px',
            padding: '40px',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
            background: 'linear-gradient(135deg, #064e3b 0%, #0f172a 100%)',
            color: '#f8fafc',
            borderRadius: '24px',
          }}
        >
          {/* Brand header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '32px' }}>
            <div>
              <div style={{ fontSize: '14px', color: '#86efac', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                🏭 {organizationName}
              </div>
              <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>BatchFlow timesheet</div>
            </div>
            <div style={{ fontSize: '12px', color: '#94a3b8', textAlign: 'right' }}>
              Generated {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </div>
          </div>

          {/* Worker + week */}
          <div style={{ marginBottom: '24px' }}>
            <div style={{ fontSize: '36px', fontWeight: 700, color: '#f8fafc', lineHeight: 1.1 }}>
              {session.name || 'Worker'}
            </div>
            <div style={{ fontSize: '18px', color: '#cbd5e1', marginTop: '6px' }}>
              Week of {weekRangeLabel}
            </div>
          </div>

          {/* Big hero total */}
          <div style={{
            background: 'rgba(16, 185, 129, 0.15)',
            border: '2px solid rgba(16, 185, 129, 0.4)',
            borderRadius: '20px',
            padding: '28px 32px',
            marginBottom: '28px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <div>
              <div style={{ fontSize: '12px', color: '#6ee7b7', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '6px' }}>
                Total hours
              </div>
              <div style={{ fontSize: '64px', fontWeight: 700, color: '#f8fafc', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
                {formatDuration(shiftHours)}
              </div>
              <div style={{ fontSize: '13px', color: '#94a3b8', marginTop: '6px' }}>
                {completedCount} completed shift{completedCount === 1 ? '' : 's'}
                {inProgressCount > 0 && ` · ${inProgressCount} in progress`}
              </div>
            </div>
            <div style={{ fontSize: '48px' }}>⏱</div>
          </div>

          {/* Per-day breakdown */}
          {dayKeys.length > 0 && (
            <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', overflow: 'hidden' }}>
              {dayKeys.slice().reverse().map((dayKey, idx) => {
                const dayShifts = byDay[dayKey]
                const dayTotal = dayShifts.filter((s) => s.endedAt).reduce((sum, s) => sum + s.hours, 0)
                const sample = new Date(dayShifts[0].startedAt)
                const weekdayLabel = sample.toLocaleDateString('en-US', { weekday: 'long', timeZone: timezone })
                return (
                  <div
                    key={dayKey}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '14px 20px',
                      borderTop: idx === 0 ? 'none' : '1px solid rgba(255,255,255,0.06)',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '15px', fontWeight: 600, color: '#f8fafc' }}>{weekdayLabel}</div>
                      <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>{dayKey}</div>
                    </div>
                    <div style={{ fontSize: '16px', fontWeight: 700, color: '#f8fafc', fontVariantNumeric: 'tabular-nums' }}>
                      {dayTotal > 0 ? formatDuration(dayTotal) : '—'}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Footer */}
          <div style={{ marginTop: '24px', fontSize: '11px', color: '#64748b', textAlign: 'center' }}>
            batchflow.app · Times shown in {timezone}
          </div>
        </div>
      </div>
    </AppShell>
  )
}
