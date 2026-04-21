'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import AppShell from '@/app/components/AppShell'
import { usePullToRefresh } from '@/app/components/usePullToRefresh'
import { ClockIcon, CubeIcon, FireIcon, ChartBarIcon } from '@heroicons/react/24/solid'
import { formatDuration } from '@/lib/format'
import type { Session } from '@/lib/session'
type Shift = { id: string; startedAt: string; endedAt: string | null; hours: number }
type BatchActivity = { batchName: string; units: number }
type Stats = {
  totalUnits: number
  totalShifts: number
  totalHours: number
  unitsPerHour: number
  streak: number
}

export default function MyDayClient({ session }: { session: Session }) {
  const [activeShift, setActiveShift] = useState<Shift | null>(null)
  const [todayShifts, setTodayShifts] = useState<Shift[]>([])
  const [todayUnits, setTodayUnits] = useState(0)
  const [todayBatches, setTodayBatches] = useState<BatchActivity[]>([])
  const [weekStats, setWeekStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    fetchData()
    const id = setInterval(fetchData, 30000) // Refresh every 30s
    return () => clearInterval(id)
  }, [])

  const fetchData = async () => {
    try {
      // Fetch today's activity
      const actRes = await fetch('/api/workers/activity', { cache: "no-store" })
      if (actRes.ok) {
        const actData = await actRes.json()
        if (actData.workers) {
          const me = actData.workers.find((w: any) => w.id === (session.workerId || session.id))
          if (me) {
            setTodayUnits(me.todayUnits || 0)
            // Extract batch activities from progress logs
            const batchMap = new Map<string, number>()
            // We'll need to fetch full activity details separately
          }
        }
      }

      // Fetch current shift
      const shiftRes = await fetch('/api/shifts', { cache: "no-store" })
      if (shiftRes.ok) {
        const shiftData = await shiftRes.json()
        setActiveShift(shiftData.activeShift || null)
      }

      // Fetch today's shifts (worker-scoped, works for PIN users too)
      const today = new Date().toISOString().split('T')[0]
      const shiftsRes = await fetch(`/api/shifts/my?from=${today}&to=${today}`, { cache: "no-store" })
      if (shiftsRes.ok) {
        const shiftsData = await shiftsRes.json()
        setTodayShifts(shiftsData.shifts || [])
      }

      // Fetch worker stats (this gives us week data)
      const statsRes = await fetch('/api/workers/stats', { cache: "no-store" })
      if (statsRes.ok) {
        const statsData = await statsRes.json()
        setWeekStats(statsData.stats || null)

        // Extract today's batches from recent logs
        if (statsData.stats?.recentLogs) {
          const batchMap = new Map<string, number>()
          const today = new Date().toISOString().split('T')[0]

          statsData.stats.recentLogs.forEach((log: any) => {
            const logDate = new Date(log.createdAt).toISOString().split('T')[0]
            if (logDate === today && log.batchStep?.batch?.name) {
              const name = log.batchStep.batch.name
              batchMap.set(name, (batchMap.get(name) || 0) + log.quantity)
            }
          })

          setTodayBatches(
            Array.from(batchMap.entries()).map(([batchName, units]) => ({ batchName, units }))
          )
        }
      }
    } catch (err) {
      console.error('Failed to fetch My Day data:', err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const { handlers: ptrHandlers } = usePullToRefresh(() => { setRefreshing(true); fetchData() }, 80)

  const todayHours = todayShifts.reduce((sum, s) => sum + s.hours, 0)
  const currentShiftDuration = activeShift
    ? (Date.now() - new Date(activeShift.startedAt).getTime()) / 3600000
    : 0

  return (
    <AppShell session={session}>
      <main
        className="max-w-2xl mx-auto px-4 py-6 pb-24"
        {...ptrHandlers}
      >
        {/* Pull to refresh indicator */}
        {refreshing && (
          <div className="flex justify-center py-4">
            <div className="w-6 h-6 border-2 border-muted-foreground border-t-foreground rounded-full animate-spin" />
          </div>
        )}

        {/* Greeting */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground">Hey {(session.name || '').split(' ')[0]}!</h1>
          <p className="text-muted-foreground mt-1">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-2 border-muted-foreground border-t-foreground rounded-full animate-spin" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Current Shift Status */}
            <div className={`bg-card border rounded-xl p-6 ${activeShift ? 'border-success' : 'border-border'}`}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${activeShift ? 'bg-success animate-pulse' : 'bg-muted'}`} />
                  <h2 className="text-lg font-semibold text-foreground">
                    {activeShift ? 'On Shift' : 'Off Shift'}
                  </h2>
                </div>
                {activeShift && (
                  <span className="text-2xl font-bold text-success tabular-nums">
                    {formatDuration(currentShiftDuration)}
                  </span>
                )}
              </div>
              {activeShift ? (
                <p className="text-sm text-muted-foreground">
                  Started at {new Date(activeShift.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Clock in to start tracking your time
                </p>
              )}
            </div>

            {/* Today's Stats Grid */}
            <div className="grid grid-cols-2 gap-4">
              {/* Today's Units */}
              <div className="bg-card border border-border rounded-xl p-5">
                <div className="flex items-center gap-2 mb-2">
                  <CubeIcon className="w-5 h-5 text-primary" />
                  <span className="text-xs font-medium text-muted-foreground uppercase">Units Today</span>
                </div>
                <p className="text-3xl font-bold text-foreground tabular-nums">{todayUnits}</p>
              </div>

              {/* Today's Hours */}
              <div className="bg-card border border-border rounded-xl p-5">
                <div className="flex items-center gap-2 mb-2">
                  <ClockIcon className="w-5 h-5 text-emerald-500" />
                  <span className="text-xs font-medium text-muted-foreground uppercase">Hours Today</span>
                </div>
                <p className="text-3xl font-bold text-foreground tabular-nums">
                  {formatDuration(todayHours + currentShiftDuration)}
                </p>
              </div>
            </div>

            {/* Today's Batches */}
            {todayBatches.length > 0 && (
              <div className="bg-card border border-border rounded-xl p-5">
                <h3 className="text-base font-semibold text-foreground mb-4">Batches Worked Today</h3>
                <div className="space-y-3">
                  {todayBatches.map((batch, idx) => (
                    <div key={idx} className="flex items-center justify-between">
                      <span className="text-sm text-foreground">{batch.batchName}</span>
                      <span className="text-sm font-semibold text-muted-foreground tabular-nums">
                        {batch.units} units
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* This Week's Totals */}
            {weekStats && (
              <div className="bg-card border border-border rounded-xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-base font-semibold text-foreground">This Week</h3>
                  <Link
                    href="/workers/me/timesheet"
                    className="text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:underline min-h-[44px] flex items-center"
                  >
                    Timesheet →
                  </Link>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <CubeIcon className="w-4 h-4 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">Total Units</span>
                    </div>
                    <p className="text-2xl font-bold text-foreground tabular-nums">{weekStats.totalUnits}</p>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <ChartBarIcon className="w-4 h-4 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">Units/Hour</span>
                    </div>
                    <p className="text-2xl font-bold text-foreground tabular-nums">{weekStats.unitsPerHour}</p>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <ClockIcon className="w-4 h-4 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">Hours</span>
                    </div>
                    <p className="text-2xl font-bold text-foreground tabular-nums">
                      {formatDuration(weekStats.totalHours)}
                    </p>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <FireIcon className="w-4 h-4 text-success" />
                      <span className="text-xs text-muted-foreground">Day Streak</span>
                    </div>
                    <p className="text-2xl font-bold text-success tabular-nums">{weekStats.streak}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Empty State */}
            {!loading && todayUnits === 0 && todayBatches.length === 0 && (
              <div className="text-center py-12">
                <CubeIcon className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-50" />
                <p className="text-muted-foreground">No activity logged today yet</p>
                <p className="text-sm text-muted-foreground mt-1">Start working on batches to see your stats</p>
              </div>
            )}
          </div>
        )}
      </main>
    </AppShell>
  )
}
