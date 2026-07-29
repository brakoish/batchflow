'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeftIcon,
  BoltIcon,
  CheckCircleIcon,
  QrCodeIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline'
import QrScanner from 'qr-scanner'
import { haptic } from '@/lib/haptic'

type ScanResult = {
  name: string
  strain: string | null
  packageLabel: string | null
  sourceUrl: string
}

type ScannerState = 'starting' | 'scanning' | 'loading' | 'result' | 'error'

type ExtendedTrackCapabilities = MediaTrackCapabilities & {
  focusMode?: string[]
  zoom?: { min: number; max: number }
}

type ExtendedTrackConstraintSet = MediaTrackConstraintSet & {
  focusMode?: string
  zoom?: number
}

async function optimizeRearCamera(video: HTMLVideoElement) {
  if (!(video.srcObject instanceof MediaStream)) return

  const track = video.srcObject.getVideoTracks()[0]
  if (!track?.getCapabilities) return

  const capabilities = track.getCapabilities() as ExtendedTrackCapabilities
  const cameraSettings: ExtendedTrackConstraintSet = {}

  if (capabilities.focusMode?.includes('continuous')) {
    cameraSettings.focusMode = 'continuous'
  }

  if (capabilities.zoom && capabilities.zoom.max > 1) {
    cameraSettings.zoom = Math.min(1.5, capabilities.zoom.max)
  }

  if (Object.keys(cameraSettings).length > 0) {
    await track.applyConstraints({ advanced: [cameraSettings] })
  }
}

export default function RetailIdScanner() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const scannerRef = useRef<QrScanner | null>(null)
  const scanLockedRef = useRef(false)
  const mountedRef = useRef(true)

  const [state, setState] = useState<ScannerState>('starting')
  const [result, setResult] = useState<ScanResult | null>(null)
  const [error, setError] = useState('')
  const [torchAvailable, setTorchAvailable] = useState(false)
  const [torchOn, setTorchOn] = useState(false)

  const lookUpRetailId = useCallback(async (url: string) => {
    if (scanLockedRef.current) return

    scanLockedRef.current = true
    scannerRef.current?.stop()
    setState('loading')
    haptic('medium')

    try {
      const response = await fetch('/api/tools/retail-id', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({ url }),
      })
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Could not read that Retail ID.')
      }

      if (!mountedRef.current) return
      setResult(data)
      setState('result')
      haptic('medium')
    } catch (lookupError) {
      if (!mountedRef.current) return
      setError(
        lookupError instanceof Error
          ? lookupError.message
          : 'Could not read that Retail ID.'
      )
      setState('error')
      haptic('heavy')
    }
  }, [])

  const startCamera = useCallback(async () => {
    scannerRef.current?.destroy()
    scannerRef.current = null
    setError('')
    setResult(null)
    setTorchAvailable(false)
    setTorchOn(false)
    setState('starting')
    scanLockedRef.current = false

    try {
      const video = videoRef.current
      if (!video) return

      const scanner = new QrScanner(
        video,
        (scan) => {
          void lookUpRetailId(scan.data)
        },
        {
          preferredCamera: 'environment',
          maxScansPerSecond: 5,
          calculateScanRegion: (cameraVideo) => {
            const size = Math.round(
              Math.min(cameraVideo.videoWidth, cameraVideo.videoHeight) * 0.85
            )

            return {
              x: Math.round((cameraVideo.videoWidth - size) / 2),
              y: Math.round((cameraVideo.videoHeight - size) / 2),
              width: size,
              height: size,
            }
          },
          returnDetailedScanResult: true,
        }
      )

      scannerRef.current = scanner
      await scanner.start()
      await optimizeRearCamera(video).catch(() => undefined)

      if (!mountedRef.current) {
        scanner.destroy()
        return
      }

      setTorchAvailable(await scanner.hasFlash())
      setState('scanning')
    } catch (cameraError) {
      if (!mountedRef.current) return

      const message =
        cameraError instanceof DOMException &&
        (cameraError.name === 'NotAllowedError' ||
          cameraError.name === 'PermissionDeniedError')
          ? 'Camera access is blocked. Allow camera access for BatchFlow, then try again.'
          : 'Could not start the camera. Check camera access for BatchFlow, then try again.'

      setError(message)
      setState('error')
    }
  }, [lookUpRetailId])

  useEffect(() => {
    mountedRef.current = true
    startCamera()

    return () => {
      mountedRef.current = false
      scannerRef.current?.destroy()
      scannerRef.current = null
    }
  }, [startCamera])

  const toggleTorch = async () => {
    const scanner = scannerRef.current
    if (!scanner) return

    try {
      await scanner.toggleFlash()
      setTorchOn(scanner.isFlashOn())
      haptic('light')
    } catch {
      setTorchAvailable(false)
      setError('Flash control is not available on this camera.')
    }
  }

  const scanAgain = async () => {
    const scanner = scannerRef.current
    if (!scanner) {
      await startCamera()
      return
    }

    setResult(null)
    setError('')
    setState('starting')
    scanLockedRef.current = false

    try {
      await scanner.start()
      if (!mountedRef.current) return
      setTorchAvailable(await scanner.hasFlash())
      setState('scanning')
    } catch {
      if (!mountedRef.current) return
      setError(
        'Could not restart the camera. Check camera access for BatchFlow, then try again.'
      )
      setState('error')
    }
  }

  return (
    <main className="mx-auto w-full max-w-xl px-4 py-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href="/tools"
            aria-label="Back to tools"
            className="bf-icon-btn shrink-0"
          >
            <ArrowLeftIcon className="h-5 w-5" />
          </Link>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-bold">Retail ID Scanner</h1>
            <p className="text-xs text-muted-foreground">
              Move close and center the QR code
            </p>
          </div>
        </div>

        {torchAvailable && state !== 'result' && (
          <button
            type="button"
            onClick={toggleTorch}
            aria-pressed={torchOn}
            className={`bf-btn bf-btn-sm shrink-0 ${
              torchOn ? 'bf-btn-primary' : 'bf-btn-secondary'
            }`}
          >
            <BoltIcon className="h-4 w-4" />
            {torchOn ? 'Flash on' : 'Flash'}
          </button>
        )}
      </div>

      <div className="relative aspect-[3/4] max-h-[64dvh] overflow-hidden rounded-3xl bg-black shadow-lg">
        <video
          ref={videoRef}
          muted
          playsInline
          className="h-full w-full object-cover"
          aria-label="Camera preview"
        />

        {(state === 'starting' || state === 'scanning') && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="relative aspect-square w-[58%] rounded-3xl border border-white/30">
              <span className="absolute -left-0.5 -top-0.5 h-12 w-12 rounded-tl-3xl border-l-4 border-t-4 border-emerald-400" />
              <span className="absolute -right-0.5 -top-0.5 h-12 w-12 rounded-tr-3xl border-r-4 border-t-4 border-emerald-400" />
              <span className="absolute -bottom-0.5 -left-0.5 h-12 w-12 rounded-bl-3xl border-b-4 border-l-4 border-emerald-400" />
              <span className="absolute -bottom-0.5 -right-0.5 h-12 w-12 rounded-br-3xl border-b-4 border-r-4 border-emerald-400" />
              {state === 'scanning' && (
                <span className="absolute left-3 right-3 top-1/2 h-0.5 bg-emerald-400/90 shadow-[0_0_14px_rgba(52,211,153,0.9)]" />
              )}
            </div>
          </div>
        )}

        {state === 'starting' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/70 px-8 text-center text-white">
            <QrCodeIcon className="h-10 w-10 animate-pulse" />
            <p className="font-semibold">Starting camera…</p>
          </div>
        )}

        {state === 'loading' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/75 px-8 text-center text-white">
            <span className="h-10 w-10 animate-spin rounded-full border-4 border-white/25 border-t-emerald-400" />
            <p className="font-semibold">Finding product…</p>
          </div>
        )}

        {state === 'result' && result && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/75 p-4">
            <div className="w-full rounded-3xl bg-white p-5 text-slate-950 shadow-2xl">
              <CheckCircleIcon className="mb-3 h-10 w-10 text-emerald-600" />
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-emerald-700">
                Product found
              </p>
              <h2 className="mt-2 text-2xl font-extrabold leading-tight">
                {result.name}
              </h2>
              {result.strain && (
                <p className="mt-2 text-base font-semibold text-slate-600">
                  {result.strain}
                </p>
              )}
              {result.packageLabel && (
                <p className="mt-4 break-all font-mono text-xs text-slate-500">
                  {result.packageLabel}
                </p>
              )}
              <button
                type="button"
                onClick={scanAgain}
                className="mt-5 min-h-[52px] w-full rounded-xl bg-emerald-600 px-4 text-base font-bold text-white active:scale-[0.98]"
              >
                Scan next item
              </button>
            </div>
          </div>
        )}

        {state === 'error' && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80 p-4">
            <div className="w-full rounded-3xl bg-white p-5 text-center text-slate-950 shadow-2xl">
              <XCircleIcon className="mx-auto h-10 w-10 text-red-500" />
              <h2 className="mt-3 text-lg font-bold">Couldn’t scan</h2>
              <p className="mt-2 text-sm text-slate-600">{error}</p>
              <button
                type="button"
                onClick={startCamera}
                className="mt-5 min-h-[52px] w-full rounded-xl bg-slate-950 px-4 text-base font-bold text-white active:scale-[0.98]"
              >
                Try again
              </button>
            </div>
          </div>
        )}
      </div>

      <p className="mt-3 text-center text-xs text-muted-foreground">
        Camera video stays on this device. Only the scanned Retail ID link is
        looked up.
      </p>
    </main>
  )
}
