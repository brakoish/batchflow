'use client'

import { useState } from 'react'
import { MegaphoneIcon } from '@heroicons/react/24/outline'
import { haptic } from '@/lib/haptic'

type InitialAnnouncement = {
  message: string
  active: boolean
  updatedAt: string
} | null

export default function AnnouncementManager({ initialAnnouncement }: { initialAnnouncement: InitialAnnouncement }) {
  const [message, setMessage] = useState(initialAnnouncement?.message ?? '')
  const [active, setActive] = useState(initialAnnouncement?.active ?? true)
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState('')

  const save = async () => {
    setSaving(true)
    setFeedback('')
    try {
      const response = await fetch('/api/announcement', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, active }),
      })
      const data = await response.json()
      if (!response.ok) {
        setFeedback(data.error || 'Could not save the announcement.')
        return
      }
      haptic('medium')
      setFeedback(active ? 'Announcement is live.' : 'Draft saved. The bar is off.')
      window.dispatchEvent(new Event('announcement-changed'))
    } catch {
      setFeedback('Could not connect. Try again.')
    } finally {
      setSaving(false)
    }
  }

  const turnOff = async () => {
    setSaving(true)
    setFeedback('')
    try {
      const response = await fetch('/api/announcement', { method: 'DELETE' })
      if (!response.ok) throw new Error()
      haptic('light')
      setActive(false)
      setFeedback('Announcement bar turned off.')
      window.dispatchEvent(new Event('announcement-changed'))
    } catch {
      setFeedback('Could not turn off the announcement.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-border bg-card p-4 sm:p-5">
        <div className="flex items-start gap-3 mb-4">
          <div className="rounded-xl bg-amber-400/20 p-2 text-amber-600 dark:text-amber-400">
            <MegaphoneIcon className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-semibold text-foreground">Message everyone</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              This appears at the top of every signed-in screen. Long messages scroll automatically.
            </p>
          </div>
        </div>

        <label htmlFor="announcement-message" className="block text-sm font-medium text-foreground mb-2">
          Announcement
        </label>
        <textarea
          id="announcement-message"
          value={message}
          onChange={(event) => setMessage(event.target.value.slice(0, 500))}
          rows={4}
          placeholder="Example: Team meeting at 2:30 PM by the packaging line."
          className="w-full resize-none rounded-xl border border-border bg-background px-3 py-3 text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-amber-500"
        />
        <div className="mt-1 flex justify-end text-xs text-muted-foreground">{message.length}/500</div>

        <label className="mt-3 flex min-h-[48px] items-center justify-between gap-4 rounded-xl bg-muted px-3 cursor-pointer">
          <span>
            <span className="block text-sm font-medium text-foreground">Show announcement</span>
            <span className="block text-xs text-muted-foreground">Turn this off to save the message without displaying it.</span>
          </span>
          <input
            type="checkbox"
            checked={active}
            onChange={(event) => setActive(event.target.checked)}
            className="h-5 w-5 accent-amber-500"
          />
        </label>

        {feedback && (
          <p className={`mt-3 text-sm ${feedback.includes('Could not') ? 'text-destructive' : 'text-emerald-600 dark:text-emerald-400'}`} role="status">
            {feedback}
          </p>
        )}

        <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          {initialAnnouncement && (
            <button onClick={turnOff} disabled={saving} className="bf-btn bf-btn-secondary bf-btn-lg">
              Turn Off
            </button>
          )}
          <button onClick={save} disabled={saving || !message.trim()} className="bf-btn bf-btn-primary bf-btn-lg">
            {saving ? 'Saving…' : active ? 'Publish Announcement' : 'Save Draft'}
          </button>
        </div>
      </div>
    </div>
  )
}
