'use client'

import { useState, useEffect } from 'react'
import { haptic } from '@/lib/haptic'
import { formatDuration } from '@/lib/format'
import { formatTimeInTz, formatDateInTz, toDateTimeLocalString, fromDateTimeLocalString } from '@/lib/timezone'

type Worker = { id: string; name: string }
type Shift = {
  id: string
  worker: { id: string; name: string }
  status: string
  startedAt: string
  endedAt: string | null
  hours: number
}

export default function TimesheetClient({ workers }: { workers: Worker[] }) {
  const [shifts, setShifts] = useState<Shift[]>([])
  const [timezone, setTimezone] = useState('America/New_York')
  const [filterWorker, setFilterWorker] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [loading, setLoading] = useState(false)
  const [editingShift, setEditingShift] = useState<Shift | null>(null)
  const [editStart, setEditStart] = useState('')
  const [editEnd, setEditEnd] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const fetchShifts = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filterWorker) params.append('workerId', filterWorker)
      if (dateFrom) params.append('from', dateFrom)
      if (dateTo) params.append('to', dateTo)

      const res = await fetch(`/api/shifts/all?${params}`)
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
  }, [filterWorker, dateFrom, dateTo])

  const totalHours = shifts.reduce((sum, s) => sum + s.hours, 0)

  const handleExport = () => {
    const params = new URLSearchParams()
    if (filterWorker) params.append('workerId', filterWorker)
    if (dateFrom) params.append('startDate', dateFrom)
    if (dateTo) params.append('endDate', dateTo)
    
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
    if (!confirm(`Delete this shift for ${shift.worker.name}?`)) return
    
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
        <div className="flex gap-2">
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="flex-1 px-3 py-3 rounded-lg bg-card border border-border text-foreground text-sm focus:outline-none focus:border-primary"
          />
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="flex-1 px-3 py-3 rounded-lg bg-card border border-border text-foreground text-sm focus:outline-none focus:border-primary"
          />
        </div>
        <button
          onClick={handleExport}
          className="px-4 py-3 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          Export CSV
        </button>
      </div>

      {/* Summary */}
      <div className="text-sm">
        <span className="text-muted-foreground">Total: </span>
        <span className="text-foreground font-semibold tabular-nums">{formatDuration(totalHours)}</span>
        <span className="text-muted-foreground"> · </span>
        <span className="text-foreground font-semibold tabular-nums">{shifts.length}</span>
        <span className="text-muted-foreground"> shifts</span>
      </div>

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
                className="text-muted-foreground hover:text-foreground p-2"
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
                className="flex-1 py-3 bg-primary text-primary-foreground font-medium text-sm rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-40"
              >
                {loading ? 'Saving...' : 'Save Changes'}
              </button>
              <button
                onClick={() => handleDeleteShift(editingShift)}
                disabled={loading}
                className="px-4 py-3 border border-destructive text-destructive text-sm font-medium rounded-lg hover:bg-destructive hover:text-destructive-foreground transition-colors disabled:opacity-40"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Shifts list - Mobile optimized */}
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
    </div>
  )
}