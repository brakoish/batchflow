import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { getOrganizationName } from '@/lib/organization'
import AppShell from '@/app/components/AppShell'

const SKIPPED_PREFIX = '[Skipped] '
const DAY_MS = 24 * 60 * 60 * 1000

type AnalyticsStep = {
  name: string
  order: number
  status: string
  type: string
  unitLabel: string
  unitRatio: number
  targetQuantity: number | null
  completedQuantity: number
  progressLogs?: { quantity: number; createdAt: Date; worker?: { name: string } }[]
}

function isSkipped(step: Pick<AnalyticsStep, 'name'>) {
  return step.name.startsWith(SKIPPED_PREFIX)
}

function displayStepName(name: string) {
  return name.startsWith(SKIPPED_PREFIX) ? name.slice(SKIPPED_PREFIX.length) : name
}

function getCountSteps(steps: AnalyticsStep[]) {
  return steps.filter(step => step.type === 'COUNT' && !isSkipped(step))
}

function getProducedBaseUnits(steps: AnalyticsStep[]) {
  const countSteps = getCountSteps(steps)
  if (!countSteps.length) return 0
  return Math.max(...countSteps.map(step => Math.floor(step.completedQuantity * (step.unitRatio || 1))))
}

function getLatestLog(steps: AnalyticsStep[]) {
  return steps
    .flatMap(step => (step.progressLogs || []).map(log => ({ ...log, step })))
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0] || null
}

function getOutputStep(steps: AnalyticsStep[]) {
  return getCountSteps(steps).sort((a, b) => (
    Math.floor(b.completedQuantity * (b.unitRatio || 1)) - Math.floor(a.completedQuantity * (a.unitRatio || 1))
  ))[0] || null
}

function getBottleneckStep(steps: AnalyticsStep[]) {
  return getCountSteps(steps).find(step => step.status !== 'COMPLETED' && (
    step.targetQuantity == null || step.completedQuantity < step.targetQuantity
  )) || getCountSteps(steps).find(step => step.completedQuantity > 0) || getCountSteps(steps)[0] || null
}

function formatNumber(value: number) {
  return Math.round(value).toLocaleString()
}

function formatDays(days: number | null) {
  if (days === null || !Number.isFinite(days)) return 'Not enough data'
  if (days <= 1) return 'About 1 day'
  return `About ${Math.ceil(days)} days`
}

function formatDate(date: Date | null) {
  if (!date) return 'No estimate'
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function StatCard({ label, value, detail, tone = 'default' }: { label: string; value: string | number; detail: string; tone?: 'default' | 'good' | 'warn' | 'bad' }) {
  const toneClass = tone === 'good'
    ? 'text-emerald-600 dark:text-emerald-400'
    : tone === 'warn'
    ? 'text-amber-600 dark:text-amber-400'
    : tone === 'bad'
    ? 'text-red-500 dark:text-red-400'
    : 'text-foreground'

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`mt-1 text-2xl font-bold tabular-nums ${toneClass}`}>{value}</p>
      <p className="text-xs text-muted-foreground">{detail}</p>
    </div>
  )
}

export default async function AnalyticsPage() {
  const session = await getSession()
  if (!session) redirect('/')
  if (session.role !== 'OWNER') redirect('/batches')

  const organizationName = await getOrganizationName(session.organizationId)
  const now = new Date()
  const sevenDaysAgo = new Date(now.getTime() - 7 * DAY_MS)
  const thirtyDaysAgo = new Date(now.getTime() - 30 * DAY_MS)
  const ninetyDaysAgo = new Date(now.getTime() - 90 * DAY_MS)

  const [activeBatches, historicalBatches, recentLogs, recentRemovals, recentShifts] = await Promise.all([
    prisma.batch.findMany({
      where: { organizationId: session.organizationId, status: 'ACTIVE' },
      include: {
        recipe: {
          include: {
            steps: { include: { materials: true } },
          },
        },
        steps: {
          orderBy: { order: 'asc' },
          include: {
            progressLogs: {
              where: { createdAt: { gte: thirtyDaysAgo } },
              orderBy: { createdAt: 'asc' },
              include: { worker: { select: { name: true } } },
            },
          },
        },
        removals: true,
      },
      orderBy: { startDate: 'desc' },
    }),
    prisma.batch.findMany({
      where: {
        organizationId: session.organizationId,
        status: { in: ['COMPLETED', 'CANCELLED'] },
        OR: [
          { completedDate: { gte: ninetyDaysAgo } },
          { completedDate: null, createdAt: { gte: ninetyDaysAgo } },
        ],
      },
      include: {
        recipe: true,
        steps: { orderBy: { order: 'asc' } },
        removals: true,
      },
      orderBy: { completedDate: 'desc' },
      take: 200,
    }),
    prisma.progressLog.findMany({
      where: {
        createdAt: { gte: sevenDaysAgo },
        batchStep: { batch: { organizationId: session.organizationId } },
      },
      include: {
        worker: { select: { id: true, name: true } },
        batchStep: {
          select: {
            name: true,
            unitLabel: true,
            unitRatio: true,
            type: true,
            batch: { select: { id: true, name: true, recipe: { select: { name: true } } } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.batchRemoval.findMany({
      where: {
        createdAt: { gte: thirtyDaysAgo },
        batch: { organizationId: session.organizationId },
      },
      include: {
        worker: { select: { name: true } },
        batch: { select: { id: true, name: true, recipe: { select: { name: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.shift.findMany({
      where: {
        startedAt: { gte: sevenDaysAgo },
        worker: { organizationId: session.organizationId },
      },
      include: { worker: { select: { id: true, name: true } } },
    }),
  ])

  const activeForecasts = activeBatches.map((batch) => {
    const steps = batch.steps as AnalyticsStep[]
    const produced = getProducedBaseUnits(steps)
    const target = batch.targetQuantity || null
    const remaining = target == null ? null : Math.max(0, target - produced)
    const outputStep = getOutputStep(steps)
    const outputLogs = (outputStep?.progressLogs || []).filter(log => log.createdAt >= sevenDaysAgo)
    const velocity = outputLogs.reduce((sum, log) => sum + (log.quantity * (outputStep.unitRatio || 1)), 0) / 7
    const daysRemaining = remaining != null && velocity > 0 ? remaining / velocity : null
    const eta = daysRemaining == null ? null : new Date(now.getTime() + daysRemaining * DAY_MS)
    const bottleneck = getBottleneckStep(steps)
    const latestLog = getLatestLog(steps)
    const staleDays = latestLog ? Math.floor((now.getTime() - latestLog.createdAt.getTime()) / DAY_MS) : null

    return {
      id: batch.id,
      name: batch.name,
      recipe: batch.recipe.name,
      produced,
      target,
      remaining,
      pct: target ? Math.round((produced / target) * 100) : null,
      velocity,
      daysRemaining,
      eta,
      bottleneck: bottleneck ? displayStepName(bottleneck.name) : 'No count step',
      latestLog,
      staleDays,
    }
  })

  const historicalResults = historicalBatches
    .filter(batch => batch.targetQuantity && batch.targetQuantity > 0)
    .map((batch) => {
      const produced = getProducedBaseUnits(batch.steps as AnalyticsStep[])
      const target = batch.targetQuantity || 0
      return {
        id: batch.id,
        name: batch.name,
        recipe: batch.recipe.name,
        status: batch.status,
        produced,
        target,
        difference: produced - target,
        removals: batch.removals.reduce((sum, removal) => sum + removal.quantity, 0),
      }
    })

  const recipeYield = Array.from(historicalResults.reduce((map, result) => {
    const current = map.get(result.recipe) || { recipe: result.recipe, batches: 0, produced: 0, target: 0, short: 0, over: 0 }
    current.batches += 1
    current.produced += result.produced
    current.target += result.target
    if (result.difference < 0) current.short += Math.abs(result.difference)
    if (result.difference > 0) current.over += result.difference
    map.set(result.recipe, current)
    return map
  }, new Map<string, { recipe: string; batches: number; produced: number; target: number; short: number; over: number }>()).values())
    .sort((a, b) => b.batches - a.batches)

  const workerContribution = Array.from(recentLogs.reduce((map, log) => {
    const current = map.get(log.worker.id) || { id: log.worker.id, name: log.worker.name, logs: 0, units: 0, batches: new Set<string>() }
    current.logs += 1
    current.units += Math.floor(log.quantity * (log.batchStep.unitRatio || 1))
    current.batches.add(log.batchStep.batch.name)
    map.set(log.worker.id, current)
    return map
  }, new Map<string, { id: string; name: string; logs: number; units: number; batches: Set<string> }>()).values())
    .map(worker => ({ ...worker, batches: Array.from(worker.batches) }))
    .sort((a, b) => b.units - a.units)

  const removalsByReason = Array.from(recentRemovals.reduce((map, removal) => {
    const current = map.get(removal.reason) || { reason: removal.reason, quantity: 0, count: 0 }
    current.quantity += removal.quantity
    current.count += 1
    map.set(removal.reason, current)
    return map
  }, new Map<string, { reason: string; quantity: number; count: number }>()).values())
    .sort((a, b) => b.quantity - a.quantity)

  const activeProduced = activeForecasts.reduce((sum, batch) => sum + batch.produced, 0)
  const activeRemoved = activeBatches.reduce((sum, batch) => sum + batch.removals.reduce((batchSum, removal) => batchSum + removal.quantity, 0), 0)
  const activeOnHand = Math.max(0, activeProduced - activeRemoved)
  const totalLoggedUnits = recentLogs.reduce((sum, log) => sum + Math.floor(log.quantity * (log.batchStep.unitRatio || 1)), 0)
  const laborHours = recentShifts.reduce((sum, shift) => {
    const end = shift.endedAt || now
    return sum + Math.max(0, end.getTime() - shift.startedAt.getTime()) / (60 * 60 * 1000)
  }, 0)
  const unitsPerLaborHour = laborHours > 0 ? Math.round(totalLoggedUnits / laborHours) : 0

  const staleBatches = activeForecasts
    .filter(batch => batch.staleDays === null || batch.staleDays >= 2 || (batch.pct != null && batch.pct >= 85))
    .sort((a, b) => (b.staleDays ?? 999) - (a.staleDays ?? 999))

  const materialPlan = Array.from(activeBatches.reduce((map, batch) => {
    const produced = getProducedBaseUnits(batch.steps as AnalyticsStep[])
    const remaining = Math.max(0, (batch.targetQuantity || 0) - produced)
    if (!remaining) return map

    batch.recipe.steps.forEach((step) => {
      step.materials.forEach((material) => {
        const key = `${material.name}|${material.unit}`
        const current = map.get(key) || { name: material.name, unit: material.unit, quantity: 0, batches: new Set<string>() }
        current.quantity += material.quantityPerUnit * remaining
        current.batches.add(batch.name)
        map.set(key, current)
      })
    })

    return map
  }, new Map<string, { name: string; unit: string; quantity: number; batches: Set<string> }>()).values())
    .map(item => ({ ...item, batches: Array.from(item.batches) }))
    .sort((a, b) => b.quantity - a.quantity)

  const completionPct = historicalResults.length
    ? Math.round((historicalResults.reduce((sum, result) => sum + result.produced, 0) / historicalResults.reduce((sum, result) => sum + result.target, 0)) * 100)
    : 0
  const shortTotal = historicalResults.reduce((sum, result) => sum + (result.difference < 0 ? Math.abs(result.difference) : 0), 0)
  const overTotal = historicalResults.reduce((sum, result) => sum + (result.difference > 0 ? result.difference : 0), 0)

  return (
    <AppShell session={session} organizationName={organizationName || undefined}>
      <main className="max-w-6xl mx-auto px-4 py-5">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Admin</p>
            <h1 className="text-xl font-bold tracking-tight text-foreground">Analytics</h1>
            <p className="text-sm text-muted-foreground">Backfilled from existing batches, logs, shifts, recipe relations, and removals.</p>
          </div>
          <Link href="/history" className="bf-btn bf-btn-secondary bf-btn-sm self-start sm:self-auto">
            Batch History
          </Link>
        </div>

        <div className="mb-5 grid grid-cols-2 gap-2 lg:grid-cols-4">
          <StatCard label="Active Batches" value={activeBatches.length} detail={`${activeForecasts.filter(batch => batch.velocity > 0).length} with velocity`} />
          <StatCard label="7d Logged" value={formatNumber(totalLoggedUnits)} detail={`${recentLogs.length} progress logs`} tone="good" />
          <StatCard label="90d Yield" value={`${completionPct}%`} detail={`${formatNumber(shortTotal)} short · ${formatNumber(overTotal)} over`} tone={completionPct >= 95 ? 'good' : 'warn'} />
          <StatCard label="Units / Labor Hr" value={unitsPerLaborHour || '—'} detail={`${Math.round(laborHours)} hours tracked`} />
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          <section className="lg:col-span-2 rounded-xl border border-border bg-card p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-foreground">Active Batch Forecast</h2>
                <p className="text-xs text-muted-foreground">ETA uses the last 7 days of output-step logs.</p>
              </div>
            </div>
            <div className="space-y-3">
              {activeForecasts.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">No active batches.</p>
              ) : activeForecasts.map(batch => (
                <Link key={batch.id} href={`/batches/${batch.id}`} className="block rounded-xl border border-border bg-muted/20 p-3 hover:border-foreground/20">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-semibold text-foreground">{batch.name}</h3>
                      <p className="text-xs text-muted-foreground">{batch.recipe} · bottleneck: {batch.bottleneck}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold tabular-nums text-foreground">{batch.pct == null ? 'Open' : `${batch.pct}%`}</p>
                      <p className="text-[10px] text-muted-foreground">{formatDate(batch.eta)}</p>
                    </div>
                  </div>
                  <div className="mt-3 h-2 rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.min(batch.pct || 0, 100)}%` }} />
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-2 text-[10px]">
                    <div><span className="text-muted-foreground">Produced</span><p className="font-semibold tabular-nums text-foreground">{formatNumber(batch.produced)}</p></div>
                    <div><span className="text-muted-foreground">Remaining</span><p className="font-semibold tabular-nums text-foreground">{batch.remaining == null ? 'Open' : formatNumber(batch.remaining)}</p></div>
                    <div><span className="text-muted-foreground">Pace</span><p className="font-semibold tabular-nums text-foreground">{formatNumber(batch.velocity)}/day</p></div>
                  </div>
                  <p className="mt-2 text-[10px] text-muted-foreground">{formatDays(batch.daysRemaining)}</p>
                </Link>
              ))}
            </div>
          </section>

          <section className="rounded-xl border border-border bg-card p-4">
            <h2 className="text-sm font-semibold text-foreground">Watchlist</h2>
            <p className="text-xs text-muted-foreground">Stale or nearly done active batches.</p>
            <div className="mt-3 space-y-2">
              {staleBatches.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">Nothing stale right now.</p>
              ) : staleBatches.slice(0, 8).map(batch => (
                <Link key={batch.id} href={`/batches/${batch.id}`} className="block rounded-lg bg-muted/35 px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-xs font-semibold text-foreground">{batch.name}</p>
                    <span className="text-[10px] font-semibold tabular-nums text-amber-600 dark:text-amber-400">{batch.pct ?? 0}%</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    {batch.staleDays === null ? 'No logged movement' : `${batch.staleDays}d since movement`}
                  </p>
                </Link>
              ))}
            </div>
          </section>

          <section className="rounded-xl border border-border bg-card p-4">
            <h2 className="text-sm font-semibold text-foreground">Worker Contribution</h2>
            <p className="text-xs text-muted-foreground">Last 7 days, converted to base units.</p>
            <div className="mt-3 space-y-2">
              {workerContribution.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">No logs this week.</p>
              ) : workerContribution.slice(0, 8).map(worker => (
                <div key={worker.id} className="rounded-lg bg-muted/35 px-3 py-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-foreground">{worker.name}</p>
                    <p className="text-xs font-bold tabular-nums text-emerald-600 dark:text-emerald-400">{formatNumber(worker.units)}</p>
                  </div>
                  <p className="text-[10px] text-muted-foreground">{worker.logs} logs · {worker.batches.slice(0, 2).join(', ')}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="lg:col-span-2 rounded-xl border border-border bg-card p-4">
            <h2 className="text-sm font-semibold text-foreground">Recipe Yield</h2>
            <p className="text-xs text-muted-foreground">Last 90 days, completed and cancelled fixed-target batches.</p>
            <div className="mt-3 space-y-2">
              {recipeYield.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">No fixed-target history yet.</p>
              ) : recipeYield.slice(0, 8).map(recipe => {
                const pct = recipe.target > 0 ? Math.round((recipe.produced / recipe.target) * 100) : 0
                return (
                  <div key={recipe.recipe} className="rounded-lg bg-muted/35 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold text-foreground">{recipe.recipe}</p>
                        <p className="text-[10px] text-muted-foreground">{recipe.batches} batches · {formatNumber(recipe.short)} short · {formatNumber(recipe.over)} over</p>
                      </div>
                      <p className="text-sm font-bold tabular-nums text-foreground">{pct}%</p>
                    </div>
                    <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
                      <div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.min(pct, 100)}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </section>

          <section className="rounded-xl border border-border bg-card p-4">
            <h2 className="text-sm font-semibold text-foreground">Outbound / On Hand</h2>
            <p className="text-xs text-muted-foreground">Removal ledger and active inventory.</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="rounded-lg bg-muted/35 px-3 py-2">
                <p className="text-[10px] text-muted-foreground">Active on hand</p>
                <p className="text-lg font-bold tabular-nums text-foreground">{formatNumber(activeOnHand)}</p>
              </div>
              <div className="rounded-lg bg-muted/35 px-3 py-2">
                <p className="text-[10px] text-muted-foreground">30d removed</p>
                <p className="text-lg font-bold tabular-nums text-foreground">{formatNumber(recentRemovals.reduce((sum, r) => sum + r.quantity, 0))}</p>
              </div>
            </div>
            <div className="mt-3 space-y-2">
              {removalsByReason.map(reason => (
                <div key={reason.reason} className="flex items-center justify-between rounded-lg bg-muted/35 px-3 py-2">
                  <p className="text-xs font-semibold text-foreground">{reason.reason}</p>
                  <p className="text-xs font-bold tabular-nums text-foreground">{formatNumber(reason.quantity)}</p>
                </div>
              ))}
              {removalsByReason.length === 0 && <p className="py-4 text-center text-sm text-muted-foreground">No removals in the last 30 days.</p>}
            </div>
          </section>

          <section className="lg:col-span-3 rounded-xl border border-border bg-card p-4">
            <h2 className="text-sm font-semibold text-foreground">Material Planning</h2>
            <p className="text-xs text-muted-foreground">Backfilled from recipe materials against active batch remaining target. Missing materials show as not tracked yet.</p>
            {materialPlan.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No structured recipe materials found for active remaining work yet.</p>
            ) : (
              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {materialPlan.slice(0, 9).map(material => (
                  <div key={`${material.name}-${material.unit}`} className="rounded-lg bg-muted/35 px-3 py-2">
                    <p className="text-xs font-semibold text-foreground">{material.name}</p>
                    <p className="text-lg font-bold tabular-nums text-foreground">{formatNumber(material.quantity)} <span className="text-xs font-medium text-muted-foreground">{material.unit}</span></p>
                    <p className="truncate text-[10px] text-muted-foreground">{material.batches.slice(0, 3).join(', ')}</p>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </main>
    </AppShell>
  )
}
