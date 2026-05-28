'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import AppShell from '@/app/components/AppShell'
import EditBatchModal from '@/app/components/EditBatchModal'
import ConfirmModal from '@/app/components/ConfirmModal'
import {
  CheckCircleIcon,
  CheckIcon,
  PlusIcon,
  XMarkIcon,
  ChatBubbleLeftRightIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  DocumentDuplicateIcon,
  EyeSlashIcon,
  FlagIcon,
  PencilSquareIcon,
} from '@heroicons/react/24/solid'
import { haptic } from '@/lib/haptic'
import { formatTimeInTz, formatDateInTz } from '@/lib/timezone'
import { emitBatchChanged, onBatchChanged } from '@/lib/batchEvents'
import type { Session } from '@/lib/session'
import {
  formatShortRelativeTime,
  getActiveStations,
  getLastBatchMovement,
  getStationStates,
} from '@/lib/productionLine'

type Worker = { id: string; name: string }
type ProgressLog = {
  id: string; quantity: number; note: string | null; createdAt: string; editedAt?: string; worker: Worker
}
type StepMaterial = { name: string; quantityPerUnit: number; unit: string }
type BatchStep = {
  id: string; recipeStepId: string; name: string; order: number; type: 'CHECK' | 'COUNT'
  unitLabel: string; unitRatio: number
  targetQuantity: number | null; completedQuantity: number; status: string
  recipeStep?: { notes: string | null; materials?: StepMaterial[] }
  progressLogs: ProgressLog[]
}
type Batch = {
  id: string; name: string; targetQuantity: number | null; baseUnit: string; status: string
  dueDate?: string
  metrcBatchId?: string
  lotNumber?: string
  strain?: string
  packageTag?: string
  notes?: string | null
  recipe: { id: string; name: string }; steps: BatchStep[]
  assignments?: { worker: Worker }[]
}
type BatchMessage = {
  id: string
  message: string
  createdAt: string
  worker: Worker
}
type ConfirmAction = {
  title: string
  message?: string
  confirmLabel: string
  confirmStyle?: 'danger' | 'primary'
  onConfirm: () => void
}
const SKIPPED_PREFIX = '[Skipped] '

function isSkippedStep(step: BatchStep) {
  return step.name.startsWith(SKIPPED_PREFIX)
}

function displayStepName(step: BatchStep) {
  return isSkippedStep(step) ? step.name.slice(SKIPPED_PREFIX.length) : step.name
}

function getSmartAmounts(remaining: number | null) {
  const defaults = [25, 50, 100]
  if (remaining === null) return defaults
  return defaults.filter(amount => amount <= remaining)
}

function PresetLogButtons({
  remaining,
  lastAmount,
  disabled,
  onPick,
}: {
  remaining: number | null
  lastAmount: number | null
  disabled?: boolean
  onPick: (amount: number) => void
}) {
  const amounts = getSmartAmounts(remaining)
  return (
    <div className="space-y-2">
      {lastAmount && lastAmount > 0 && (remaining === null || lastAmount <= remaining) && (
        <button
          type="button"
          onClick={() => onPick(lastAmount)}
          disabled={disabled}
          className="w-full min-h-[56px] rounded-xl bg-emerald-600 text-white text-base font-bold active:scale-[0.97] transition-all disabled:opacity-50"
        >
          Same as last: +{lastAmount.toLocaleString()}
        </button>
      )}
      <div className="grid grid-cols-2 gap-2">
        {amounts.map((amt) => (
          <button
            key={amt}
            type="button"
            onClick={() => onPick(amt)}
            disabled={disabled}
            className="min-h-[64px] rounded-xl border border-input bg-muted text-lg font-bold text-foreground active:scale-[0.97] transition-all disabled:opacity-50"
          >
            +{amt}
          </button>
        ))}
        {remaining !== null && remaining > 0 && (
          <button
            type="button"
            onClick={() => onPick(remaining)}
            disabled={disabled}
            className="min-h-[64px] rounded-xl border border-emerald-500/50 bg-emerald-600/20 text-lg font-bold text-emerald-600 dark:text-emerald-400 active:scale-[0.97] transition-all disabled:opacity-50"
          >
            Rest: {remaining.toLocaleString()}
          </button>
        )}
      </div>
    </div>
  )
}

export default function BatchDetailClient({
  batch: initialBatch, workers, session, orgTimezone,
}: {
  batch: Batch; workers: { id: string; name: string }[]; session: Session; orgTimezone: string
}) {
  const searchParams = useSearchParams()
  const [batch, setBatch] = useState(initialBatch)
  const [selectedStep, setSelectedStep] = useState<BatchStep | null>(null)
  const [quantity, setQuantity] = useState('')
  const [note, setNote] = useState('')
  const [showNoteInput, setShowNoteInput] = useState(false)
  const [lastLogAmounts, setLastLogAmounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')
  const [toastType, setToastType] = useState<'success' | 'warning'>('success')
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set())
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null)
  const [pageLoading, setPageLoading] = useState(!initialBatch.id)
  const quantityRef = useRef<HTMLInputElement>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const lastSaveTsRef = useRef<number>(0)
  const editModalOpenRef = useRef<boolean>(false)

  // Chat state
  const [messages, setMessages] = useState<BatchMessage[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [sendingMessage, setSendingMessage] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)
  const chatContainerRef = useRef<HTMLDivElement>(null)

  // Edit log modal state
  const [editingLog, setEditingLog] = useState<ProgressLog | null>(null)
  const [editQuantity, setEditQuantity] = useState('')
  const [editNote, setEditNote] = useState('')

  // Edit modal state
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingSteps, setEditingSteps] = useState(() => searchParams.get('editSteps') === '1')
  const [showAddStepModal, setShowAddStepModal] = useState(false)
  const [newStepName, setNewStepName] = useState('')
  const [newStepType, setNewStepType] = useState<'COUNT' | 'CHECK'>('COUNT')
  const [newStepTarget, setNewStepTarget] = useState('')
  const [newStepUnit, setNewStepUnit] = useState(batch.baseUnit || 'units')
  const [savingStep, setSavingStep] = useState(false)
  const [editingStep, setEditingStep] = useState<BatchStep | null>(null)
  const [editStepName, setEditStepName] = useState('')
  const [editStepType, setEditStepType] = useState<'COUNT' | 'CHECK'>('COUNT')
  const [editStepTarget, setEditStepTarget] = useState('')
  const [editStepUnit, setEditStepUnit] = useState('')

  // Duplicate modal state
  const [showDuplicateModal, setShowDuplicateModal] = useState(false)
  const [duplicateName, setDuplicateName] = useState('')
  const [duplicateIsOpenEnded, setDuplicateIsOpenEnded] = useState(batch.targetQuantity === null)
  const [duplicateTargetQty, setDuplicateTargetQty] = useState('')
  const [duplicatePriority, setDuplicatePriority] = useState<'LOW' | 'NORMAL' | 'HIGH' | 'URGENT'>((batch as any).priority || 'NORMAL')
  const [duplicateStrain, setDuplicateStrain] = useState('')
  const [duplicating, setDuplicating] = useState(false)

  // Auto-refresh — events do the heavy lifting for same-tab mutations,
  // polling is a 15s safety net for cross-tab/other-user changes.
  useEffect(() => {
    const fetchBatch = async (opts: { force?: boolean } = {}) => {
      // Skip when the edit modal is open or we just saved; avoids
      // stale-response clobber of local state.
      if (!opts.force) {
        if (editModalOpenRef.current) return
        if (Date.now() - lastSaveTsRef.current < 3000) return
      }
      try {
        const res = await fetch(`/api/batches/${batch.id}`, { cache: "no-store" })
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
        const res = await fetch(`/api/batches/${batch.id}/chat`, { cache: "no-store" })
        if (res.ok) {
          const data = await res.json()
          if (data.messages) setMessages(data.messages)
        }
      } catch {}
    }

    // Initial fetch
    fetchMessages()

    // Poll every 15s as a cross-tab safety net
    pollRef.current = setInterval(() => {
      fetchBatch()
      fetchMessages()
    }, 15000)

    // Event-driven refresh for same-tab mutations from anywhere
    const unsubscribe = onBatchChanged(({ batchId }) => {
      if (batchId && batchId !== batch.id) return
      fetchBatch({ force: true })
    })

    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
      unsubscribe()
    }
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

  // Keep a ref in sync so the poll guard can read it without re-subscribing
  useEffect(() => {
    editModalOpenRef.current = showEditModal
  }, [showEditModal])

  const showToast = (msg: string, type: 'success' | 'warning' = 'success') => {
    setToast(msg)
    setToastType(type)
    setTimeout(() => setToast(''), 3000)
  }

  const handleStatusChange = async (status: string) => {
    const labels: Record<string, string> = { COMPLETED: 'complete', CANCELLED: 'cancel', ACTIVE: 'reopen' }
    setConfirmAction({
      title: `${labels[status]?.charAt(0).toUpperCase()}${labels[status]?.slice(1) || status} batch?`,
      message: status === 'CANCELLED'
        ? 'This removes it from active production. You can reopen it later if needed.'
        : status === 'COMPLETED'
        ? 'This marks the production run complete for the team.'
        : 'This moves the batch back into active production.',
      confirmLabel: status === 'CANCELLED' ? 'Cancel Batch' : status === 'COMPLETED' ? 'Mark Complete' : 'Reopen',
      confirmStyle: status === 'CANCELLED' ? 'danger' : 'primary',
      onConfirm: () => performStatusChange(status),
    })
  }

  const performStatusChange = async (status: string) => {
    const labels: Record<string, string> = { COMPLETED: 'complete', CANCELLED: 'cancel', ACTIVE: 'reopen' }
    setConfirmAction(null)
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
      lastSaveTsRef.current = Date.now()
      emitBatchChanged(batch.id, 'status')
      showToast(`Batch ${labels[status]}d`)
    } catch (err) { 
      setError('Network error. Please check your connection.')
    }
  }

  const handleDeleteBatch = async () => {
    setConfirmAction({
      title: 'Delete cancelled batch?',
      message: 'This permanently deletes the batch and cannot be undone.',
      confirmLabel: 'Delete',
      confirmStyle: 'danger',
      onConfirm: performDeleteBatch,
    })
  }

  const performDeleteBatch = async () => {
    setConfirmAction(null)
    setError('')
    try {
      const res = await fetch(`/api/batches/${batch.id}`, { method: 'DELETE' })
      if (!res.ok) { 
        const data = await res.json().catch(() => ({ error: 'Server error' }))
        setError(data.error || 'Failed to delete batch')
        return 
      }
      emitBatchChanged(batch.id, 'delete')
      showToast('Batch deleted')
      router.push('/dashboard')
    } catch (err) { 
      setError('Network error. Please check your connection.')
    }
  }

  const handleOpenAddStep = () => {
    haptic('light')
    setNewStepName('')
    setNewStepType('COUNT')
    setNewStepTarget(batch.targetQuantity?.toString() || '')
    setNewStepUnit(batch.baseUnit || 'units')
    setShowAddStepModal(true)
    setError('')
  }

  const toggleStepEditing = () => {
    haptic('light')
    setEditingSteps(prev => !prev)
    setError('')
  }

  const handleAddStep = async () => {
    if (!newStepName.trim()) {
      setError('Step name is required')
      return
    }
    if (newStepType === 'COUNT' && newStepTarget && parseInt(newStepTarget) <= 0) {
      setError('Target must be greater than 0')
      return
    }

    setSavingStep(true)
    setError('')
    try {
      const res = await fetch(`/api/batches/${batch.id}/steps`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newStepName,
          type: newStepType,
          targetQuantity: newStepType === 'CHECK' ? 1 : newStepTarget || null,
          unitLabel: newStepUnit || batch.baseUnit || 'units',
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Server error' }))
        setError(data.error || 'Failed to add step')
        return
      }

      const data = await res.json()
      setBatch(prev => ({
        ...prev,
        steps: [...prev.steps, data.step].sort((a, b) => a.order - b.order),
      }))
      setShowAddStepModal(false)
      lastSaveTsRef.current = Date.now()
      emitBatchChanged(batch.id, 'step-add')
      showToast('Step added to this batch')
    } catch (err) {
      setError('Network error. Please check your connection.')
    } finally {
      setSavingStep(false)
    }
  }

  const handleOpenEditStep = (step: BatchStep) => {
    haptic('light')
    setEditingStep(step)
    setEditStepName(displayStepName(step))
    setEditStepType(step.type)
    setEditStepTarget(step.targetQuantity?.toString() || '')
    setEditStepUnit(step.unitLabel || batch.baseUnit || 'units')
    setError('')
  }

  const handleSaveStepEdit = async () => {
    if (!editingStep || !editStepName.trim()) {
      setError('Step name is required')
      return
    }
    if (editStepType === 'COUNT' && editStepTarget && parseInt(editStepTarget) <= 0) {
      setError('Target must be greater than 0')
      return
    }

    setSavingStep(true)
    setError('')
    try {
      const res = await fetch(`/api/batches/${batch.id}/steps/${editingStep.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editStepName,
          type: editStepType,
          targetQuantity: editStepType === 'CHECK' ? 1 : editStepTarget || null,
          unitLabel: editStepUnit || batch.baseUnit || 'units',
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Server error' }))
        setError(data.error || 'Failed to update step')
        return
      }

      const data = await res.json()
      setBatch(prev => ({
        ...prev,
        steps: prev.steps.map(s => s.id === editingStep.id ? data.step : s),
      }))
      setEditingStep(null)
      lastSaveTsRef.current = Date.now()
      emitBatchChanged(batch.id, 'step-edit')
      showToast('Step updated')
    } catch (err) {
      setError('Network error. Please check your connection.')
    } finally {
      setSavingStep(false)
    }
  }

  const handleMoveStep = async (step: BatchStep, direction: 'move-up' | 'move-down') => {
    haptic('light')
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/batches/${batch.id}/steps/${step.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: direction }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Server error' }))
        setError(data.error || 'Failed to reorder step')
        return
      }

      setBatch(prev => {
        const steps = [...prev.steps].sort((a, b) => a.order - b.order)
        const index = steps.findIndex(s => s.id === step.id)
        const swapIndex = direction === 'move-up' ? index - 1 : index + 1
        if (index < 0 || swapIndex < 0 || swapIndex >= steps.length) return prev
        const currentOrder = steps[index].order
        steps[index] = { ...steps[index], order: steps[swapIndex].order }
        steps[swapIndex] = { ...steps[swapIndex], order: currentOrder }
        return { ...prev, steps: steps.sort((a, b) => a.order - b.order) }
      })
      lastSaveTsRef.current = Date.now()
      emitBatchChanged(batch.id, 'step-reorder')
      showToast('Step moved')
    } catch (err) {
      setError('Network error. Please check your connection.')
    } finally {
      setLoading(false)
    }
  }

  const handleSkipStep = (step: BatchStep) => {
    setConfirmAction({
      title: `Skip ${displayStepName(step)}?`,
      message: step.progressLogs.length
        ? 'This step already has logs. It will be marked skipped but the log history stays attached.'
        : 'This hides it from the active workflow for this batch only. The recipe will not change.',
      confirmLabel: 'Skip Step',
      confirmStyle: 'primary',
      onConfirm: () => performStepSkip(step, true),
    })
  }

  const handleUnskipStep = (step: BatchStep) => {
    haptic('light')
    performStepSkip(step, false)
  }

  const performStepSkip = async (step: BatchStep, skipped: boolean) => {
    setConfirmAction(null)
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/batches/${batch.id}/steps/${step.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: skipped ? 'skip' : 'unskip' }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Server error' }))
        setError(data.error || 'Failed to update step')
        return
      }

      const data = await res.json()
      setBatch(prev => ({
        ...prev,
        steps: prev.steps.map(s => s.id === step.id ? data.step : s),
      }))
      lastSaveTsRef.current = Date.now()
      emitBatchChanged(batch.id, skipped ? 'step-skip' : 'step-unskip')
      showToast(skipped ? 'Step skipped for this batch' : 'Step restored')
    } catch (err) {
      setError('Network error. Please check your connection.')
    } finally {
      setLoading(false)
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
      lastSaveTsRef.current = Date.now()
      emitBatchChanged(batch.id, 'log-edit')
      showToast('Log updated')
    } catch (err) {
      setError('Network error. Please check your connection.')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteLog = async (logId: string, stepId: string, qty: number) => {
    setConfirmAction({
      title: 'Delete log entry?',
      message: `Remove +${qty.toLocaleString()} from this step. This updates the batch progress immediately.`,
      confirmLabel: 'Delete Log',
      confirmStyle: 'danger',
      onConfirm: () => performDeleteLog(logId, stepId, qty),
    })
  }

  const performDeleteLog = async (logId: string, stepId: string, qty: number) => {
    setConfirmAction(null)
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
      lastSaveTsRef.current = Date.now()
      emitBatchChanged(batch.id, 'log-delete')
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
      lastSaveTsRef.current = Date.now()
      emitBatchChanged(batch.id, 'check-complete')
      showToast(`${displayStepName(step)} complete`)
    } catch (err) { 
      setError('Network error. Please check your connection.')
    }
    finally { setLoading(false) }
  }


  const handleOpenDuplicate = () => {
    haptic('light')
    setDuplicateName(`${batch.name} (copy)`)
    setDuplicateIsOpenEnded(batch.targetQuantity === null)
    setDuplicateTargetQty(batch.targetQuantity?.toString() || '')
    setDuplicatePriority((batch as any).priority || 'NORMAL')
    setDuplicateStrain(batch.strain || '')
    setShowDuplicateModal(true)
    setError('')
  }

  const handleDuplicateBatch = async () => {
    if (!duplicateName.trim()) {
      setError('Please enter a batch name')
      return
    }

    const isOpenEnded = duplicateIsOpenEnded
    if (!isOpenEnded && (!duplicateTargetQty || parseInt(duplicateTargetQty) <= 0)) {
      setError('Please enter a target quantity')
      return
    }

    setDuplicating(true)
    setError('')

    try {
      const res = await fetch('/api/batches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipeId: batch.recipe.id,
          name: duplicateName,
          targetQuantity: isOpenEnded ? null : parseInt(duplicateTargetQty),
          priority: duplicatePriority,
          strain: duplicateStrain || undefined,
          workerIds: batch.assignments?.map(a => a.worker.id) || [],
          sourceBatchId: batch.id,
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Server error' }))
        setError(data.error || 'Failed to duplicate batch')
        return
      }

      const data = await res.json()
      emitBatchChanged(data.batch?.id, 'duplicate')
      showToast('Batch duplicated with this workflow')
      router.push(`/batches/${data.batch.id}?editSteps=1`)
    } catch (err) {
      setError('Network error. Please check your connection.')
    } finally {
      setDuplicating(false)
    }
  }

  const getSafeRemaining = (step: BatchStep) => {
    const targetRemaining = step.targetQuantity == null ? null : Math.max(0, step.targetQuantity - step.completedQuantity)
    const previousStep = [...batch.steps]
      .reverse()
      .find(s => s.order < step.order && s.type === 'COUNT' && !isSkippedStep(s))
    const upstreamAvailable = previousStep
      ? Math.max(
          0,
          Math.floor((previousStep.completedQuantity * (previousStep.unitRatio || 1)) / (step.unitRatio || 1)) - step.completedQuantity
        )
      : null

    if (targetRemaining === null && upstreamAvailable === null) return null
    if (targetRemaining === null) return upstreamAvailable
    if (upstreamAvailable === null) return targetRemaining
    return Math.min(targetRemaining, upstreamAvailable)
  }

  const submitLog = async (stepBeingLogged: BatchStep, qty: number, noteBeingLogged?: string) => {
    if (!stepBeingLogged || qty <= 0) {
      setError('Enter a valid quantity'); return
    }
    haptic('medium')
    setLoading(true)

    // Optimistic update: close modal + apply to UI immediately so workers
    // get instant feedback even on flaky warehouse wifi.
    const snapshot = batch
    setBatch(prev => ({
      ...prev,
      steps: prev.steps.map((s) => {
        if (s.id === stepBeingLogged.id) {
          const newQty = s.completedQuantity + qty
          return { ...s, completedQuantity: newQty, status: s.targetQuantity != null && newQty >= s.targetQuantity ? 'COMPLETED' : s.status }
        }
        if (s.order === stepBeingLogged.order + 1 && s.status === 'LOCKED') return { ...s, status: 'IN_PROGRESS' }
        return s
      }),
    }))
    setSelectedStep(null); setQuantity(''); setNote(''); setShowNoteInput(false); setError('')
    showToast(`Logged ${qty} units`)

    try {
      const res = await fetch(`/api/batches/${batch.id}/steps/${stepBeingLogged.id}/log`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantity: qty, note: noteBeingLogged }),
      })
      if (!res.ok) {
        // Rollback on server rejection
        haptic('heavy')
        setBatch(snapshot)
        const errMsg = (await res.json().catch(() => ({}))).error || 'Failed to log progress'
        showToast(errMsg, 'warning')
        return
      }

      const data = await res.json()
      lastSaveTsRef.current = Date.now()
      setLastLogAmounts(prev => ({ ...prev, [stepBeingLogged.id]: qty }))
      emitBatchChanged(batch.id, 'log-add')
      if (data.warning) {
        showToast(data.warning, 'warning')
      }
    } catch (err) {
      // Network failure: rollback and warn
      haptic('heavy')
      setBatch(snapshot)
      showToast('Network error — progress not saved. Try again.', 'warning')
    } finally {
      setLoading(false)
    }
  }

  const handleQuickAmount = (amount: number) => {
    if (!selectedStep) return
    submitLog(selectedStep, amount, note || undefined)
  }

  const handleSubmit = async () => {
    if (!selectedStep || !quantity || parseInt(quantity) <= 0) {
      setError('Enter a valid quantity'); return
    }
    const qty = parseInt(quantity)
    const safeRemaining = getSafeRemaining(selectedStep)
    if (safeRemaining !== null && qty > safeRemaining) {
      setError(`Only ${safeRemaining.toLocaleString()} ${selectedStep.unitLabel} can be logged right now`)
      return
    }
    submitLog(selectedStep, qty, note || undefined)
  }

  const getPrevCompleted = (order: number) => {
    if (order === 1) return batch.targetQuantity
    return batch.steps.find((s) => s.order === order - 1)?.completedQuantity || 0
  }

  // Calculate overall progress for open-ended batches
  const isOpenEnded = batch.targetQuantity === null
  const stepsCompleted = batch.steps.filter(s => s.status === 'COMPLETED').length
  const totalSteps = batch.steps.length

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
      worker: { id: session.workerId || session.id, name: session.name || '' },
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
  const stationStates = getStationStates(batch.steps)
  const activeStations = batch.status === 'ACTIVE' ? getActiveStations(batch.steps, 4) : []
  const primaryStation = activeStations[0] ? batch.steps.find(step => step.id === activeStations[0].step.id) || null : null
  const lastMovement = getLastBatchMovement(batch.steps)

  const openLogForStep = (step: BatchStep) => {
    haptic('light')
    setSelectedStep(step)
    setQuantity('')
    setNote('')
    setShowNoteInput(false)
    setError('')
  }

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
    // Compare "today" in the org's timezone, not the browser's
    const todayInOrgTz = formatDateInTz(new Date(), orgTimezone)
    const dateInOrgTz = formatDateInTz(date, orgTimezone)
    const isToday = todayInOrgTz === dateInOrgTz

    const timeStr = formatTimeInTz(date, orgTimezone)

    if (isToday) {
      return timeStr
    }
    // Short month/day in org tz (e.g., "Apr 23")
    const monthDay = new Intl.DateTimeFormat('en-US', {
      timeZone: orgTimezone,
      month: 'short',
      day: 'numeric',
    }).format(date)
    return `${monthDay} · ${timeStr}`
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

      <main className="max-w-2xl mx-auto px-4 py-5 pb-36 sm:pb-5">
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
            {(() => {
              const priority = (batch as any).priority || 'NORMAL'
              if (priority === 'URGENT') {
                return (
                  <span className="flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-red-500/10 text-red-500 dark:text-red-400 border border-red-500/20">
                    <FlagIcon className="w-3 h-3" />
                    Urgent
                  </span>
                )
              }
              if (priority === 'HIGH') {
                return (
                  <span className="flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                    <FlagIcon className="w-3 h-3" />
                    High
                  </span>
                )
              }
              if (priority === 'LOW') {
                return (
                  <span className="flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                    <FlagIcon className="w-3 h-3" />
                    Low
                  </span>
                )
              }
              return null
            })()}
            {(batch as any).priority === 'URGENT' || (batch as any).priority === 'HIGH' || (batch as any).priority === 'LOW' ? <span className="text-muted-foreground/30">·</span> : null}
            {isOpenEnded ? (
              <>
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">Open</span>
                <span className="text-muted-foreground/30">·</span>
                <span className="text-xs text-foreground">{batch.steps[0]?.completedQuantity || 0} {batch.baseUnit} produced</span>
              </>
            ) : (
              <span className="text-xs text-foreground">{batch.targetQuantity} {batch.baseUnit}</span>
            )}
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
            {isOpenEnded ? (
              <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">{stepsCompleted}/{totalSteps} steps</span>
            ) : (
              <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">{overallPct}%</span>
            )}
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

          <div className="mt-3 rounded-xl border border-border bg-card p-3 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Production Line</p>
                <p className="text-sm font-semibold text-foreground">
                  {activeStations.length > 1
                    ? `${activeStations.length} stations active`
                    : activeStations[0]
                      ? `${activeStations[0].label === 'waiting' ? 'Waiting' : 'Ready'}: ${displayStepName(activeStations[0].step as BatchStep)}`
                      : 'Line complete'}
                </p>
              </div>
              {lastMovement ? (
                <p className="text-xs text-muted-foreground text-right shrink-0">
                  Last: {lastMovement.worker.name.split(' ')[0]} +{lastMovement.quantity}<br />
                  {formatShortRelativeTime(lastMovement.createdAt)}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground text-right shrink-0">No movement yet</p>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {activeStations.slice(0, 4).map((station) => (
                <button
                  key={station.step.id}
                  type="button"
                  onClick={() => station.step.type === 'COUNT' ? openLogForStep(station.step as BatchStep) : undefined}
                  className="min-h-[52px] rounded-lg bg-muted/45 border border-border/60 px-3 py-2 text-left active:scale-[0.99] transition-all"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-foreground truncate">{displayStepName(station.step as BatchStep)}</span>
                    <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                      {station.step.completedQuantity}{station.step.targetQuantity ? `/${station.step.targetQuantity}` : ''}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[10px] text-muted-foreground truncate">
                    {station.latestLog
                      ? `${station.latestLog.worker.name} moved ${station.latestLog.quantity} · ${formatShortRelativeTime(station.latestLog.createdAt)}`
                      : station.availableFromPrevious
                        ? `${station.availableFromPrevious.toLocaleString()} ready from previous step`
                        : station.index === 0
                          ? 'Ready to start'
                          : 'Waiting on previous step'}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Batch notes */}
          {batch.notes && (
            <div className="mt-3 rounded-xl bg-amber-500/10 border border-amber-500/25 px-3 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400 mb-1">Batch Notes</p>
              <p className="text-sm text-foreground whitespace-pre-wrap break-words">{batch.notes}</p>
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

          {/* Owner/Supervisor batch controls */}
          {(session.role === 'OWNER' || session.role === 'SUPERVISOR') && batch.status === 'ACTIVE' && (
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              {session.role === 'OWNER' && (
                <button onClick={() => handleStatusChange('COMPLETED')}
                  className="px-3 py-2 min-h-[44px] rounded-lg bg-emerald-600 hover:bg-emerald-500 active:scale-[0.96] text-white text-xs font-medium transition-all">
                  Mark Complete
                </button>
              )}
              {session.role === 'OWNER' && (
                <button onClick={() => setShowEditModal(true)}
                  className="px-3 py-2 min-h-[44px] rounded-lg bg-muted hover:bg-muted/80 border border-input active:scale-[0.96] text-foreground/80 text-xs font-medium transition-all">
                  Edit Batch
                </button>
              )}
              <button onClick={toggleStepEditing}
                className={`px-3 py-2 min-h-[44px] rounded-lg border active:scale-[0.96] text-xs font-medium transition-all ${
                  editingSteps
                    ? 'bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-500'
                    : 'bg-muted hover:bg-muted/80 border-input text-foreground/80'
                }`}>
                {editingSteps ? 'Done Editing Steps' : 'Edit Steps'}
              </button>
              {editingSteps && (
                <button onClick={handleOpenAddStep}
                  className="flex items-center gap-1.5 px-3 py-2 min-h-[44px] rounded-lg bg-muted hover:bg-muted/80 border border-input active:scale-[0.96] text-foreground text-xs font-medium transition-all">
                  <PlusIcon className="w-4 h-4" />
                  Add Step
                </button>
              )}
              <button onClick={handleOpenDuplicate}
                className="flex items-center gap-1.5 px-3 py-2 min-h-[44px] rounded-lg bg-muted hover:bg-muted/80 border border-input active:scale-[0.96] text-foreground text-xs font-medium transition-all">
                <DocumentDuplicateIcon className="w-4 h-4" />
                Duplicate
              </button>
              {session.role === 'OWNER' && (
                <button onClick={() => handleStatusChange('CANCELLED')}
                  className="px-3 py-2 min-h-[44px] rounded-lg bg-muted hover:bg-muted/80 border border-input active:scale-[0.96] text-red-500 dark:text-red-400 text-xs font-medium transition-all">
                  Cancel Batch
                </button>
              )}
            </div>
          )}
          {(session.role === 'OWNER' || session.role === 'SUPERVISOR') && batch.status !== 'ACTIVE' && (
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              <button onClick={handleOpenDuplicate}
                className="flex items-center gap-1.5 px-3 py-2 min-h-[44px] rounded-lg bg-muted hover:bg-muted/80 border border-input active:scale-[0.96] text-foreground text-xs font-medium transition-all">
                <DocumentDuplicateIcon className="w-4 h-4" />
                Duplicate
              </button>
              {session.role === 'OWNER' && (
                <button onClick={() => handleStatusChange('ACTIVE')}
                  className="px-3 py-2 min-h-[44px] rounded-lg bg-muted hover:bg-muted/80 border border-input active:scale-[0.96] text-blue-600 dark:text-blue-400 text-xs font-medium transition-all">
                  Reopen Batch
                </button>
              )}
              {session.role === 'OWNER' && batch.status === 'CANCELLED' && (
                <button onClick={handleDeleteBatch}
                  className="px-3 py-2 min-h-[44px] rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 active:scale-[0.96] text-red-500 dark:text-red-400 text-xs font-medium transition-all">
                  Delete Batch
                </button>
              )}
            </div>
          )}
        </div>

        {/* Steps */}
        <div className="space-y-2">
          {(session.role === 'OWNER' || session.role === 'SUPERVISOR') && batch.status === 'ACTIVE' && editingSteps && (
            <>
              <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">Customizing this batch</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Move, edit, add, skip, or restore steps here. The recipe stays unchanged.</p>
                  </div>
                  <button
                    onClick={handleOpenAddStep}
                    className="shrink-0 flex items-center gap-1.5 px-3 py-2 min-h-[40px] rounded-lg bg-emerald-600 text-white active:scale-[0.96] text-xs font-semibold transition-all"
                  >
                    <PlusIcon className="w-4 h-4" />
                    Add
                  </button>
                </div>
              </div>

              <div className="rounded-xl border border-border bg-card p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Worker preview</p>
                    <p className="text-sm font-semibold text-foreground truncate">{batch.name}</p>
                  </div>
                  <span className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">
                    {batch.steps.filter(step => !isSkippedStep(step)).length} visible
                  </span>
                </div>
                <div className="mt-3 space-y-1.5">
                  {batch.steps.filter(step => !isSkippedStep(step)).map((step, index) => (
                    <div key={step.id} className="flex items-center gap-2 rounded-lg bg-muted/45 px-3 py-2">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-card text-[11px] font-bold text-muted-foreground tabular-nums">
                        {index + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">{displayStepName(step)}</p>
                        <p className="truncate text-[11px] text-muted-foreground">
                          {step.type === 'CHECK'
                            ? 'Worker taps Done'
                            : step.targetQuantity
                            ? `Worker logs ${step.completedQuantity.toLocaleString()} / ${step.targetQuantity.toLocaleString()} ${step.unitLabel}`
                            : `Worker logs ${step.unitLabel} as they go`}
                        </p>
                      </div>
                    </div>
                  ))}
                  {batch.steps.every(step => isSkippedStep(step)) && (
                    <div className="rounded-lg bg-amber-500/10 px-3 py-2 text-xs font-medium text-amber-700 dark:text-amber-300">
                      No visible worker steps. Restore or add a step before running this batch.
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {batch.steps.map((step, stepIndex) => {
            const isSkipped = isSkippedStep(step)
            const isCompleted = step.status === 'COMPLETED' && !isSkipped
            const stationState = stationStates.find(state => state.step.id === step.id)
            const isCurrent = activeStations.some(state => state.step.id === step.id)
            const pct = step.targetQuantity ? (step.completedQuantity / step.targetQuantity) * 100 : 0

            return (
              <div
                key={step.id}
                className={`rounded-xl border p-4 transition-all duration-150 ${
                  isSkipped
                    ? 'border-amber-500/20 bg-amber-500/5'
                    : isCompleted
                    ? 'border-emerald-500/20 bg-emerald-500/5'
                    : isCurrent
                    ? 'border-emerald-500/50 bg-emerald-500/5 shadow-sm shadow-emerald-500/10'
                    : 'border bg-card'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  {/* Left: status icon + name */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                      isSkipped
                        ? 'bg-amber-500/15'
                        : isCompleted
                        ? 'bg-emerald-500/15'
                        : 'bg-blue-500/15'
                    }`}>
                      {isSkipped ? (
                        <XMarkIcon className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                      ) : isCompleted ? (
                        <CheckCircleIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      ) : (
                        <span className="text-xs font-bold text-blue-600 dark:text-blue-400">{step.order}</span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <p className={`text-sm font-medium truncate ${
                          isSkipped ? 'text-amber-600 dark:text-amber-400' : isCompleted ? 'text-emerald-600 dark:text-emerald-300' : 'text-foreground'
                        }`}>
                          {displayStepName(step)}
                        </p>
                        {isSkipped && (
                          <span className="shrink-0 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">
                            Skipped
                          </span>
                        )}
                        {isCurrent && (
                          <span className="shrink-0 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
                            Active
                          </span>
                        )}
                      </div>
                      {step.recipeStep?.notes && (
                        <p className={`mt-1 break-words ${isCurrent ? 'text-xs text-foreground/80' : 'text-[10px] text-muted-foreground/70'}`}>{step.recipeStep.notes}</p>
                      )}
                      {step.type === 'COUNT' && (
                        <p className="text-xs text-foreground tabular-nums mt-0.5">
                          {step.completedQuantity}{step.targetQuantity ? ` / ${step.targetQuantity}` : ''} {step.unitLabel}{!step.targetQuantity && step.completedQuantity > 0 ? ' produced' : ''}
                        </p>
                      )}
                      {!isSkipped && !isCompleted && stationState?.availableFromPrevious !== null && stationState?.availableFromPrevious !== undefined && (
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {stationState.availableFromPrevious > 0
                            ? `${stationState.availableFromPrevious.toLocaleString()} ready from previous step`
                            : 'Waiting on previous step'}
                        </p>
                      )}
                      {!isSkipped && stationState?.latestLog && (
                        <p className="text-[10px] text-muted-foreground/70 mt-0.5">
                          Last: {stationState.latestLog.worker.name} +{stationState.latestLog.quantity} · {formatShortRelativeTime(stationState.latestLog.createdAt)}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Right: action or status */}
                  {!isCompleted && !isSkipped && step.type === 'COUNT' && (
                    <button
                      onClick={() => openLogForStep(step)}
                      className="flex items-center gap-1.5 px-4 py-3 min-h-[44px] rounded-lg bg-emerald-600 hover:bg-emerald-500 active:scale-[0.96] text-white text-sm font-semibold transition-all duration-150 shrink-0"
                    >
                      <PlusIcon className="w-4 h-4" />Log
                    </button>
                  )}
                  {!isCompleted && !isSkipped && step.type === 'CHECK' && (
                    <button
                      onClick={() => { haptic('light'); handleCheckComplete(step); }}
                      disabled={loading}
                      className="flex items-center gap-1.5 px-4 py-3 min-h-[44px] rounded-lg bg-blue-600 hover:bg-blue-500 active:scale-[0.96] text-white text-sm font-semibold transition-all duration-150 shrink-0 disabled:opacity-50"
                    >
                      <CheckIcon className="w-4 h-4" />Done
                    </button>
                  )}
                </div>

                {(session.role === 'OWNER' || session.role === 'SUPERVISOR') && batch.status === 'ACTIVE' && editingSteps && (
                  <div className="mt-3 grid grid-cols-4 gap-2">
                    <button
                      onClick={() => handleMoveStep(step, 'move-up')}
                      disabled={loading || stepIndex === 0}
                      aria-label={`Move ${displayStepName(step)} up`}
                      className="flex flex-col items-center justify-center gap-1 px-2 py-2 min-h-[56px] rounded-lg border border-input bg-muted/40 text-xs font-medium text-foreground/80 active:scale-[0.96] transition-all disabled:opacity-30"
                    >
                      <ChevronUpIcon className="w-4 h-4" />
                      Up
                    </button>
                    <button
                      onClick={() => handleMoveStep(step, 'move-down')}
                      disabled={loading || stepIndex === batch.steps.length - 1}
                      aria-label={`Move ${displayStepName(step)} down`}
                      className="flex flex-col items-center justify-center gap-1 px-2 py-2 min-h-[56px] rounded-lg border border-input bg-muted/40 text-xs font-medium text-foreground/80 active:scale-[0.96] transition-all disabled:opacity-30"
                    >
                      <ChevronDownIcon className="w-4 h-4" />
                      Down
                    </button>
                    <button
                      onClick={() => handleOpenEditStep(step)}
                      disabled={loading}
                      aria-label={`Edit ${displayStepName(step)}`}
                      className="flex flex-col items-center justify-center gap-1 px-2 py-2 min-h-[56px] rounded-lg border border-input bg-muted/40 text-xs font-medium text-foreground/80 active:scale-[0.96] transition-all disabled:opacity-50"
                    >
                      <PencilSquareIcon className="w-4 h-4" />
                      Edit
                    </button>
                    {isSkipped ? (
                      <button
                        onClick={() => handleUnskipStep(step)}
                        disabled={loading}
                        aria-label={`Restore ${displayStepName(step)}`}
                        className="flex flex-col items-center justify-center gap-1 px-2 py-2 min-h-[56px] rounded-lg border border-input bg-muted/40 text-xs font-medium text-foreground/80 active:scale-[0.96] transition-all disabled:opacity-50"
                      >
                        <CheckIcon className="w-4 h-4" />
                        Restore
                      </button>
                    ) : (
                      <button
                        onClick={() => handleSkipStep(step)}
                        disabled={loading}
                        aria-label={`Skip ${displayStepName(step)} for this batch`}
                        className="flex flex-col items-center justify-center gap-1 px-2 py-2 min-h-[56px] rounded-lg border border-amber-500/30 bg-amber-500/10 text-xs font-medium text-amber-700 dark:text-amber-300 active:scale-[0.96] transition-all disabled:opacity-50"
                      >
                        <EyeSlashIcon className="w-4 h-4" />
                        Skip
                      </button>
                    )}
                  </div>
                )}

                {/* Progress bar for COUNT steps (only when there's a target) */}
                {!isSkipped && step.type === 'COUNT' && step.targetQuantity && (
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
                {!isSkipped && step.recipeStep?.materials && step.recipeStep.materials.length > 0 && (
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
                {step.progressLogs && step.progressLogs.length > 0 && (
                  <div className="mt-3">
                    {(() => {
                      const isExpanded = expandedSteps.has(step.id)
                      const logs = isExpanded ? step.progressLogs : []
                      return (
                        <>
                          {isExpanded && (
                            <div className="space-y-1 overflow-hidden transition-all duration-300">
                            {logs.map((log) => {
                              const canEdit = session.role === 'OWNER' || session.workerId === log.worker.id
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
                          )}
                          <div className={isExpanded ? 'mt-1' : ''}>
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
                              {isExpanded ? 'Hide activity' : `Show ${step.progressLogs.length} recent log${step.progressLogs.length === 1 ? '' : 's'}`}
                            </button>
                          </div>
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
          <button
            type="button"
            onClick={() => { haptic('light'); setChatOpen(!chatOpen) }}
            className="w-full min-h-[48px] rounded-xl border border-border bg-card px-4 text-left flex items-center justify-between active:scale-[0.99] transition-all"
          >
            <span className="text-sm font-semibold text-foreground flex items-center gap-2">
              <ChatBubbleLeftRightIcon className="w-5 h-5 text-muted-foreground" />
              Team Chat
            </span>
            <span className="text-xs text-muted-foreground">
              {chatOpen ? 'Hide' : messages.length ? `${messages.length} message${messages.length === 1 ? '' : 's'}` : 'Open'}
            </span>
          </button>

          {chatOpen && (
          <div className="mt-3 rounded-xl border bg-card p-4">
            {/* Message list */}
            <div
              ref={chatContainerRef}
              className="space-y-3 max-h-[300px] overflow-y-auto mb-4"
            >
              {messages.length === 0 ? (
                <p className="text-xs text-muted-foreground/70 text-center py-4">No messages yet</p>
              ) : (
                messages.map((msg) => {
                  const isCurrentUser = msg.worker.id === (session.workerId || session.id)
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
          )}
        </div>
          </>
        )}
      </main>

      {primaryStation && !selectedStep && (
        <div className="fixed left-0 right-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom,0px))] z-30 px-4 pb-3 sm:hidden pointer-events-none">
          <div className="max-w-2xl mx-auto rounded-2xl border border-border bg-card/95 backdrop-blur-xl shadow-2xl p-3 pointer-events-auto">
            <div className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Active Station</p>
                <p className="text-sm font-semibold text-foreground truncate">{displayStepName(primaryStation)}</p>
                {primaryStation.type === 'COUNT' && (
                  <p className="text-xs text-muted-foreground tabular-nums">
                    {primaryStation.completedQuantity}{primaryStation.targetQuantity ? ` / ${primaryStation.targetQuantity}` : ''} {primaryStation.unitLabel}
                  </p>
                )}
              </div>
              {primaryStation.type === 'COUNT' ? (
                <button
                  onClick={() => openLogForStep(primaryStation)}
                  className="min-h-[52px] px-5 rounded-xl bg-emerald-600 text-white text-sm font-bold active:scale-[0.97] transition-all flex items-center gap-1.5"
                >
                  <PlusIcon className="w-4 h-4" />
                  Log
                </button>
              ) : (
                <button
                  onClick={() => { haptic('light'); handleCheckComplete(primaryStation) }}
                  disabled={loading}
                  className="min-h-[52px] px-5 rounded-xl bg-blue-600 text-white text-sm font-bold active:scale-[0.97] transition-all flex items-center gap-1.5 disabled:opacity-60"
                >
                  <CheckIcon className="w-4 h-4" />
                  Done
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        open={!!confirmAction}
        title={confirmAction?.title || ''}
        message={confirmAction?.message}
        confirmLabel={confirmAction?.confirmLabel}
        confirmStyle={confirmAction?.confirmStyle}
        onCancel={() => setConfirmAction(null)}
        onConfirm={() => confirmAction?.onConfirm()}
      />

      {/* Add Batch Step Modal */}
      {showAddStepModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center">
          <div
            className="w-full max-w-md bg-card border border rounded-t-2xl sm:rounded-2xl safe-bottom"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <p className="text-sm font-semibold text-foreground">Add step to this batch</p>
                  <p className="text-xs text-muted-foreground mt-0.5">One-off change. Recipe stays unchanged.</p>
                </div>
                <button
                  onClick={() => setShowAddStepModal(false)}
                  className="p-1.5 rounded-lg text-foreground hover:text-foreground/80 hover:bg-muted transition-colors"
                >
                  <XMarkIcon className="w-5 h-5" />
                </button>
              </div>

              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Step name</label>
              <input
                type="text"
                value={newStepName}
                onChange={(e) => setNewStepName(e.target.value)}
                placeholder="e.g. Extra dry time"
                maxLength={80}
                className="w-full px-3.5 py-3 rounded-xl bg-muted/50 border border-input text-foreground text-sm placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all"
              />

              <div className="grid grid-cols-2 gap-2 mt-4">
                <button
                  type="button"
                  onClick={() => setNewStepType('COUNT')}
                  className={`min-h-[44px] rounded-xl border text-sm font-semibold transition-all ${
                    newStepType === 'COUNT'
                      ? 'border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                      : 'border-input bg-muted/40 text-foreground/70'
                  }`}
                >
                  Count
                </button>
                <button
                  type="button"
                  onClick={() => setNewStepType('CHECK')}
                  className={`min-h-[44px] rounded-xl border text-sm font-semibold transition-all ${
                    newStepType === 'CHECK'
                      ? 'border-blue-500 bg-blue-500/10 text-blue-600 dark:text-blue-400'
                      : 'border-input bg-muted/40 text-foreground/70'
                  }`}
                >
                  Done / not done
                </button>
              </div>

              {newStepType === 'COUNT' && (
                <div className="grid grid-cols-2 gap-3 mt-4">
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1.5">Target</label>
                    <input
                      type="number"
                      inputMode="numeric"
                      min="1"
                      value={newStepTarget}
                      onChange={(e) => setNewStepTarget(e.target.value)}
                      placeholder="Optional"
                      className="w-full px-3.5 py-3 rounded-xl bg-muted/50 border border-input text-foreground text-sm placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1.5">Unit</label>
                    <input
                      type="text"
                      value={newStepUnit}
                      onChange={(e) => setNewStepUnit(e.target.value)}
                      placeholder={batch.baseUnit || 'units'}
                      maxLength={30}
                      className="w-full px-3.5 py-3 rounded-xl bg-muted/50 border border-input text-foreground text-sm placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all"
                    />
                  </div>
                </div>
              )}

              {error && <p className="text-red-500 dark:text-red-400 text-xs mt-3 text-center">{error}</p>}

              <button
                onClick={handleAddStep}
                disabled={savingStep || !newStepName.trim()}
                className="w-full mt-5 py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] text-white font-semibold text-sm transition-all duration-150 disabled:opacity-40 disabled:bg-muted"
              >
                {savingStep ? 'Adding...' : 'Add Step'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Batch Step Modal */}
      {editingStep && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center">
          <div
            className="w-full max-w-md bg-card border border rounded-t-2xl sm:rounded-2xl safe-bottom"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <p className="text-sm font-semibold text-foreground">Edit batch step</p>
                  <p className="text-xs text-muted-foreground mt-0.5">This changes this batch only.</p>
                </div>
                <button
                  onClick={() => setEditingStep(null)}
                  className="p-1.5 rounded-lg text-foreground hover:text-foreground/80 hover:bg-muted transition-colors"
                >
                  <XMarkIcon className="w-5 h-5" />
                </button>
              </div>

              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Step name</label>
              <input
                type="text"
                value={editStepName}
                onChange={(e) => setEditStepName(e.target.value)}
                maxLength={80}
                className="w-full px-3.5 py-3 rounded-xl bg-muted/50 border border-input text-foreground text-sm placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all"
              />

              <div className="grid grid-cols-2 gap-2 mt-4">
                <button
                  type="button"
                  onClick={() => setEditStepType('COUNT')}
                  className={`min-h-[44px] rounded-xl border text-sm font-semibold transition-all ${
                    editStepType === 'COUNT'
                      ? 'border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                      : 'border-input bg-muted/40 text-foreground/70'
                  }`}
                >
                  Count
                </button>
                <button
                  type="button"
                  onClick={() => setEditStepType('CHECK')}
                  className={`min-h-[44px] rounded-xl border text-sm font-semibold transition-all ${
                    editStepType === 'CHECK'
                      ? 'border-blue-500 bg-blue-500/10 text-blue-600 dark:text-blue-400'
                      : 'border-input bg-muted/40 text-foreground/70'
                  }`}
                >
                  Done / not done
                </button>
              </div>

              {editStepType === 'COUNT' && (
                <div className="grid grid-cols-2 gap-3 mt-4">
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1.5">Target</label>
                    <input
                      type="number"
                      inputMode="numeric"
                      min="1"
                      value={editStepTarget}
                      onChange={(e) => setEditStepTarget(e.target.value)}
                      placeholder="Optional"
                      className="w-full px-3.5 py-3 rounded-xl bg-muted/50 border border-input text-foreground text-sm placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1.5">Unit</label>
                    <input
                      type="text"
                      value={editStepUnit}
                      onChange={(e) => setEditStepUnit(e.target.value)}
                      maxLength={30}
                      className="w-full px-3.5 py-3 rounded-xl bg-muted/50 border border-input text-foreground text-sm placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all"
                    />
                  </div>
                </div>
              )}

              {editingStep.progressLogs.length > 0 && (
                <div className="mt-4 rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2">
                  <p className="text-xs font-medium text-amber-700 dark:text-amber-300">
                    This step already has {editingStep.progressLogs.length} log{editingStep.progressLogs.length === 1 ? '' : 's'}. Logs stay attached if you rename it.
                  </p>
                </div>
              )}

              {editStepType === 'COUNT' && editStepTarget && parseInt(editStepTarget) > 0 && editingStep.completedQuantity > parseInt(editStepTarget) && (
                <div className="mt-3 rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2">
                  <p className="text-xs font-medium text-amber-700 dark:text-amber-300">
                    Completed amount is already {editingStep.completedQuantity.toLocaleString()}, so this step will show complete.
                  </p>
                </div>
              )}

              {error && <p className="text-red-500 dark:text-red-400 text-xs mt-3 text-center">{error}</p>}

              <button
                onClick={handleSaveStepEdit}
                disabled={savingStep || !editStepName.trim()}
                className="w-full mt-5 py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] text-white font-semibold text-sm transition-all duration-150 disabled:opacity-40 disabled:bg-muted"
              >
                {savingStep ? 'Saving...' : 'Save Step'}
              </button>
            </div>
          </div>
        </div>
      )}

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
                  <p className="text-sm font-semibold text-foreground">{displayStepName(selectedStep)}</p>
                  <p className="text-xs text-foreground tabular-nums mt-0.5">
                    {selectedStep.completedQuantity}{selectedStep.targetQuantity ? ` / ${selectedStep.targetQuantity}` : ''} {selectedStep.unitLabel}{!selectedStep.targetQuantity ? ' produced' : ''}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setSelectedStep(null)
                    setQuantity('')
                    setNote('')
                    setShowNoteInput(false)
                  }}
                  className="p-1.5 rounded-lg text-foreground hover:text-foreground/80 hover:bg-muted transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {(() => {
                const safeRemaining = getSafeRemaining(selectedStep)
                const previousLog = selectedStep.progressLogs.find(log => log.worker.id === session.workerId) || selectedStep.progressLogs[0]
                const lastAmount = lastLogAmounts[selectedStep.id] || previousLog?.quantity || null
                const keypad = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'clear', '0', 'back']
                const customQuantity = quantity ? parseInt(quantity) : 0
                const customTooHigh = safeRemaining !== null && customQuantity > safeRemaining

                return (
                  <>
                    {safeRemaining !== null && (
                      <div className="mb-4 rounded-xl border border-border bg-muted/35 px-3 py-2">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Safe to log</p>
                        <p className="text-sm font-semibold text-foreground tabular-nums">
                          {safeRemaining.toLocaleString()} {selectedStep.unitLabel}
                        </p>
                      </div>
                    )}

                    <PresetLogButtons
                      remaining={safeRemaining}
                      lastAmount={lastAmount}
                      disabled={loading || safeRemaining === 0}
                      onPick={handleQuickAmount}
                    />

                    <div className="mt-4">
                      <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Enter amount</p>
                      <input
                        ref={quantityRef}
                        type="text"
                        inputMode="none"
                        readOnly
                        value={quantity}
                        placeholder="0"
                        className={`w-full px-4 py-3.5 rounded-xl border text-3xl font-bold text-center tabular-nums placeholder:text-muted-foreground/45 focus:outline-none transition-all ${
                          customTooHigh
                            ? 'bg-red-500/10 border-red-500/40 text-red-600 dark:text-red-400'
                            : customQuantity > 0
                              ? 'bg-emerald-600/10 border-emerald-500/35 text-foreground'
                              : 'bg-muted/35 border-border text-foreground'
                        }`}
                      />
                      {customTooHigh && safeRemaining !== null && (
                        <p className="mt-2 text-center text-xs font-medium text-red-600 dark:text-red-400">
                          Max right now: {safeRemaining.toLocaleString()} {selectedStep.unitLabel}
                        </p>
                      )}
                      <div className="grid grid-cols-3 gap-2 mt-3">
                        {keypad.map((key) => (
                          <button
                            key={key}
                            type="button"
                            onClick={() => {
                              haptic('light')
                              if (key === 'clear') setQuantity('')
                              else if (key === 'back') setQuantity(prev => prev.slice(0, -1))
                              else setQuantity(prev => `${prev}${key}`.replace(/^0+(\d)/, '$1').slice(0, 6))
                            }}
                            className="min-h-[56px] rounded-xl border border-input bg-muted text-xl font-bold text-foreground active:scale-[0.97] transition-all"
                          >
                            {key === 'clear' ? 'Clear' : key === 'back' ? 'Back' : key}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="mt-4">
                      {showNoteInput ? (
                        <input
                          type="text"
                          value={note}
                          onChange={(e) => setNote(e.target.value)}
                          placeholder="Note (optional)"
                          className="w-full px-3.5 py-2.5 rounded-xl bg-muted/50 border border-input text-foreground text-sm placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all"
                        />
                      ) : (
                        <button
                          type="button"
                          onClick={() => { haptic('light'); setShowNoteInput(true) }}
                          className="min-h-[40px] rounded-xl px-4 border border-dashed border-input text-xs font-semibold text-muted-foreground active:scale-[0.98] transition-all"
                        >
                          Add note
                        </button>
                      )}
                    </div>
                  </>
                )
              })()}

              {error && <p className="text-red-500 dark:text-red-400 text-xs mt-3 text-center">{error}</p>}

              {/* Submit */}
              <button
                onClick={handleSubmit}
                disabled={loading || !quantity || parseInt(quantity) <= 0 || (selectedStep && getSafeRemaining(selectedStep) !== null && parseInt(quantity) > getSafeRemaining(selectedStep)!)}
                className="w-full mt-4 py-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] text-white font-bold text-base transition-all duration-150 disabled:opacity-45 disabled:bg-muted disabled:text-muted-foreground"
              >
                {loading
                  ? 'Saving...'
                  : quantity && parseInt(quantity) > 0
                    ? (getSafeRemaining(selectedStep) !== null && parseInt(quantity) > getSafeRemaining(selectedStep)!
                      ? `Max ${getSafeRemaining(selectedStep)!.toLocaleString()} ${selectedStep.unitLabel}`
                      : `Log ${parseInt(quantity).toLocaleString()} ${selectedStep.unitLabel}`)
                    : 'Enter amount'}
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
                    inputMode="numeric"
                    pattern="[0-9]*"
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

      {/* Duplicate Batch Modal */}
      {showDuplicateModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center">
          <div
            className="w-full max-w-md bg-card border border rounded-t-2xl sm:rounded-2xl safe-bottom"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5">
              {/* Header */}
              <div className="flex items-center justify-between mb-5">
                <div>
                  <p className="text-sm font-semibold text-foreground">Duplicate Batch</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Starts from this batch's current workflow.</p>
                </div>
                <button
                  onClick={() => setShowDuplicateModal(false)}
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
                    value={duplicateName}
                    onChange={(e) => setDuplicateName(e.target.value)}
                    className="w-full px-3 py-2.5 min-h-[44px] rounded-lg bg-muted border border-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all"
                  />
                </div>

                <div>
                  <label className="text-[10px] text-foreground font-semibold uppercase tracking-wider block mb-1">Batch Type</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => { haptic('medium'); setDuplicateIsOpenEnded(false) }}
                      className={`min-h-[40px] px-3 py-2 rounded-lg text-xs font-medium transition-all active:scale-[0.97] ${
                        !duplicateIsOpenEnded
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-2 border-emerald-500'
                          : 'bg-card border-2 border-border text-muted-foreground hover:border-foreground/20'
                      }`}
                    >
                      Fixed target
                    </button>
                    <button
                      type="button"
                      onClick={() => { haptic('medium'); setDuplicateIsOpenEnded(true) }}
                      className={`min-h-[40px] px-3 py-2 rounded-lg text-xs font-medium transition-all active:scale-[0.97] ${
                        duplicateIsOpenEnded
                          ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-2 border-blue-500'
                          : 'bg-card border-2 border-border text-muted-foreground hover:border-foreground/20'
                      }`}
                    >
                      Open — count as we go
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-[10px] text-foreground font-semibold uppercase tracking-wider block mb-1">Target Quantity</label>
                  <input
                    type="number"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={duplicateTargetQty}
                    onChange={(e) => setDuplicateTargetQty(e.target.value)}
                    min="1"
                    disabled={duplicateIsOpenEnded}
                    placeholder={duplicateIsOpenEnded ? 'Open-ended' : '0'}
                    className="w-full px-3 py-2.5 min-h-[44px] rounded-lg bg-muted border border-input text-foreground text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all disabled:opacity-40"
                  />
                </div>

                <div>
                  <label className="text-[10px] text-foreground font-semibold uppercase tracking-wider block mb-2">Priority</label>
                  <div className="grid grid-cols-4 gap-2">
                    <button
                      type="button"
                      onClick={() => { haptic('light'); setDuplicatePriority('LOW') }}
                      className={`min-h-[40px] px-2 py-2 rounded-lg text-xs font-semibold transition-all active:scale-[0.97] ${
                        duplicatePriority === 'LOW'
                          ? 'bg-muted/80 text-muted-foreground border-2 border-border'
                          : 'bg-card border-2 border-border text-muted-foreground/60 hover:border-foreground/20'
                      }`}
                    >
                      Low
                    </button>
                    <button
                      type="button"
                      onClick={() => { haptic('light'); setDuplicatePriority('NORMAL') }}
                      className={`min-h-[40px] px-2 py-2 rounded-lg text-xs font-semibold transition-all active:scale-[0.97] ${
                        duplicatePriority === 'NORMAL'
                          ? 'bg-muted/80 text-foreground border-2 border-foreground/30'
                          : 'bg-card border-2 border-border text-muted-foreground/60 hover:border-foreground/20'
                      }`}
                    >
                      Normal
                    </button>
                    <button
                      type="button"
                      onClick={() => { haptic('light'); setDuplicatePriority('HIGH') }}
                      className={`min-h-[40px] px-2 py-2 rounded-lg text-xs font-semibold transition-all active:scale-[0.97] ${
                        duplicatePriority === 'HIGH'
                          ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-2 border-amber-500'
                          : 'bg-card border-2 border-border text-muted-foreground/60 hover:border-foreground/20'
                      }`}
                    >
                      High
                    </button>
                    <button
                      type="button"
                      onClick={() => { haptic('light'); setDuplicatePriority('URGENT') }}
                      className={`min-h-[40px] px-2 py-2 rounded-lg text-xs font-semibold transition-all active:scale-[0.97] ${
                        duplicatePriority === 'URGENT'
                          ? 'bg-red-500/10 text-red-500 dark:text-red-400 border-2 border-red-500'
                          : 'bg-card border-2 border-border text-muted-foreground/60 hover:border-foreground/20'
                      }`}
                    >
                      Urgent
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-[10px] text-foreground font-semibold uppercase tracking-wider block mb-1">Strain (Optional)</label>
                  <input
                    type="text"
                    value={duplicateStrain}
                    onChange={(e) => setDuplicateStrain(e.target.value)}
                    placeholder="Optional"
                    className="w-full px-3 py-2.5 min-h-[44px] rounded-lg bg-muted border border-input text-foreground text-sm placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all"
                  />
                </div>

                <div className="text-xs text-muted-foreground p-3 bg-muted/50 rounded-lg">
                  This copies the current step order, skipped steps, custom names, units, and worker assignments. Progress logs start at zero.
                </div>

                {error && <p className="text-red-500 dark:text-red-400 text-xs text-center">{error}</p>}

                <button
                  onClick={handleDuplicateBatch}
                  disabled={duplicating || !duplicateName.trim() || (!duplicateIsOpenEnded && (!duplicateTargetQty || parseInt(duplicateTargetQty) <= 0))}
                  className="w-full py-3.5 min-h-[44px] rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] text-white font-semibold text-sm transition-all duration-150 disabled:opacity-40"
                >
                  {duplicating ? 'Creating...' : 'Create & Tweak Steps'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Batch Modal */}
      {session.role === 'OWNER' && (
        <EditBatchModal
          batch={showEditModal ? batch : null}
          workers={workers}
          onClose={() => setShowEditModal(false)}
          onSaved={(updated) => {
            setBatch(updated as Batch)
            lastSaveTsRef.current = Date.now()
            showToast('Batch updated')
            // Force a full refetch to ensure steps/targets are in sync
            fetch(`/api/batches/${batch.id}`, { cache: "no-store" })
              .then(res => res.ok ? res.json() : null)
              .then(fresh => { if (fresh?.batch) setBatch(fresh.batch) })
              .catch(() => {})
            emitBatchChanged(updated.id, 'edit')
          }}
        />
      )}
    </AppShell>
  )
}
