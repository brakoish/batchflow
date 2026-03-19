'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import AppShell from '@/app/components/AppShell'
import {
  LockClosedIcon,
  CheckCircleIcon,
  CheckIcon,
  PlusIcon,
  XMarkIcon,
  ChatBubbleLeftRightIcon,
} from '@heroicons/react/24/solid'
import { haptic } from '@/lib/haptic'
import { Session } from 'next-auth'

type Worker = { id: string; name: string }
type ProgressLog = {
  id: string; quantity: number; note: string | null; createdAt: string; editedAt?: string; worker: Worker
}
type StepMaterial = { name: string; quantityPerUnit: number; unit: string }
type BatchStep = {
  id: string; name: string; order: number; type: 'CHECK' | 'COUNT'
  unitLabel: string; unitRatio: number
  targetQuantity: number; completedQuantity: number; status: string
  recipeStep?: { notes: string | null; materials?: StepMaterial[] }
  progressLogs: ProgressLog[]
}
type Batch = {
  id: string; name: string; targetQuantity: number; baseUnit: string; status: string
  dueDate?: string
  metrcBatchId?: string
  lotNumber?: string
  strain?: string
  packageTag?: string
  recipe: { name: string }; steps: BatchStep[]
  assignments?: { worker: Worker }[]
}
type BatchMessage = {
  id: string
  message: string
  createdAt: string
  worker: Worker
}

// Smart increment buttons that adapt to remaining quantity
function QuickAddButtons({ remaining, current, onAdd }: { remaining: number; current: number; onAdd: (val: number) => void }) {
  // Don't show buttons if nothing remaining
  if (remaining <= 0) return null

  // Calculate smart increments based on remaining quantity
  const increments = (() => {
    // Small batch: <= 50
    if (remaining <= 50) {
      if (remaining <= 10) return [remaining]
      if (remaining <= 25) return [10, remaining]
      return [10, 25, remaining]
    }
    // Medium batch: 51-200
    if (remaining <= 200) {
      if (remaining <= 100) return [25, 50, remaining]
      return [50, 100, remaining]
    }
    // Large batch: 201-500
    if (remaining <= 500) {
      return [50, 100, 250].filter(n => n < remaining).concat([remaining])
    }
    // Very large batch: > 500
    return [100, 250, 500].filter(n => n < remaining).concat([remaining])
  })()

  // Remove duplicates, sort, and take last 3 (biggest increments + Rest)
  const unique = Array.from(new Set(increments)).sort((a, b) => a - b).slice(-3)

  return (
    <div className="grid grid-cols-3 gap-2 mt-3">
      {unique.map((amt) => (
        <button
          key={amt}
          onClick={() => { haptic('light'); onAdd(current + amt); }}
          className={`py-2.5 rounded-lg border text-sm font-medium active:scale-[0.96] transition-all duration-150 ${
            amt === remaining
              ? 'bg-emerald-600/20 border-emerald-500/50 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-600/30'
              : 'bg-muted hover:bg-muted/80 border-input text-foreground/80'
          }`}
        >
          {amt === remaining ? 'Rest' : `+${amt}`}
        </button>
      ))}
    </div>
  )
}

export default function BatchDetailClient({
  batch: initialBatch, session,
}: {
  batch: Batch; session: Session
}) {
  const [batch, setBatch] = useState(initialBatch)
  const [selectedStep, setSelectedStep] = useState<BatchStep | null>(null)
  const [quantity, setQuantity] = useState('')
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')
  const [toastType, setToastType] = useState<'success' | 'warning'>('success')
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set())
  const [pageLoading, setPageLoading] = useState(!initialBatch.id)
  const quantityRef = useRef<HTMLInputElement>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Chat state
  const [messages, setMessages] = useState<BatchMessage[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [sendingMessage, setSendingMessage] = useState(false)
  const chatContainerRef = useRef<HTMLDivElement>(null)

  // Edit log modal state
  const [editingLog, setEditingLog] = useState<ProgressLog | null>(null)
  const [editQuantity, setEditQuantity] = useState('')
  const [editNote, setEditNote] = useState('')
  
  // Edit modal state
  const [showEditModal, setShowEditModal] = useState(false)
  const [editName, setEditName] = useState(batch.name)
  const [editTargetQty, setEditTargetQty] = useState(batch.targetQuantity.toString())
  const [editDueDate, setEditDueDate] = useState(batch.dueDate?.split('T')[0] || '')
  const [editMetrcBatchId, setEditMetrcBatchId] = useState(batch.metrcBatchId || '')
  const [editLotNumber, setEditLotNumber] = useState(batch.lotNumber || '')
  const [editStrain, setEditStrain] = useState(batch.strain || '')
  const [editPackageTag, setEditPackageTag] = useState(batch.packageTag || '')
  const [editWorkerIds, setEditWorkerIds] = useState<string[]>(batch.assignments?.map(a => a.worker.id) || [])

  // Auto-refresh every 5 seconds
  useEffect(() => {
    const fetchBatch = async () => {
      try {
        const res = await fetch(`/api/batches/${batch.id}`)
        if (res.ok) {
          const data = await res.json()
          if (data.batch) {
            setBatch(data.batch)
            setPageLoading(false)
          }
        }
      } catch {}
    }

    const fetchMessages = async () => {
      try {
        const res = await fetch(`/api/batches/${batch.id}/chat`)
        if (res.ok) {
          const data = await res.json()
          if (data.messages) setMessages(data.messages)
        }
      } catch {}
    }

    // Initial fetch
    fetchMessages()

    // Poll both batch and messages
    pollRef.current = setInterval(() => {
      fetchBatch()
      fetchMessages()
    }, 5000)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [batch.id])
  const router = useRouter()

  useEffect(() => {
    if (selectedStep && quantityRef.current) {
      quantityRef.current.focus()
    }
  }, [selectedStep])

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight
    }
  }, [messages])

  const showToast = (msg: string, type: 'success' | 'warning' = 'success') => {
    setToast(msg)
    setToastType(type)
    setTimeout(() => setToast(''), 3000)
  }

  const handleStatusChange = async (status: string) => {
    const labels: Record<string, string> = { COMPLETED: 'complete', CANCELLED: 'cancel', ACTIVE: 'reopen' }
    if (!confirm(`Are you sure you want to ${labels[status] || status} this batch?`)) return
    setError('')
    try {
      const res = await fetch(`/api/batches/${batch.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (!res.ok) { 
        const data = await res.json().catch(() => ({ error: 'Server error' }))
        setError(data.error || 'Failed to update batch')
        return 
      }
      setBatch(prev => ({ ...prev, status }))
      showToast(`Batch ${labels[status]}d`)
    } catch (err) { 
      setError('Network error. Please check your connection.')
    }
  }

  const handleDeleteBatch = async () => {
    if (!confirm('Permanently delete this cancelled batch? This cannot be undone.')) return
    setError('')
    try {
      const res = await fetch(`/api/batches/${batch.id}`, { method: 'DELETE' })
      if (!res.ok) { 
        const data = await res.json().catch(() => ({ error: 'Server error' }))
        setError(data.error || 'Failed to delete batch')
        return 
      }
      showToast('Batch deleted')
      router.push('/dashboard')
    } catch (err) { 
      setError('Network error. Please check your connection.')
    }
  }

  const handleEditLog = (log: ProgressLog, stepId: string) => {
    setEditingLog({ ...log, stepId } as any)
    setEditQuantity(log.quantity.toString())
    setEditNote(log.note || '')
    setError('')
  }

  const handleSaveEdit = async () => {
    if (!editingLog || !editQuantity || parseInt(editQuantity) <= 0) {
      setError('Enter a valid quantity')
      return
    }
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/logs/${editingLog.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quantity: parseInt(editQuantity),
          note: editNote || null,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Server error' }))
        setError(data.error || 'Failed to update log')
        return
      }
      const data = await res.json()
      // Update batch with new data
      setBatch(prev => ({
        ...prev,
        steps: prev.steps.map(s => {
          if (s.id === data.step.id) {
            return {
              ...s,
              completedQuantity: data.step.completedQuantity,
              status: data.step.status,
              progressLogs: s.progressLogs.map(l =>
                l.id === editingLog.id
                  ? { ...l, quantity: data.log.quantity, note: data.log.note, editedAt: data.log.editedAt }
                  : l
              ),
            }
          }
          return s
        }),
      }))
      setEditingLog(null)
      showToast('Log updated')
    } catch (err) {
      setError('Network error. Please check your connection.')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteLog = async (logId: string, stepId: string, qty: number) => {
    if (!confirm(`Delete this log entry (+${qty})?`)) return
    setError('')
    setLoading(true)
    try {
      const res = await fetch(`/api/logs/${logId}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Server error' }))
        setError(data.error || 'Failed to delete log')
        return
      }
      // Optimistically update
      setBatch(prev => ({
        ...prev,
        steps: prev.steps.map(s => {
          if (s.id === stepId) {
            return {
              ...s,
              completedQuantity: Math.max(0, s.completedQuantity - qty),
              progressLogs: s.progressLogs.filter(l => l.id !== logId),
            }
          }
          return s
        }),
      }))
      setEditingLog(null)
      showToast('Log entry deleted')
    } catch (err) {
      setError('Network error. Please check your connection.')
    } finally {
      setLoading(false)
    }
  }

  const handleCheckComplete = async (step: BatchStep) => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/batches/${batch.id}/steps/${step.id}/log`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantity: step.targetQuantity }),
      })
      if (!res.ok) { 
        const data = await res.json().catch(() => ({ error: 'Server error' }))
        setError(data.error || 'Failed to complete step')
        return 
      }

      setBatch(prev => ({
        ...prev,
        steps: prev.steps.map((s) => {
          if (s.id === step.id) return { ...s, completedQuantity: s.targetQuantity, status: 'COMPLETED' }
          if (s.order === step.order + 1 && s.status === 'LOCKED') return { ...s, status: 'IN_PROGRESS' }
          return s
        }),
      }))
      showToast(`${step.name} complete`)
    } catch (err) { 
      setError('Network error. Please check your connection.')
    }
    finally { setLoading(false) }
  }

  const handleEditSave = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/batches/${batch.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editName,
          targetQuantity: parseInt(editTargetQty),
          dueDate: editDueDate || undefined,
          workerIds: editWorkerIds,
          metrcBatchId: editMetrcBatchId || undefined,
          lotNumber: editLotNumber || undefined,
          strain: editStrain || undefined,
          packageTag: editPackageTag || undefined,
        }),
      })
      if (!res.ok) { 
        const data = await res.json().catch(() => ({ error: 'Server error' }))
        setError(data.error || 'Failed to save changes')
        return 
      }
      const data = await res.json()
      setBatch(data.batch)
      setShowEditModal(false)
      showToast('Batch updated')
    } catch (err) { 
      setError('Network error. Please check your connection.')
    }
    finally { setLoading(false) }
  }

  const handleSubmit = async () => {
    if (!selectedStep || !quantity || parseInt(quantity) <= 0) {
      setError('Enter a valid quantity'); return
    }
    haptic('medium')
    setLoading(true); setError('')

    try {
      const res = await fetch(`/api/batches/${batch.id}/steps/${selectedStep.id}/log`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantity: parseInt(quantity), note: note || undefined }),
      })
      if (!res.ok) { setError((await res.json()).error); return }

      const data = await res.json()
      const qty = parseInt(quantity)
      setBatch(prev => ({
        ...prev,
        steps: prev.steps.map((s) => {
          if (s.id === selectedStep.id) {
            const newQty = s.completedQuantity + qty
            return { ...s, completedQuantity: newQty, status: newQty >= s.targetQuantity ? 'COMPLETED' : s.status }
          }
          if (s.order === selectedStep.order + 1 && s.status === 'LOCKED') return { ...s, status: 'IN_PROGRESS' }
          return s
        }),
      }))

      if (data.warning) {
        showToast(data.warning, 'warning')
      } else {
        showToast(`Logged ${qty} units`)
      }
      setSelectedStep(null); setQuantity(''); setNote('')
    } catch (err) {
      setError('Network error. Please check your connection.')
    }
    finally { setLoading(false) }
  }

  const getPrevCompleted = (order: number) => {
    if (order === 1) return batch.targetQuantity
    return batch.steps.find((s) => s.order === order - 1)?.completedQuantity || 0
  }

  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault()
    const trimmed = newMessage.trim()
    if (!trimmed || sendingMessage) return

    setSendingMessage(true)
    setError('')

    // Optimistic update
    const optimisticMessage: BatchMessage = {
      id: `temp-${Date.now()}`,
      message: trimmed,
      createdAt: new Date().toISOString(),
      worker: { id: session.user.workerId || session.user.id, name: session.user.name || '' },
    }
    setMessages(prev => [...prev, optimisticMessage])
    setNewMessage('')

    try {
      const res = await fetch(`/api/batches/${batch.id}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: trimmed }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Server error' }))
        setError(data.error || 'Failed to send message')
        // Remove optimistic message on error
        setMessages(prev => prev.filter(m => m.id !== optimisticMessage.id))
        setNewMessage(trimmed)
        return
      }

      const data = await res.json()
      // Replace optimistic message with real one
      setMessages(prev => prev.map(m => m.id === optimisticMessage.id ? data.message : m))
    } catch (err) {
      setError('Network error. Please check your connection.')
      setMessages(prev => prev.filter(m => m.id !== optimisticMessage.id))
      setNewMessage(trimmed)
    } finally {
      setSendingMessage(false)
    }
  }

  const overallPct = Math.round(
    (batch.steps.filter(s => s.status === 'COMPLETED').length / batch.steps.length) * 100
  )

  const formatRelativeTime = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)

    if (diffMins < 1) return 'just now'
    if (diffMins < 60) return `${diffMins}m ago`
    const diffHours = Math.floor(diffMins / 60)
    if (diffHours < 24) return `${diffHours}h ago`
    const diffDays = Math.floor(diffHours / 24)
    return `${diffDays}d ago`
  }

  const formatLogTimestamp = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const isToday = date.toDateString() === now.toDateString()

    const timeStr = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })

    if (isToday) {
      return timeStr
    } else {
      const monthDay = date.toLocaleDateString([], { month: 'short', day: 'numeric' })
      return `${monthDay} · ${timeStr}`
    }
  }

  return (
    <AppShell session={session}>


      {/* Toast */}
      {toast && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 animate-fade-in">
          <div className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-white text-sm font-medium shadow-lg ${
            toastType === 'warning' ? 'bg-yellow-500' : 'bg-emerald-500'
          }`}>
            <CheckCircleIcon className="w-4 h-4" />
            {toast}
          </div>
        </div>
      )}

      <main className="max-w-2xl mx-auto px-4 py-5">
        {pageLoading ? (
          <>
            {/* Skeleton header */}
            <div className="mb-5 space-y-2">
              <div className="h-6 w-48 bg-muted animate-pulse rounded" />
              <div className="h-4 w-64 bg-muted animate-pulse rounded" />
            </div>
            {/* Skeleton steps */}
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-24 rounded-xl bg-muted animate-pulse" />
              ))}
            </div>
          </>
        ) : (
          <>
        {/* Batch header */}
        <div className="mb-5">
          <h1 className="text-lg font-semibold tracking-tight text-foreground">{batch.name}</h1>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className="text-xs text-foreground">{batch.recipe.name}</span>
            <span className="text-muted-foreground/30">·</span>
            <span className="text-xs text-foreground">{batch.targetQuantity} {batch.baseUnit}</span>
            {batch.dueDate && (() => {
              const dueDate = new Date(batch.dueDate.split('T')[0] + 'T00:00:00')
              const today = new Date(); today.setHours(0, 0, 0, 0)
              const isOverdue = batch.status === 'ACTIVE' && dueDate < today
              return (
                <>
                  <span className="text-muted-foreground/30">·</span>
                  <span className={`text-xs font-medium ${isOverdue ? 'text-red-500 dark:text-red-400' : 'text-foreground'}`}>
                    {isOverdue ? '⚠️ OVERDUE' : `Due: ${new Date(batch.dueDate).toLocaleDateString()}`}
                  </span>
                </>
              )
            })()}
            <span className="text-muted-foreground/30">·</span>
            <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">{overallPct}%</span>
            {batch.status !== 'ACTIVE' && (
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${
                batch.status === 'COMPLETED' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' : 'bg-red-500/10 text-red-500 dark:text-red-400 border-red-500/20'
              }`}>
                {batch.status}
              </span>
            )}
          </div>
          
          {/* Team */}
          {batch.assignments && batch.assignments.length > 0 && (
            <div className="flex items-center gap-2 mt-2">
              <span className="text-[10px] text-muted-foreground font-medium">Team:</span>
              <div className="flex items-center -space-x-1">
                {batch.assignments.map((a, i) => (
                  <div
                    key={a.worker.id}
                    className="w-6 h-6 rounded-full bg-muted border-2 border-card flex items-center justify-center"
                    title={a.worker.name}
                  >
                    <span className="text-[9px] font-semibold text-foreground">{a.worker.name.charAt(0)}</span>
                  </div>
                ))}
              </div>
              <span className="text-[10px] text-muted-foreground">
                {batch.assignments.map(a => a.worker.name).join(', ')}
              </span>
            </div>
          )}

          {/* METRC Fields Display */}
          {(batch.metrcBatchId || batch.lotNumber || batch.strain || batch.packageTag) && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {batch.metrcBatchId && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">METRC: {batch.metrcBatchId}</span>
              )}
              {batch.lotNumber && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">Lot: {batch.lotNumber}</span>
              )}
              {batch.strain && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{batch.strain}</span>
              )}
              {batch.packageTag && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">Tag: {batch.packageTag}</span>
              )}
            </div>
          )}

          {/* Owner batch controls */}
          {session.user.role === 'OWNER' && batch.status === 'ACTIVE' && (
            <div className="flex items-center gap-2 mt-3">
              <button onClick={() => handleStatusChange('COMPLETED')}
                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 active:scale-[0.96] text-white text-xs font-medium transition-all">
                Mark Complete
              </button>
              <button onClick={() => setShowEditModal(true)}
                className="px-3 py-1.5 rounded-lg bg-muted hover:bg-muted/80 border border-input active:scale-[0.96] text-foreground/80 text-xs font-medium transition-all">
                Edit Batch
              </button>
              <button onClick={() => handleStatusChange('CANCELLED')}
                className="px-3 py-1.5 rounded-lg bg-muted hover:bg-muted/80 border border-input active:scale-[0.96] text-red-500 dark:text-red-400 text-xs font-medium transition-all">
                Cancel Batch
              </button>
            </div>
          )}
          {session.user.role === 'OWNER' && batch.status !== 'ACTIVE' && (
            <div className="flex items-center gap-2 mt-3">
              <button onClick={() => handleStatusChange('ACTIVE')}
                className="px-3 py-1.5 rounded-lg bg-muted hover:bg-muted/80 border border-input active:scale-[0.96] text-blue-600 dark:text-blue-400 text-xs font-medium transition-all">
                Reopen Batch
              </button>
              {batch.status === 'CANCELLED' && (
                <button onClick={handleDeleteBatch}
                  className="px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 active:scale-[0.96] text-red-500 dark:text-red-400 text-xs font-medium transition-all">
                  Delete Batch
                </button>
              )}
            </div>
          )}
        </div>

        {/* Steps */}
        <div className="space-y-2">
          {batch.steps.map((step) => {
            const isLocked = step.status === 'LOCKED'
            const isCompleted = step.status === 'COMPLETED'
            const pct = (step.completedQuantity / step.targetQuantity) * 100

            return (
              <div
                key={step.id}
                className={`rounded-xl border p-4 transition-all duration-150 ${
                  isLocked
                    ? 'border/50 bg-card/50 opacity-50'
                    : isCompleted
                    ? 'border-emerald-500/20 bg-emerald-500/5'
                    : 'border bg-card'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  {/* Left: status icon + name */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                      isCompleted
                        ? 'bg-emerald-500/15'
                        : isLocked
                        ? 'bg-muted'
                        : 'bg-blue-500/15'
                    }`}>
                      {isCompleted ? (
                        <CheckCircleIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      ) : isLocked ? (
                        <LockClosedIcon className="w-3.5 h-3.5 text-muted-foreground/70" />
                      ) : (
                        <span className="text-xs font-bold text-blue-600 dark:text-blue-400">{step.order}</span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className={`text-sm font-medium truncate ${
                        isCompleted ? 'text-emerald-600 dark:text-emerald-300' : isLocked ? 'text-muted-foreground/70' : 'text-foreground'
                      }`}>
                        {step.name}
                      </p>
                      {step.recipeStep?.notes && !isLocked && (
                        <p className="text-[10px] text-muted-foreground/70 mt-0.5">{step.recipeStep.notes}</p>
                      )}
                      {step.type === 'COUNT' && !isLocked && (
                        <p className="text-xs text-foreground tabular-nums mt-0.5">
                          {step.completedQuantity} / {step.targetQuantity} {step.unitLabel}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Right: action or status */}
                  {!isLocked && !isCompleted && step.type === 'COUNT' && (
                    <button
                      onClick={() => { haptic('light'); setSelectedStep(step); setQuantity(''); setNote(''); setError('') }}
                      className="flex items-center gap-1.5 px-4 py-3 min-h-[44px] rounded-lg bg-emerald-600 hover:bg-emerald-500 active:scale-[0.96] text-white text-sm font-semibold transition-all duration-150 shrink-0"
                    >
                      <PlusIcon className="w-4 h-4" />Log
                    </button>
                  )}
                  {!isLocked && !isCompleted && step.type === 'CHECK' && (
                    <button
                      onClick={() => { haptic('light'); handleCheckComplete(step); }}
                      disabled={loading}
                      className="flex items-center gap-1.5 px-4 py-3 min-h-[44px] rounded-lg bg-blue-600 hover:bg-blue-500 active:scale-[0.96] text-white text-sm font-semibold transition-all duration-150 shrink-0 disabled:opacity-50"
                    >
                      <CheckIcon className="w-4 h-4" />Done
                    </button>
                  )}
                </div>

                {/* Progress bar for COUNT steps */}
                {step.type === 'COUNT' && !isLocked && (
                  <div className="mt-3">
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ease-out ${
                          isCompleted ? 'bg-emerald-500' : 'bg-blue-500'
                        }`}
                        style={{ width: `${Math.min(pct, 100)}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Materials needed for this step */}
                {step.recipeStep?.materials && step.recipeStep.materials.length > 0 && !isLocked && (
                  <div className="mt-3 pt-3 border-t border-border/50">
                    <span className="text-xs text-muted-foreground font-medium">Materials Needed</span>
                    <div className="mt-2 space-y-1.5">
                      {step.recipeStep.materials.map((mat, idx) => {
                        const total = (mat.quantityPerUnit * step.targetQuantity).toLocaleString()
                        return (
                          <div key={idx} className="text-sm text-muted-foreground">
                            <span className="text-foreground">{mat.name}</span>
                            <span className="text-muted-foreground/60"> · {total} {mat.unit}</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Logs */}
                {step.progressLogs && step.progressLogs.length > 0 && !isLocked && (
                  <div className="mt-3">
                    {(() => {
                      const isExpanded = expandedSteps.has(step.id)
                      const logs = isExpanded ? step.progressLogs : step.progressLogs.slice(0, 3)
                      const hasMore = step.progressLogs.length > 3
                      return (
                        <>
                          <div className="space-y-1 overflow-hidden transition-all duration-300">
                          {logs.map((log) => {
                            const canEdit = session.user.role === 'OWNER' || session.user.workerId === log.worker.id
                            return (
                              <div key={log.id} className="flex items-center justify-between text-[10px] text-foreground">
                                <button
                                  onClick={() => canEdit && handleEditLog(log, step.id)}
                                  disabled={!canEdit}
                                  className={`flex items-center gap-1.5 text-left ${canEdit ? 'hover:bg-muted/30 active:scale-[0.98] rounded px-1 -mx-1 py-0.5 transition-all' : ''}`}
                                >
                                  <span className="text-muted-foreground font-medium">{log.worker.name}</span>
                                  <span className="text-emerald-600 dark:text-emerald-400 tabular-nums">+{log.quantity}</span>
                                  {log.note && <span className="text-muted-foreground/70 truncate max-w-[120px]">{log.note}</span>}
                                  <span className="text-muted-foreground/30">{formatLogTimestamp(log.createdAt)}</span>
                                  {log.editedAt && <span className="text-muted-foreground/50 italic">(edited)</span>}
                                </button>
                              </div>
                            )
                          })}
                          </div>
                          {hasMore && (
                            <button
                              onClick={() => {
                                haptic('light')
                                setExpandedSteps(prev => {
                                  const next = new Set(prev)
                                  if (next.has(step.id)) next.delete(step.id)
                                  else next.add(step.id)
                                  return next
                                })
                              }}
                              className="text-[10px] text-blue-600 dark:text-blue-400 font-medium hover:text-blue-500 active:scale-[0.98] py-1 transition-all"
                            >
                              {isExpanded ? 'Show less' : `Show all ${step.progressLogs.length} entries`}
                            </button>
                          )}
                        </>
                      )
                    })()}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Chat Section */}
        <div className="mt-8 pt-8 border-t border-border/50">
          <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <ChatBubbleLeftRightIcon className="w-5 h-5 text-muted-foreground" />
            Team Chat
          </h2>

          <div className="rounded-xl border bg-card p-4">
            {/* Message list */}
            <div
              ref={chatContainerRef}
              className="space-y-3 max-h-[300px] overflow-y-auto mb-4"
            >
              {messages.length === 0 ? (
                <p className="text-xs text-muted-foreground/70 text-center py-4">No messages yet</p>
              ) : (
                messages.map((msg) => {
                  const isCurrentUser = msg.worker.id === (session.user.workerId || session.user.id)
                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${isCurrentUser ? 'items-end' : 'items-start'}`}
                    >
                      <span className="text-[10px] text-muted-foreground font-medium mb-1 px-1">
                        {msg.worker.name}
                      </span>
                      <div
                        className={`px-3 py-2 rounded-lg max-w-[85%] ${
                          isCurrentUser
                            ? 'bg-emerald-600/10 border border-emerald-500/20'
                            : 'bg-muted/50 border border-border/50'
                        }`}
                      >
                        <p className="text-sm text-foreground break-words">{msg.message}</p>
                        <span className="text-[10px] text-muted-foreground/50 mt-1 block">
                          {formatRelativeTime(msg.createdAt)}
                        </span>
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            {/* Input area */}
            <form onSubmit={handleSendMessage} className="flex items-center gap-2">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleSendMessage()
                  }
                }}
                placeholder="Message the team..."
                disabled={sendingMessage}
                maxLength={500}
                className="flex-1 px-3.5 py-2.5 min-h-[44px] rounded-lg bg-muted/50 border border-input text-foreground text-sm placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={!newMessage.trim() || sendingMessage}
                className={`w-11 h-11 min-w-[44px] min-h-[44px] rounded-full flex items-center justify-center transition-all duration-150 active:scale-[0.96] ${
                  newMessage.trim() && !sendingMessage
                    ? 'bg-emerald-600 hover:bg-emerald-500'
                    : 'bg-muted cursor-not-allowed'
                }`}
              >
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 10.5L12 3m0 0l7.5 7.5M12 3v18" />
                </svg>
              </button>
            </form>
          </div>
        </div>
          </>
        )}
      </main>

      {/* Log Modal */}
      {selectedStep && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center">
          <div
            className="w-full max-w-md bg-card border border rounded-t-2xl sm:rounded-2xl safe-bottom"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5">
              {/* Header */}
              <div className="flex items-center justify-between mb-5">
                <div>
                  <p className="text-sm font-semibold text-foreground">{selectedStep.name}</p>
                  <p className="text-xs text-foreground tabular-nums mt-0.5">
                    {selectedStep.completedQuantity} / {selectedStep.targetQuantity} {selectedStep.unitLabel}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedStep(null)}
                  className="p-1.5 rounded-lg text-foreground hover:text-foreground/80 hover:bg-muted transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Quantity */}
              <input
                ref={quantityRef}
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="Quantity"
                className="w-full px-4 py-3.5 rounded-xl bg-muted/50 border border-input text-foreground text-xl font-semibold tabular-nums placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all"
              />

              {/* Quick add - smart increments based on remaining quantity */}
              <QuickAddButtons
                remaining={selectedStep.targetQuantity - selectedStep.completedQuantity}
                current={parseInt(quantity) || 0}
                onAdd={(val) => setQuantity(String(val))}
              />

              {/* Note */}
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Note (optional)"
                className="w-full mt-3 px-3.5 py-2.5 rounded-xl bg-muted/50 border border-input text-foreground text-sm placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all"
              />

              {error && <p className="text-red-500 dark:text-red-400 text-xs mt-3 text-center">{error}</p>}

              {/* Submit */}
              <button
                onClick={handleSubmit}
                disabled={loading || !quantity || parseInt(quantity) <= 0}
                className="w-full mt-4 py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] text-white font-semibold text-sm transition-all duration-150 disabled:opacity-40 disabled:bg-muted"
              >
                {loading ? 'Saving...' : 'Submit'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Log Modal */}
      {editingLog && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center">
          <div
            className="w-full max-w-md bg-card border border rounded-t-2xl sm:rounded-2xl safe-bottom"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5">
              {/* Header */}
              <div className="flex items-center justify-between mb-5">
                <p className="text-sm font-semibold text-foreground">Edit Log Entry</p>
                <button
                  onClick={() => { setEditingLog(null); setError('') }}
                  className="p-1.5 rounded-lg text-foreground hover:text-foreground/80 hover:bg-muted transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Form */}
              <div className="space-y-3">
                <div>
                  <label className="text-[10px] text-foreground font-semibold uppercase tracking-wider block mb-1">Quantity</label>
                  <input
                    type="number"
                    value={editQuantity}
                    onChange={(e) => setEditQuantity(e.target.value)}
                    className="w-full px-4 py-3.5 rounded-xl bg-muted/50 border border-input text-foreground text-xl font-semibold tabular-nums placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all"
                  />
                </div>

                <div>
                  <label className="text-[10px] text-foreground font-semibold uppercase tracking-wider block mb-1">Note (optional)</label>
                  <input
                    type="text"
                    value={editNote}
                    onChange={(e) => setEditNote(e.target.value)}
                    placeholder="Note (optional)"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-muted/50 border border-input text-foreground text-sm placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all"
                  />
                </div>

                {error && <p className="text-red-500 dark:text-red-400 text-xs text-center">{error}</p>}

                <button
                  onClick={handleSaveEdit}
                  disabled={loading || !editQuantity || parseInt(editQuantity) <= 0}
                  className="w-full py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] text-white font-semibold text-sm transition-all duration-150 disabled:opacity-40"
                >
                  {loading ? 'Saving...' : 'Save Changes'}
                </button>

                <button
                  onClick={() => handleDeleteLog(editingLog.id, (editingLog as any).stepId, editingLog.quantity)}
                  disabled={loading}
                  className="w-full py-3 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 active:scale-[0.98] text-red-500 dark:text-red-400 font-semibold text-sm transition-all duration-150 disabled:opacity-40"
                >
                  Delete Entry
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Batch Modal */}
      {showEditModal && session.user.role === 'OWNER' && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center">
          <div
            className="w-full max-w-md bg-card border border rounded-t-2xl sm:rounded-2xl safe-bottom max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5">
              {/* Header */}
              <div className="flex items-center justify-between mb-5">
                <p className="text-sm font-semibold text-foreground">Edit Batch</p>
                <button
                  onClick={() => setShowEditModal(false)}
                  className="p-1.5 rounded-lg text-foreground hover:text-foreground/80 hover:bg-muted transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Form */}
              <div className="space-y-3">
                <div>
                  <label className="text-[10px] text-foreground font-semibold uppercase tracking-wider block mb-1">Batch Name</label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-muted border border-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all"
                  />
                </div>

                <div>
                  <label className="text-[10px] text-foreground font-semibold uppercase tracking-wider block mb-1">Target Quantity</label>
                  <input
                    type="number"
                    value={editTargetQty}
                    onChange={(e) => setEditTargetQty(e.target.value)}
                    min="1"
                    className="w-full px-3 py-2 rounded-lg bg-muted border border-input text-foreground text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all"
                  />
                </div>

                <div>
                  <label className="text-[10px] text-foreground font-semibold uppercase tracking-wider block mb-1">Due Date</label>
                  <input
                    type="date"
                    value={editDueDate}
                    onChange={(e) => setEditDueDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-muted border border-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all"
                  />
                </div>

                {/* METRC Fields */}
                <div className="rounded-lg bg-muted/50 border border-input p-3 space-y-2">
                  <p className="text-[10px] text-foreground font-semibold uppercase tracking-wider">METRC Fields</p>
                  <input
                    type="text"
                    value={editMetrcBatchId}
                    onChange={(e) => setEditMetrcBatchId(e.target.value)}
                    placeholder="METRC Batch ID"
                    className="w-full px-3 py-2 rounded-md bg-card border border-input text-foreground text-xs placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all"
                  />
                  <input
                    type="text"
                    value={editLotNumber}
                    onChange={(e) => setEditLotNumber(e.target.value)}
                    placeholder="Lot Number"
                    className="w-full px-3 py-2 rounded-md bg-card border border-input text-foreground text-xs placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all"
                  />
                  <input
                    type="text"
                    value={editStrain}
                    onChange={(e) => setEditStrain(e.target.value)}
                    placeholder="Strain"
                    className="w-full px-3 py-2 rounded-md bg-card border border-input text-foreground text-xs placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all"
                  />
                  <input
                    type="text"
                    value={editPackageTag}
                    onChange={(e) => setEditPackageTag(e.target.value)}
                    placeholder="Package Tag"
                    className="w-full px-3 py-2 rounded-md bg-card border border-input text-foreground text-xs placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all"
                  />
                </div>

                {error && <p className="text-red-500 dark:text-red-400 text-xs text-center">{error}</p>}

                <button
                  onClick={handleEditSave}
                  disabled={loading || !editName.trim() || !editTargetQty}
                  className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] text-white font-semibold text-sm transition-all duration-150 disabled:opacity-40"
                >
                  {loading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  )
}
