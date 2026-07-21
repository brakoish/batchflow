'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { MegaphoneIcon } from '@heroicons/react/24/solid'

type Announcement = { message: string; updatedAt: string }

export default function AnnouncementBar() {
  const [announcement, setAnnouncement] = useState<Announcement | null>(null)
  const [overflowing, setOverflowing] = useState(false)
  const viewportRef = useRef<HTMLDivElement>(null)
  const textRef = useRef<HTMLSpanElement>(null)

  const loadAnnouncement = useCallback(async () => {
    try {
      const response = await fetch('/api/announcement', { cache: 'no-store' })
      if (!response.ok) return
      const data = await response.json()
      setAnnouncement(data.announcement)
    } catch {
      // Keep the current banner during temporary connection failures.
    }
  }, [])

  useEffect(() => {
    loadAnnouncement()
    const interval = window.setInterval(loadAnnouncement, 60_000)
    window.addEventListener('announcement-changed', loadAnnouncement)
    return () => {
      window.clearInterval(interval)
      window.removeEventListener('announcement-changed', loadAnnouncement)
    }
  }, [loadAnnouncement])

  useEffect(() => {
    if (!announcement) return
    const measure = () => {
      if (!viewportRef.current || !textRef.current) return
      setOverflowing(textRef.current.scrollWidth > viewportRef.current.clientWidth)
    }
    measure()
    const observer = new ResizeObserver(measure)
    if (viewportRef.current) observer.observe(viewportRef.current)
    return () => observer.disconnect()
  }, [announcement])

  if (!announcement) return null

  return (
    <div className="bg-amber-400 text-amber-950 border-b border-amber-500/60" role="status" aria-live="polite">
      <div className="max-w-5xl mx-auto h-9 px-3 flex items-center gap-2 overflow-hidden">
        <MegaphoneIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
        <div ref={viewportRef} className="min-w-0 flex-1 overflow-hidden whitespace-nowrap">
          <div className={overflowing ? 'bf-announcement-track' : ''}>
            <span ref={textRef} className="inline-block text-sm font-semibold">
              {announcement.message}
            </span>
            {overflowing && (
              <span className="inline-block pl-16 text-sm font-semibold" aria-hidden="true">
                {announcement.message}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
