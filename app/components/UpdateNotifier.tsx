'use client'

import { useEffect, useState } from 'react'
import { ArrowPathIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { haptic } from '@/lib/haptic'

/**
 * Shows a small banner when a new service worker is ready.
 *
 * next-pwa is configured with `skipWaiting: true`, which means a new SW
 * activates automatically — but any tabs/PWAs open at the moment keep
 * running the old JS/HTML until they reload. This component detects that
 * swap and lets the user reload in one tap instead of hunting for the
 * right iOS/Android gesture to force a refresh.
 *
 * Trigger sources:
 *  1. `controllerchange` fires when a new SW takes control of the page.
 *     With skipWaiting this happens automatically — we use that as our
 *     "new version is live" signal.
 *  2. `updatefound` + `statechange → 'installed'` catches the moment a
 *     waiting SW finishes installing, in case skipWaiting ever changes.
 *  3. Periodic `registration.update()` pings the server for a new SW
 *     every 10 minutes so long-running PWAs notice without a reload.
 */
export default function UpdateNotifier() {
  const [showBanner, setShowBanner] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!('serviceWorker' in navigator)) return

    let controllerChangeFired = false
    let mounted = true

    // Initial page load produces a controllerchange too; ignore that one.
    // Everything after the first firing is a real version swap.
    const onControllerChange = () => {
      if (!mounted) return
      if (!controllerChangeFired) {
        controllerChangeFired = true
        return
      }
      setShowBanner(true)
    }

    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange)

    // Pro-actively check for updates every 10 minutes while the app is open.
    let intervalId: number | undefined
    let registration: ServiceWorkerRegistration | null = null

    navigator.serviceWorker.ready
      .then((reg) => {
        if (!mounted) return
        registration = reg

        // Catch the "new SW finished installing, waiting" state too —
        // belt-and-suspenders for non-skipWaiting scenarios.
        if (reg.waiting && navigator.serviceWorker.controller) {
          setShowBanner(true)
        }

        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing
          if (!newWorker) return
          newWorker.addEventListener('statechange', () => {
            if (
              newWorker.state === 'installed' &&
              navigator.serviceWorker.controller
            ) {
              setShowBanner(true)
            }
          })
        })

        intervalId = window.setInterval(() => {
          reg.update().catch(() => {})
        }, 10 * 60 * 1000)
      })
      .catch(() => {})

    return () => {
      mounted = false
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange)
      if (intervalId) clearInterval(intervalId)
    }
  }, [])

  // Reset dismissal if a newer update shows up
  useEffect(() => {
    if (showBanner) setDismissed(false)
  }, [showBanner])

  if (!showBanner || dismissed) return null

  const handleRefresh = () => {
    haptic('medium')
    // Ask any waiting SW to activate immediately (no-op if none), then reload.
    if (navigator.serviceWorker.controller && 'skipWaiting' in (navigator.serviceWorker.controller as any)) {
      try {
        navigator.serviceWorker.controller.postMessage({ type: 'SKIP_WAITING' })
      } catch {}
    }
    window.location.reload()
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed left-1/2 -translate-x-1/2 z-[60] bottom-[5.5rem] sm:bottom-6 w-[min(92vw,420px)] pointer-events-auto"
    >
      <div className="rounded-2xl shadow-lg bg-emerald-600 text-white px-4 py-3 flex items-center gap-3 animate-in fade-in slide-in-from-bottom-2 duration-200">
        <ArrowPathIcon className="w-5 h-5 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold leading-tight">New version ready</p>
          <p className="text-xs text-white/80 leading-tight mt-0.5">Tap refresh to load the update.</p>
        </div>
        <button
          onClick={handleRefresh}
          className="min-h-[40px] px-3 rounded-lg bg-white text-emerald-700 text-xs font-bold hover:bg-emerald-50 active:scale-[0.97] transition-all"
        >
          Refresh
        </button>
        <button
          onClick={() => { haptic('light'); setDismissed(true) }}
          aria-label="Dismiss"
          className="min-h-[40px] min-w-[40px] p-2 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors flex items-center justify-center"
        >
          <XMarkIcon className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
