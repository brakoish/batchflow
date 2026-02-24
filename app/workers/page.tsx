import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import WorkerManager from './WorkerManager'
import { ArrowLeftIcon } from '@heroicons/react/24/solid'

export default async function WorkersPage() {
  const session = await getSession()

  if (!session) {
    redirect('/')
  }

  if (session.role !== 'OWNER') {
    redirect('/batches')
  }

  const workers = await prisma.worker.findMany({
    select: {
      id: true,
      name: true,
      pin: true,
      role: true,
      createdAt: true,
    },
    orderBy: {
      name: 'asc',
    },
  })

  return (
    <div className="min-h-screen bg-zinc-950">
      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/dashboard"
            className="inline-flex items-center text-zinc-400 hover:text-white mb-4 text-sm"
          >
            <ArrowLeftIcon className="w-4 h-4 inline mr-1" />Back to Dashboard
          </Link>
          <h1 className="text-3xl font-bold text-white mb-2">
            Worker Management
          </h1>
          <p className="text-zinc-400">
            Manage workers and their PIN access
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Worker List */}
          <div>
            <h2 className="text-xl font-semibold text-white mb-4">Workers</h2>
            {workers.length === 0 ? (
              <div className="bg-zinc-900 rounded-2xl p-8 border border-zinc-800 text-center">
                <p className="text-zinc-500">No workers yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {workers.map((worker) => (
                  <div
                    key={worker.id}
                    className="bg-zinc-900 rounded-2xl p-5 border border-zinc-800"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="text-lg font-semibold text-white mb-1">
                          {worker.name}
                        </h3>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-zinc-500">
                            PIN: {worker.pin}
                          </span>
                          <span className="text-zinc-700">•</span>
                          <span
                            className={`text-xs px-2 py-1 rounded-full ${
                              worker.role === 'OWNER'
                                ? 'bg-purple-900/30 text-purple-400'
                                : 'bg-blue-900/30 text-blue-400'
                            }`}
                          >
                            {worker.role}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Add Worker Form */}
          <WorkerManager />
        </div>
      </div>
    </div>
  )
}
