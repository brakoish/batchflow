'use client'

import { useState, useEffect } from 'react'
import { haptic } from '@/lib/haptic'

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
    setEditingShift(shift)
    // Format dates for datetime-local input
    const start = new Date(shift.startedAt)
    setEditStart(start.toISOString().slice(0, 16))
    if (shift.endedAt) {
      const end = new Date(shift.endedAt)
      setEditEnd(end.toISOString().slice(0, 16))
    } else {
      setEditEnd('')
    }
    setError('')
  }

  const handleUpdateShift = async () => {
    if (!editingShift) return
    
    const start = new Date(editStart)
    const end = editEnd ? new Date(editEnd) : null
    
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
          startedAt: editStart,
          endedAt: editEnd || null,
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
      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <select
          value={filterWorker}
          onChange={(e) => setFilterWorker(e.target.value)}
          className="px-3 py-2 rounded-lg bg-card border border-border text-foreground text-sm focus:outline-none focus:border-primary"
        >
          <option value="">All Workers</option>
          {workers.map((w) => (
            <option key={w.id} value={w.id}>{w.name}</option>
          ))}
        </select>
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          className="px-3 py-2 rounded-lg bg-card border border-border text-foreground text-sm focus:outline-none focus:border-primary"
        />
        <input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          className="px-3 py-2 rounded-lg bg-card border border-border text-foreground text-sm focus:outline-none focus:border-primary"
        />
        <button
          onClick={handleExport}
          className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          Export CSV
        </button>
      </div>

      {/* Summary */}
      <div className="text-sm">
        <span className="text-muted-foreground">Total: </span>
        <span className="text-foreground font-semibold tabular-nums">{totalHours.toFixed(2)}</span>
        <span className="text-muted-foreground"> hours · </span>
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

      {/* Edit Modal */}
      {editingShift && (
        <div className="bg-card border border-border rounded-lg p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-foreground">Edit Shift - {editingShift.worker.name}</h3>
            <button
              onClick={() => setEditingShift(null)}
              className="text-muted-foreground hover:text-foreground"
            >
              ✕
            </button>
          </div>
          
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Start Time</label>
              <input
                type="datetime-local"
                value={editStart}
                onChange={(e) => setEditStart(e.target.value)}
                className="w-full px-3 py-2 bg-background border border-border rounded-md text-foreground text-sm focus:outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">End Time (leave blank if still on shift)</label>
              <input
                type="datetime-local"
                value={editEnd}
                onChange={(e) => setEditEnd(e.target.value)}
                className="w-full px-3 py-2 bg-background border border-border rounded-md text-foreground text-sm focus:outline-none focus:border-primary"
              />
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleUpdateShift}
              disabled={loading}
              className="flex-1 py-2 bg-primary text-primary-foreground font-medium text-sm rounded-md hover:bg-primary/90 transition-colors disabled:opacity-40"
            >
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
            <button
              onClick={() => handleDeleteShift(editingShift)}
              disabled={loading}
              className="px-4 py-2 border border-destructive text-destructive text-sm font-medium rounded-md hover:bg-destructive hover:text-destructive-foreground transition-colors disabled:opacity-40"
            >
              Delete
            </button>
          </div>
        </div>
      )}

      {/* Shifts list */}
      <div className="rounded-lg border border-border bg-card divide-y divide-border">
        {shifts.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No shifts found</p>
        ) : (
          shifts.map((shift) => (
            <div key={shift.id} className="px-4 py-3 flex items-center justify-between hover:bg-muted/50 transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <span className="text-xs font-bold text-primary">{shift.worker.name.charAt(0)}</span>
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">{shift.worker.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(shift.startedAt).toLocaleDateString()} · {new Date(shift.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    {shift.endedAt && ` - ${new Date(shift.endedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <p className={`text-sm font-semibold tabular-nums ${shift.status === 'ACTIVE' ? 'text-success' : 'text-foreground'}`}>
                    {shift.hours.toFixed(2)}h
                  </p>
                  {shift.status === 'ACTIVE' && (
                    <span className="text-xs text-success">On shift</span>
                  )}
                </div>
                <button
                  onClick={() => openEditModal(shift)}
                  className="px-3 py-1.5 text-xs border border-border text-muted-foreground hover:text-foreground hover:border-foreground rounded-md transition-colors"
                >
                  Edit
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}