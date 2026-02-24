'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Header from '@/app/components/Header'
import { LockClosedIcon, CheckCircleIcon, ArrowLeftIcon, CheckIcon } from '@heroicons/react/24/solid'
import { MinusCircleIcon } from '@heroicons/react/24/outline'

type Worker = {
  id: string
  name: string
}

type ProgressLog = {
  id: string
  quantity: number
  note: string | null
  createdAt: string
  worker: Worker
}

type BatchStep = {
  id: string
  name: string
  order: number
  type: 'CHECK' | 'COUNT'
  targetQuantity: number
  completedQuantity: number
  status: string
  progressLogs: ProgressLog[]
}

type Batch = {
  id: string
  name: string
  targetQuantity: number
  status: string
  recipe: {
    name: string
  }
  steps: BatchStep[]
}

type Session = {
  id: string
  name: string
  role: string
}

export default function BatchDetailClient({
  batch: initialBatch,
  session,
}: {
  batch: Batch
  session: Session
}) {
  const [batch, setBatch] = useState(initialBatch)
  const [selectedStep, setSelectedStep] = useState<BatchStep | null>(null)
  const [quantity, setQuantity] = useState('')
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showToast, setShowToast] = useState(false)
  const [toastMessage, setToastMessage] = useState('')
  const router = useRouter()
  const isOwner = session.role === 'OWNER'

  const handleLogClick = (step: BatchStep) => {
    setSelectedStep(step)
    setQuantity('')
    setNote('')
    setError('')
  }

  const handleQuickAdd = (amount: number) => {
    setQuantity((parseInt(quantity) || 0) + amount + '')
  }

  const handleCheckComplete = async (step: BatchStep) => {
    setLoading(true)
    try {
      const res = await fetch(
        `/api/batches/${batch.id}/steps/${step.id}/log`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ quantity: step.targetQuantity }),
        }
      )
      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Failed to complete step')
        return
      }
      // Optimistically update
      const updatedSteps = batch.steps.map((s) => {
        if (s.id === step.id) {
          return { ...s, completedQuantity: s.targetQuantity, status: 'COMPLETED' }
        }
        // Unlock next step
        if (s.order === step.order + 1 && s.status === 'LOCKED') {
          return { ...s, status: 'IN_PROGRESS' }
        }
        return s
      })
      setBatch({ ...batch, steps: updatedSteps })
      setToastMessage(`${step.name} complete`)
      setShowToast(true)
      setTimeout(() => setShowToast(false), 2000)
    } catch (err) {
      setError('Connection error')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async () => {
    if (!selectedStep || !quantity || parseInt(quantity) <= 0) {
      setError('Please enter a valid quantity')
      return
    }

    setLoading(true)
    setError('')

    try {
      const res = await fetch(
        `/api/batches/${batch.id}/steps/${selectedStep.id}/log`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            quantity: parseInt(quantity),
            note: note || undefined,
          }),
        }
      )

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Failed to log progress')
        return
      }

      // Optimistically update the batch state
      const updatedSteps = batch.steps.map((step) => {
        if (step.id === selectedStep.id) {
          const newCompleted = step.completedQuantity + parseInt(quantity)
          const newStatus =
            newCompleted >= step.targetQuantity
              ? 'COMPLETED'
              : step.status

          return {
            ...step,
            completedQuantity: newCompleted,
            status: newStatus,
          }
        }
        return step
      })

      // Check if next step should be unlocked
      const finalSteps = updatedSteps.map((step, idx) => {
        if (step.status === 'LOCKED' && idx > 0) {
          const prevStep = updatedSteps[idx - 1]
          if (prevStep.status === 'COMPLETED') {
            return { ...step, status: 'ACTIVE' }
          }
        }
        return step
      })

      setBatch({ ...batch, steps: finalSteps })

      // Show success toast
      setToastMessage(`Logged ${parseInt(quantity)} units`)
      setShowToast(true)
      setTimeout(() => setShowToast(false), 2000)

      setSelectedStep(null)
      setQuantity('')
      setNote('')
    } catch (err) {
      setError('Connection error')
    } finally {
      setLoading(false)
    }
  }

  const getPreviousStepCompleted = (currentOrder: number) => {
    if (currentOrder === 1) return batch.targetQuantity
    const prevStep = batch.steps.find((s) => s.order === currentOrder - 1)
    return prevStep?.completedQuantity || 0
  }

  return (
    <div className="min-h-screen bg-zinc-950">
      <Header session={session} />
      <div className="max-w-4xl mx-auto px-4 py-6 pb-safe">
        {/* Success Toast */}
        {showToast && (
          <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-50 animate-slide-down">
            <div className="bg-green-600 text-white px-6 py-3 rounded-xl shadow-lg font-semibold">
              {toastMessage}
            </div>
          </div>
        )}

        {/* Header */}
        <div className="mb-6">
          <Link
            href={isOwner ? '/dashboard' : '/batches'}
            className="inline-flex items-center text-zinc-400 hover:text-white mb-4 text-sm"
          >
            <ArrowLeftIcon className="w-4 h-4 inline mr-1" />Back to {isOwner ? 'Dashboard' : 'Batches'}
          </Link>
          <h1 className="text-3xl font-bold text-white mb-2">{batch.name}</h1>
          <div className="flex items-center gap-4 text-sm">
            <span className="text-zinc-400">{batch.recipe.name}</span>
            <span className="text-zinc-600">•</span>
            <span className="text-zinc-400">
              Target: {batch.targetQuantity}
            </span>
          </div>
        </div>

        {/* Waterfall Steps */}
        <div className="space-y-3">
          {batch.steps.map((step) => {
            const ceiling = getPreviousStepCompleted(step.order)
            const progress = (step.completedQuantity / step.targetQuantity) * 100
            const isLocked = step.status === 'LOCKED'
            const isCompleted = step.status === 'COMPLETED'
            const isInProgress = !isLocked && !isCompleted

            return (
              <div
                key={step.id}
                className={`bg-zinc-900 rounded-2xl p-6 border ${
                  isLocked
                    ? 'border-zinc-800 opacity-60'
                    : 'border-zinc-800 hover:border-zinc-700'
                } transition-colors`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3
                        className={`text-lg font-semibold ${
                          isLocked
                            ? 'text-zinc-500'
                            : isCompleted
                            ? 'text-green-400'
                            : 'text-blue-400'
                        }`}
                      >
                        {step.order}. {step.name}
                      </h3>
                      {isLocked && (
                        <LockClosedIcon className="w-5 h-5 text-zinc-500" />
                      )}
                      {isCompleted && (
                        <CheckCircleIcon className="w-5 h-5 text-green-400" />
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <span
                        className={`${
                          isLocked
                            ? 'text-zinc-500'
                            : isCompleted
                            ? 'text-green-400'
                            : 'text-blue-400'
                        }`}
                      >
                        {step.type === 'CHECK'
                          ? (isCompleted ? 'Done' : isLocked ? 'Locked' : 'Pending')
                          : `${Math.round(progress)}% · ${step.completedQuantity} / ${step.targetQuantity}`
                        }
                      </span>
                      {!isLocked && ceiling < step.targetQuantity && (
                        <>
                          <span className="text-zinc-600">•</span>
                          <span className="text-amber-500 text-xs">
                            Ceiling: {ceiling}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {!isLocked && !isCompleted && step.type === 'COUNT' && (
                    <button
                      onClick={() => handleLogClick(step)}
                      className="px-6 py-3 rounded-xl bg-green-600 hover:bg-green-500 active:bg-green-700 text-white font-semibold transition-colors min-h-[44px]"
                    >
                      + Log
                    </button>
                  )}
                  {!isLocked && !isCompleted && step.type === 'CHECK' && (
                    <button
                      onClick={() => handleCheckComplete(step)}
                      disabled={loading}
                      className="px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-semibold transition-colors min-h-[44px] disabled:opacity-50"
                    >
                      <CheckIcon className="w-5 h-5 inline mr-1" />Mark Done
                    </button>
                  )}
                </div>

                {/* Progress: Bar for COUNT, Checkbox for CHECK */}
                {step.type === 'CHECK' ? (
                  <div className="mb-4 flex items-center gap-2">
                    <div className={`w-6 h-6 rounded-md border-2 flex items-center justify-center ${
                      isCompleted ? 'bg-green-600 border-green-600' : isLocked ? 'border-zinc-700' : 'border-blue-500'
                    }`}>
                      {isCompleted && <CheckIcon className="w-4 h-4 text-white" />}
                    </div>
                    <span className={`text-sm ${isCompleted ? 'text-green-400' : isLocked ? 'text-zinc-600' : 'text-zinc-300'}`}>
                      {isCompleted ? 'Completed' : isLocked ? 'Locked' : 'Ready'}
                    </span>
                  </div>
                ) : (
                  <div className="mb-4">
                    <div className="h-3 bg-zinc-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 ${
                          isLocked
                            ? 'bg-zinc-700'
                            : isCompleted
                            ? 'bg-green-500'
                            : 'bg-blue-500'
                        }`}
                        style={{
                          width: `${Math.min(progress, 100)}%`,
                          transform: showToast && selectedStep?.id === step.id ? 'scaleY(1.1)' : 'scaleY(1)'
                        }}
                      />
                    </div>
                  </div>
                )}

                {/* Recent Logs */}
                {step.progressLogs.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs text-zinc-500 font-medium">
                      Recent logs:
                    </p>
                    {step.progressLogs.map((log) => (
                      <div
                        key={log.id}
                        className="flex items-center gap-2 text-sm"
                      >
                        <span className="text-zinc-400">
                          {log.worker.name}
                        </span>
                        <span className="text-zinc-600">•</span>
                        <span className="text-green-400">+{log.quantity}</span>
                        {log.note && (
                          <>
                            <span className="text-zinc-600">•</span>
                            <span className="text-zinc-500">{log.note}</span>
                          </>
                        )}
                        <span className="text-zinc-600 ml-auto text-xs">
                          {new Date(log.createdAt).toLocaleTimeString()}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Log Entry Modal */}
      {selectedStep && (
        <div className="fixed inset-0 bg-black/80 flex items-end sm:items-center justify-center p-4 z-50">
          <div className="bg-zinc-900 rounded-t-3xl sm:rounded-3xl w-full max-w-lg border border-zinc-800 animate-slide-up">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-white">
                  Log Progress
                </h2>
                <button
                  onClick={() => setSelectedStep(null)}
                  className="text-zinc-400 hover:text-white text-2xl"
                >
                  ×
                </button>
              </div>

              <div className="mb-6">
                <p className="text-zinc-400 text-lg mb-1">
                  {selectedStep.name}
                </p>
                <p className="text-sm text-zinc-500">
                  Current: {selectedStep.completedQuantity} /{' '}
                  {selectedStep.targetQuantity}
                </p>
              </div>

              {/* Quantity Input */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-zinc-400 mb-2">
                  Quantity
                </label>
                <input
                  type="number"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  placeholder="0"
                  className="w-full px-4 py-4 rounded-xl bg-zinc-800 border border-zinc-700 text-white text-2xl font-semibold focus:outline-none focus:ring-2 focus:ring-green-500"
                  disabled={loading}
                />
              </div>

              {/* Quick Add Buttons */}
              <div className="grid grid-cols-3 gap-3 mb-6">
                {[50, 100, 250].map((amount) => (
                  <button
                    key={amount}
                    onClick={() => handleQuickAdd(amount)}
                    disabled={loading}
                    className="py-3 rounded-lg bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-600 text-white font-semibold border border-zinc-700 transition-colors disabled:opacity-50"
                  >
                    +{amount}
                  </button>
                ))}
              </div>

              {/* Note Input */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-zinc-400 mb-2">
                  Note (optional)
                </label>
                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Add a note..."
                  className="w-full px-4 py-3 rounded-xl bg-zinc-800 border border-zinc-700 text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                  disabled={loading}
                />
              </div>

              {error && (
                <p className="text-red-500 text-sm mb-4 text-center">
                  {error}
                </p>
              )}

              {/* Submit Button */}
              <button
                onClick={handleSubmit}
                disabled={loading || !quantity || parseInt(quantity) <= 0}
                className="w-full py-4 rounded-xl bg-green-600 hover:bg-green-500 active:bg-green-700 text-white font-bold text-lg transition-colors disabled:opacity-50 disabled:bg-zinc-800"
              >
                {loading ? 'Saving...' : 'Submit'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
