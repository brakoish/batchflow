'use client'

import { useState, useEffect } from 'react'
import { haptic } from '@/lib/haptic'
import { formatDuration } from '@/lib/format'
import { formatTimeInTz, formatDateInTz, toDateTimeLocalString, fromDateTimeLocalString } from '@/lib/timezone'
import ConfirmModal from '@/app/components/ConfirmModal'

type Worker = { id: string; name: string }
type Shift = {
  id: string
  worker: { id: string; name: string }
  status: string
  startedAt: string
  endedAt: string | null
  hours: number
}
type WeeklySummary = {
  workerId: string
  workerName: string
  totalHours: number
  shiftCount: number
  days: Record<string, { hours: number; shiftCount: number }>
}
type ConfirmAction = {
  title: string
  message?: string
  confirmLabel: string
  confirmStyle?: 'danger' | 'primary'
  onConfirm: () => void
}

export default function TimesheetClient({ workers }: { workers: Worker[] }) {
  const [shifts, setShifts] = useState<Shift[]>([])
  const [timezone, setTimezone] = useState('America/New_York')
  const [filterWorker, setFilterWorker] = useState('')
  const [exportMonth, setExportMonth] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [loading, setLoading] = useState(false)
  const [editingShift, setEditingShift] = useState<Shift | null>(null)
  const [editStart, setEditStart] = useState('')
  const [editEnd, setEditEnd] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null)

  // Correction requests
  const [corrections, setCorrections] = useState<any[]>([])
  const [corrLoading, setCorrLoading] = useState(false)

  const fetchCorrections = async () => {
    setCorrLoading(true)
    try {
      const res = await fetch('/api/shifts/corrections?status=PENDING', { cache: 'no-store' })
      if (res.ok) {
        const data = await res.json()
        setCorrections(data.requests || [])
      }
    } catch {}
    setCorrLoading(false)
  }

  const handleReviewCorrection = async (id: string, action: 'APPROVED' | 'REJECTED') => {
    haptic('medium')
    try {
      const res = await fetch(`/api/shifts/corrections/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      if (res.ok) {
        setCorrections((prev) => prev.filter((c) => c.id !== id))
        if (action === 'APPROVED') {
          fetchShifts()
          setSuccess('Shift updated from correction')
          setTimeout(() => setSuccess(''), 3000)
        }
      }
    } catch {}
  }

  // Weekly summary state
  const [viewMode, setViewMode] = useState<'shifts' | 'weekly'>('shifts')
  const [weeklyData, setWeeklyData] = useState<WeeklySummary[]>([])
  const [weeklyTotalHours, setWeeklyTotalHours] = useState(0)
  const [weeklyTotalShifts, setWeeklyTotalShifts] = useState(0)
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(() => {
    // Get Monday of current week
    const today = new Date()
    const day = today.getDay()
    const diff = day === 0 ? -6 : 1 - day // If Sunday (0), go back 6 days; otherwise go to Monday
    const monday = new Date(today)
    monday.setDate(today.getDate() + diff)
    monday.setHours(0, 0, 0, 0)
    return monday
  })

  const fetchShifts = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filterWorker) params.append('workerId', filterWorker)
      if (dateFrom) params.append('from', dateFrom)
      if (dateTo) params.append('to', dateTo)

      const res = await fetch(`/api/shifts/all?${params}`, { cache: "no-store" })
      if (res.ok) {
        const data = await res.json()
        setShifts(data.shifts || [])
        setTimezone(data.timezone || 'America/New_York')
      }
    } catch {}
    setLoading(false)
  }

  const fetchWeeklySummary = async () => {
    setLoading(true)
    try {
      // Calculate week end (Sunday)
      const weekEnd = new Date(currentWeekStart)
      weekEnd.setDate(currentWeekStart.getDate() + 6)
      weekEnd.setHours(23, 59, 59, 999)

      const params = new URLSearchParams()
      params.append('from', currentWeekStart.toISOString())
      params.append('to', weekEnd.toISOString())
      if (filterWorker) params.append('workerId', filterWorker)

      const res = await fetch(`/api/shifts/weekly?${params}`, { cache: "no-store" })
      if (res.ok) {
        const data = await res.json()
        setWeeklyData(data.weeks || [])
        setWeeklyTotalHours(data.totalHours || 0)
        setWeeklyTotalShifts(data.totalShifts || 0)
        setTimezone(data.timezone || 'America/New_York')
      }
    } catch {}
    setLoading(false)
  }

  useEffect(() => {
    if (viewMode === 'shifts') {
      fetchShifts()
    } else {
      fetchWeeklySummary()
    }
  }, [filterWorker, dateFrom, dateTo, viewMode, currentWeekStart])

  useEffect(() => {
    fetchCorrections()
  }, [])

  const totalHours = shifts.reduce((sum, s) => sum + s.hours, 0)

  const goToPreviousWeek = () => {
    haptic('light')
    const prev = new Date(currentWeekStart)
    prev.setDate(prev.getDate() - 7)
    setCurrentWeekStart(prev)
  }

  const goToNextWeek = () => {
    haptic('light')
    const next = new Date(currentWeekStart)
    next.setDate(next.getDate() + 7)
    setCurrentWeekStart(next)
  }

  const goToThisWeek = () => {
    haptic('light')
    const today = new Date()
    const day = today.getDay()
    const diff = day === 0 ? -6 : 1 - day
    const monday = new Date(today)
    monday.setDate(today.getDate() + diff)
    monday.setHours(0, 0, 0, 0)
    setCurrentWeekStart(monday)
  }

  const formatWeekRange = (start: Date) => {
    const end = new Date(start)
    end.setDate(start.getDate() + 6)
    const startStr = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    const endStr = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    return `Week of ${startStr} - ${endStr}`
  }

  const isCurrentWeek = () => {
    const today = new Date()
    const day = today.getDay()
    const diff = day === 0 ? -6 : 1 - day
    const monday = new Date(today)
    monday.setDate(today.getDate() + diff)
    monday.setHours(0, 0, 0, 0)
    return currentWeekStart.getTime() === monday.getTime()
  }

  const handleExport = () => {
    const params = new URLSearchParams()
    if (filterWorker) params.append('workerId', filterWorker)
    if (exportMonth) params.append('month', exportMonth)
    params.append('format', 'sheet')
    
    window.open(`/api/timesheet/export?${params}`, '_blank')
  }

  const openEditModal = (shift: Shift) => {
    haptic('light')
    setEditingShift(shift)
    // Format dates for datetime-local input using org timezone
    setEditStart(toDateTimeLocalString(shift.startedAt, timezone))
    if (shift.endedAt) {
      setEditEnd(toDateTimeLocalString(shift.endedAt, timezone))
    } else {
      setEditEnd('')
    }
    setError('')
  }

  const handleUpdateShift = async () => {
    if (!editingShift) return

    // Convert from org timezone datetime-local string to UTC
    const start = fromDateTimeLocalString(editStart, timezone)
    const end = editEnd ? fromDateTimeLocalString(editEnd, timezone) : null

    if (end && end <= start) {
      setError('End time must be after start time')
      return
    }

    setLoading(true)
    setError('')

    try {
      const res = await fetch(`/api/shifts/${editingShift.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startedAt: start.toISOString(),
          endedAt: end ? end.toISOString() : null,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Failed to update')
        return
      }

      setSuccess('Shift updated')
      setEditingShift(null)
      fetchShifts()
      setTimeout(() => setSuccess(''), 3000)
    } catch {
      setError('Connection error')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteShift = async (shift: Shift) => {
    setConfirmAction({
      title: `Delete ${shift.worker.name}'s shift?`,
      message: 'This removes the shift from timesheets and cannot be undone.',
      confirmLabel: 'Delete Shift',
      confirmStyle: 'danger',
      onConfirm: () => performDeleteShift(shift),
    })
  }

  const performDeleteShift = async (shift: Shift) => {
    setConfirmAction(null)
    setLoading(true)
    try {
      const res = await fetch(`/api/shifts/${shift.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Failed to delete')
        return
      }
      setSuccess('Shift deleted')
      fetchShifts()
      setTimeout(() => setSuccess(''), 3000)
    } catch {
      setError('Connection error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Pending Correction Requests */}
      {corrections.length > 0 && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 overflow-hidden">
          <div className="px-4 py-3 border-b border-amber-500/20">
            <h3 className="text-sm font-semibold text-amber-700 dark:text-amber-400">
              ⏳ {corrections.length} Pending Correction{corrections.length > 1 ? 's' : ''}
            </h3>
          </div>
          <ul className="divide-y divide-amber-500/10">
            {corrections.map((c) => (
              <li key={c.id} className="px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{c.worker?.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Original: {formatTimeInTz(c.shift.startedAt, timezone)}
                    {c.shift.endedAt ? ` → ${formatTimeInTz(c.shift.endedAt, timezone)}` : ' (no end)'}
                  </p>
                  <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">
                    Requested: {formatTimeInTz(c.requestedStart, timezone)}
                    {c.requestedEnd ? ` → ${formatTimeInTz(c.requestedEnd, timezone)}` : ' (no end)'}
                  </p>
                  {c.reason && (
                    <p className="text-xs text-muted-foreground mt-0.5 italic">“{c.reason}”</p>
                  )}
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => handleReviewCorrection(c.id, 'APPROVED')}
                    className="bf-btn bf-btn-success bf-btn-sm"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => handleReviewCorrection(c.id, 'REJECTED')}
                    className="bf-btn bf-btn-secondary bf-btn-sm"
                  >
                    Reject
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* View Mode Toggle */}
      <div className="flex items-center justify-center gap-1 p-1 bg-muted rounded-lg w-fit mx-auto">
        <button
          onClick={() => { haptic('light'); setViewMode('shifts') }}
          className={`px-6 py-2.5 min-h-[44px] rounded-md text-sm font-medium transition-all ${
            viewMode === 'shifts'
              ? 'bg-card text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Shifts
        </button>
        <button
          onClick={() => { haptic('light'); setViewMode('weekly') }}
          className={`px-6 py-2.5 min-h-[44px] rounded-md text-sm font-medium transition-all ${
            viewMode === 'weekly'
              ? 'bg-card text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Weekly Summary
        </button>
      </div>

      {/* Filters - Stack on mobile */}
      <div className="flex flex-col sm:flex-row gap-3">
        <select
          value={filterWorker}
          onChange={(e) => setFilterWorker(e.target.value)}
          className="px-3 py-3 rounded-lg bg-card border border-border text-foreground text-sm focus:outline-none focus:border-primary"
        >
          <option value="">All Workers</option>
          {workers.map((w) => (
            <option key={w.id} value={w.id}>{w.name}</option>
          ))}
        </select>
        <div className="flex gap-2 w-full sm:w-auto">
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="flex-1 min-w-0 px-3 py-3 min-h-[44px] rounded-lg bg-card border border-border text-foreground text-sm focus:outline-none focus:border-primary"
          />
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="flex-1 min-w-0 px-3 py-3 min-h-[44px] rounded-lg bg-card border border-border text-foreground text-sm focus:outline-none focus:border-primary"
          />
        </div>
        <input
          type="month"
          value={exportMonth}
          onChange={(e) => setExportMonth(e.target.value)}
          className="w-full sm:w-auto px-3 py-3 min-h-[44px] rounded-lg bg-card border border-border text-foreground text-sm focus:outline-none focus:border-primary"
          aria-label="Sheet export month"
        />
        <button
          onClick={handleExport}
          className="bf-btn bf-btn-primary w-full sm:w-auto"
        >
          Export Formatted Sheet
        </button>
      </div>

      {/* Summary */}
      {viewMode === 'shifts' ? (
        <div className="text-sm">
          <span className="text-muted-foreground">Total: </span>
          <span className="text-foreground font-semibold tabular-nums">{formatDuration(totalHours)}</span>
          <span className="text-muted-foreground"> · </span>
          <span className="text-foreground font-semibold tabular-nums">{shifts.length}</span>
          <span className="text-muted-foreground"> shifts</span>
        </div>
      ) : (
        <div className="text-sm">
          <span className="text-muted-foreground">{formatWeekRange(currentWeekStart)}</span>
        </div>
      )}

      {/* Messages */}
      {error && (
        <div className="p-3 rounded-lg bg-destructive-subtle border border-destructive">
          <p className="text-destructive text-sm">{error}</p>
        </div>
      )}
      {success && (
        <div className="p-3 rounded-lg bg-success-subtle border border-success">
          <p className="text-success text-sm font-medium">{success}</p>
        </div>
      )}

      {/* Edit Modal - Full screen on mobile */}
      {editingShift && (
        <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-xl p-5 w-full max-w-md space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-medium text-foreground">Edit Shift</h3>
              <button
                onClick={() => setEditingShift(null)}
                className="bf-icon-btn"
              >
                ✕
              </button>
            </div>
            
            <div className="text-sm text-muted-foreground mb-2">
              {editingShift.worker.name}
            </div>
            
            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground block mb-1.5">Start Time</label>
                <input
                  type="datetime-local"
                  value={editStart}
                  onChange={(e) => setEditStart(e.target.value)}
                  className="w-full px-3 py-3 bg-background border border-border rounded-lg text-foreground text-base focus:outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1.5">End Time</label>
                <input
                  type="datetime-local"
                  value={editEnd}
                  onChange={(e) => setEditEnd(e.target.value)}
                  className="w-full px-3 py-3 bg-background border border-border rounded-lg text-foreground text-base focus:outline-none focus:border-primary"
                />
                <p className="text-xs text-muted-foreground mt-1">Leave blank if still on shift</p>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={handleUpdateShift}
                disabled={loading}
                className="bf-btn bf-btn-primary flex-1"
              >
                {loading ? 'Saving...' : 'Save Changes'}
              </button>
              <button
                onClick={() => handleDeleteShift(editingShift)}
                disabled={loading}
                className="bf-btn bf-btn-soft-danger"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Content - Shifts or Weekly Summary */}
      {viewMode === 'shifts' ? (
        <div className="space-y-2">
          {shifts.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No shifts found</p>
          ) : (
            shifts.map((shift) => {
              const isZeroLength = shift.hours < (1 / 60) // Less than 1 minute
              return (
                <div
                  key={shift.id}
                  className={`bg-card border border-border rounded-lg p-4 ${isZeroLength ? 'opacity-50' : ''}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <span className="text-sm font-bold text-primary">{shift.worker.name.charAt(0)}</span>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">{shift.worker.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDateInTz(shift.startedAt, timezone)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatTimeInTz(shift.startedAt, timezone)}
                          {shift.endedAt && ` - ${formatTimeInTz(shift.endedAt, timezone)}`}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center gap-2">
                        <p className={`text-base font-semibold tabular-nums ${shift.status === 'ACTIVE' ? 'text-success' : 'text-foreground'}`}>
                          {formatDuration(shift.hours)}
                        </p>
                        {isZeroLength && (
                          <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                            login only
                          </span>
                        )}
                      </div>
                      {shift.status === 'ACTIVE' && (
                        <span className="text-xs text-success">On shift</span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => openEditModal(shift)}
                    className="w-full mt-3 py-2.5 text-sm font-medium rounded-lg border border-border text-muted-foreground hover:text-foreground hover:border-foreground transition-colors"
                  >
                    Edit Shift
                  </button>
                </div>
              )
            })
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {/* Week Navigation */}
          <div className="flex items-center justify-between gap-2">
            <button
              onClick={goToPreviousWeek}
              className="px-4 py-2.5 min-h-[44px] rounded-lg bg-card border border-border text-foreground text-sm font-medium hover:bg-muted transition-colors"
            >
              ← Previous Week
            </button>
            <button
              onClick={goToThisWeek}
              disabled={isCurrentWeek()}
              className="px-4 py-2.5 min-h-[44px] rounded-lg bg-card border border-border text-foreground text-sm font-medium hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              This Week
            </button>
            <button
              onClick={goToNextWeek}
              className="px-4 py-2.5 min-h-[44px] rounded-lg bg-card border border-border text-foreground text-sm font-medium hover:bg-muted transition-colors"
            >
              Next Week →
            </button>
          </div>

          {/* Weekly Summary Cards */}
          <div className="space-y-2">
            {weeklyData.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No data for this week</p>
            ) : (
              <>
                {weeklyData.map((worker) => {
                  const dayKeys = Object.keys(worker.days).sort()
                  return (
                    <div
                      key={worker.workerId}
                      className="bg-card border border-border rounded-lg p-4"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                            <span className="text-sm font-bold text-primary">{worker.workerName.charAt(0)}</span>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-foreground">{worker.workerName}</p>
                            <p className="text-xs text-muted-foreground">
                              {worker.shiftCount} shift{worker.shiftCount !== 1 ? 's' : ''}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-semibold tabular-nums text-foreground">
                            {formatDuration(worker.totalHours)}
                          </p>
                        </div>
                      </div>
                      {/* Day breakdown */}
                      {dayKeys.length > 0 && (
                        <div className="grid grid-cols-7 gap-1">
                          {dayKeys.map((day) => {
                            const label = new Date(day + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short' })
                            const isToday = day === new Date().toISOString().split('T')[0]
                            return (
                              <div
                                key={day}
                                className={`text-center rounded px-1 py-1.5 text-xs ${
                                  isToday
                                    ? 'bg-primary/15 border border-primary/30'
                                    : 'bg-muted/50'
                                }`}
                              >
                                <div className="text-muted-foreground font-medium">{label}</div>
                                <div className="text-foreground font-semibold tabular-nums mt-0.5">
                                  {formatDuration(worker.days[day].hours)}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })}

                {/* Total Row */}
                <div className="bg-emerald-500/5 border-2 border-emerald-500/20 rounded-lg p-4 mt-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-foreground">Total</p>
                      <p className="text-xs text-muted-foreground">
                        {weeklyTotalShifts} shift{weeklyTotalShifts !== 1 ? 's' : ''}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                        {formatDuration(weeklyTotalHours)}
                      </p>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <ConfirmModal
        open={!!confirmAction}
        title={confirmAction?.title || ''}
        message={confirmAction?.message}
        confirmLabel={confirmAction?.confirmLabel}
        confirmStyle={confirmAction?.confirmStyle}
        onCancel={() => setConfirmAction(null)}
        onConfirm={() => confirmAction?.onConfirm()}
      />
    </div>
  )
}
