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
import { haptic } from '@/lib/haptic'

type BarcodeDetectorInstance = {
  detect(source: CanvasImageSource): Promise<Array<{ rawValue: string }>>
}

type BarcodeDetectorConstructor = new (options: {
  formats: string[]
}) => BarcodeDetectorInstance

type ScanResult = {
  name: string
  strain: string | null
  packageLabel: string | null
  sourceUrl: string
}

type ScannerState = 'starting' | 'scanning' | 'loading' | 'result' | 'error'

export default function RetailIdScanner() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const detectorRef = useRef<BarcodeDetectorInstance | null>(null)
  const scanTimerRef = useRef<number | null>(null)
  const scanLockedRef = useRef(false)
  const mountedRef = useRef(true)

  const [state, setState] = useState<ScannerState>('starting')
  const [result, setResult] = useState<ScanResult | null>(null)
  const [error, setError] = useState('')
  const [torchAvailable, setTorchAvailable] = useState(false)
  const [torchOn, setTorchOn] = useState(false)

  const stopTimer = useCallback(() => {
    if (scanTimerRef.current !== null) {
      window.clearTimeout(scanTimerRef.current)
      scanTimerRef.current = null
    }
  }, [])

  const lookUpRetailId = useCallback(async (url: string) => {
    scanLockedRef.current = true
    stopTimer()
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
  }, [stopTimer])

  const scanFrame = useCallback(async () => {
    const detector = detectorRef.current
    const video = videoRef.current

    if (
      !detector ||
      !video ||
      video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA ||
      scanLockedRef.current
    ) {
      scanTimerRef.current = window.setTimeout(scanFrame, 180)
      return
    }

    try {
      const barcodes = await detector.detect(video)
      const value = barcodes.find((barcode) => barcode.rawValue)?.rawValue

      if (value) {
        await lookUpRetailId(value)
        return
      }
    } catch {
      // Individual frames can fail while the camera is focusing.
    }

    scanTimerRef.current = window.setTimeout(scanFrame, 180)
  }, [lookUpRetailId])

  const startCamera = useCallback(async () => {
    stopTimer()
    setError('')
    setResult(null)
    setTorchOn(false)
    setState('starting')
    scanLockedRef.current = false

    try {
      const Detector = (
        window as typeof window & {
          BarcodeDetector?: BarcodeDetectorConstructor
        }
      ).BarcodeDetector

      if (!Detector) {
        throw new Error(
          'QR scanning is not supported by this browser yet. Open BatchFlow in current Chrome or your installed PWA.'
        )
      }

      detectorRef.current = new Detector({ formats: ['qr_code'] })
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      })

      if (!mountedRef.current) {
        stream.getTracks().forEach((track) => track.stop())
        return
      }

      streamRef.current = stream
      const track = stream.getVideoTracks()[0]
      const capabilities = track.getCapabilities?.() as MediaTrackCapabilities & {
        torch?: boolean
      }
      setTorchAvailable(Boolean(capabilities?.torch))

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }

      setState('scanning')
      scanTimerRef.current = window.setTimeout(scanFrame, 120)
    } catch (cameraError) {
      if (!mountedRef.current) return

      const message =
        cameraError instanceof DOMException &&
        (cameraError.name === 'NotAllowedError' ||
          cameraError.name === 'PermissionDeniedError')
          ? 'Camera access is blocked. Allow camera access for BatchFlow, then try again.'
          : cameraError instanceof Error
            ? cameraError.message
            : 'Could not start the camera.'

      setError(message)
      setState('error')
    }
  }, [scanFrame, stopTimer])

  useEffect(() => {
    mountedRef.current = true
    startCamera()

    return () => {
      mountedRef.current = false
      stopTimer()
      streamRef.current?.getTracks().forEach((track) => track.stop())
    }
  }, [startCamera, stopTimer])

  const toggleTorch = async () => {
    const track = streamRef.current?.getVideoTracks()[0]
    if (!track) return

    const nextTorchState = !torchOn

    try {
      await track.applyConstraints({
        advanced: [{ torch: nextTorchState } as MediaTrackConstraintSet],
      })
      setTorchOn(nextTorchState)
      haptic('light')
    } catch {
      setTorchAvailable(false)
      setError('Flash control is not available on this camera.')
    }
  }

  const scanAgain = () => {
    setResult(null)
    setError('')
    setState('scanning')
    scanLockedRef.current = false
    scanTimerRef.current = window.setTimeout(scanFrame, 120)
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
              Hold the QR code inside the frame
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
            <div className="relative h-[58%] w-[76%] rounded-3xl border border-white/30">
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
