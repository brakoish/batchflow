'use client'

import { useState } from 'react'
import WorkerManager from './WorkerManager'
import TimesheetClient from '@/app/timesheet/TimesheetClient'

type Worker = {
  id: string
  name: string
  pin: string
  role: string
  hourlyRate: number | null
  preferredLanguage: string
  workTeamMemberships: { teamId: string }[]
}

type Team = { id: string; name: string; members: { workerId: string }[] }

export default function TeamHoursClient({
  workers,
  teams,
  initialView,
}: {
  workers: Worker[]
  teams: Team[]
  initialView: 'people' | 'hours'
}) {
  const [view, setView] = useState(initialView)

  return (
    <>
      <div className="mb-5 grid grid-cols-2 gap-1 rounded-xl bg-muted p-1" role="tablist" aria-label="Team and hours">
        <button
          type="button"
          role="tab"
          aria-selected={view === 'people'}
          onClick={() => setView('people')}
          className={`min-h-[44px] rounded-lg px-4 text-sm font-semibold transition-colors ${view === 'people' ? 'border border-border bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}
        >
          Employees
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={view === 'hours'}
          onClick={() => setView('hours')}
          className={`min-h-[44px] rounded-lg px-4 text-sm font-semibold transition-colors ${view === 'hours' ? 'border border-border bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}
        >
          Hours
        </button>
      </div>

      {view === 'people' ? (
        <WorkerManager workers={workers} initialTeams={teams} />
      ) : (
        <TimesheetClient
          workers={workers.filter((worker) => worker.role === 'WORKER')}
          teams={teams}
        />
      )}
    </>
  )
}
