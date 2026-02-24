import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import Header from '@/app/components/Header'
import WorkerManager from './WorkerManager'

export default async function WorkersPage() {
  const session = await getSession()
  if (!session) redirect('/')
  if (session.role !== 'OWNER') redirect('/batches')

  const workers = await prisma.worker.findMany({
    select: { id: true, name: true, pin: true, role: true, createdAt: true },
    orderBy: { name: 'asc' },
  })

  return (
    <div className="min-h-dvh bg-zinc-950">
      <Header session={session} />
      <main className="max-w-5xl mx-auto px-4 py-5">
        <h1 className="text-lg font-semibold tracking-tight text-zinc-50 mb-5">Workers</h1>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="space-y-2.5">
            <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">Team</h2>
            {workers.map((worker) => (
              <div key={worker.id} className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-zinc-50">{worker.name}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-zinc-500 font-mono tabular-nums">{worker.pin}</span>
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${
                      worker.role === 'OWNER'
                        ? 'bg-purple-500/10 text-purple-400 border-purple-500/20'
                        : 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                    }`}>
                      {worker.role}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <WorkerManager />
        </div>
      </main>
    </div>
  )
}
