'use client'

import { useCallback, useEffect, useState } from 'react'
import { haptic } from '@/lib/haptic'

type DueReminder = { id: string; message: string; emoji: string; intervalMinutes: number }

export default function EmployeeReminderManager() {
  const [queue, setQueue] = useState<DueReminder[]>([])

  const showBrowserNotification = useCallback(async (reminder: DueReminder) => {
    if (!('Notification' in window) || Notification.permission !== 'granted') return
    try {
      const registration = await navigator.serviceWorker.ready
      await registration.showNotification(`${reminder.emoji} Reminder`, {
        body: reminder.message,
        tag: `employee-reminder-${reminder.id}`,
        data: { url: '/batches' },
      })
    } catch {}
  }, [])

  const checkDue = useCallback(async () => {
    if (document.visibilityState === 'hidden') return
    try {
      const res = await fetch('/api/reminders/due', { cache: 'no-store' })
      if (!res.ok) return
      const data = await res.json()
      const due: DueReminder[] = data.reminders || []
      if (!due.length) return
      setQueue((current) => {
        const known = new Set(current.map((item) => item.id))
        return [...current, ...due.filter((item) => !known.has(item.id))]
      })
      due.forEach(showBrowserNotification)
      haptic('heavy')
    } catch {}
  }, [showBrowserNotification])

  useEffect(() => {
    const initial = window.setTimeout(checkDue, 1500)
    const timer = window.setInterval(checkDue, 60_000)
    const onShiftChanged = () => checkDue()
    const onVisibility = () => { if (document.visibilityState === 'visible') checkDue() }
    window.addEventListener('shift-changed', onShiftChanged)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.clearTimeout(initial); window.clearInterval(timer)
      window.removeEventListener('shift-changed', onShiftChanged)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [checkDue])

  const current = queue[0]
  if (!current) return null

  return (
    <div className="fixed inset-x-0 top-4 z-[70] px-4 pointer-events-none" role="status" aria-live="assertive">
      <div className="pointer-events-auto mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-emerald-500/30 bg-card p-4 shadow-2xl">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-2xl">{current.emoji}</span>
        <div className="min-w-0 flex-1"><p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Reminder</p><p className="text-base font-semibold text-foreground">{current.message}</p></div>
        <button type="button" onClick={() => { haptic('light'); setQueue((items) => items.slice(1)) }} className="bf-btn bf-btn-primary shrink-0">Got it</button>
      </div>
    </div>
  )
}
