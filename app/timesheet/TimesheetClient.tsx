'use client'

import { useState, useEffect } from 'react'

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

  return (
    <div>
      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-5">
        <select
          value={filterWorker}
          onChange={(e) => setFilterWorker(e.target.value)}
          className="px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-50 text-xs"
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
          className="px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-50 text-xs"
        />
        <input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          className="px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-50 text-xs"
        />
      </div>

      {/* Summary */}
      <div className="mb-4 text-sm">
        <span className="text-zinc-500">Total: </span>
        <span className="text-zinc-50 font-semibold tabular-nums">{totalHours.toFixed(2)}</span>
        <span className="text-zinc-500"> hours · </span>
        <span className="text-zinc-50 font-semibold tabular-nums">{shifts.length}</span>
        <span className="text-zinc-500"> shifts</span>
      </div>

      {/* Shifts list */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 divide-y divide-zinc-800/50">
        {shifts.length === 0 ? (
          <p className="text-sm text-zinc-600 text-center py-8">No shifts found</p>
        ) : (
          shifts.map((shift) => (
            <div key={shift.id} className="px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0">
                  <span className="text-xs font-bold text-blue-400">{shift.worker.name.charAt(0)}</span>
                </div>
                <div>
                  <p className="text-sm font-medium text-zinc-50">{shift.worker.name}</p>
                  <p className="text-[10px] text-zinc-500">
                    {new Date(shift.startedAt).toLocaleDateString()} · {new Date(shift.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    {shift.endedAt && ` - ${new Date(shift.endedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className={`text-sm font-semibold tabular-nums ${shift.status === 'ACTIVE' ? 'text-emerald-400' : 'text-zinc-50'}`}>
                  {shift.hours.toFixed(2)}h
                </p>
                {shift.status === 'ACTIVE' && (
                  <span className="text-[10px] text-emerald-500">On shift</span>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}