import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import BatchCreator from './BatchCreator'
import { ArrowLeftIcon } from '@heroicons/react/24/solid'

export default async function NewBatchPage() {
  const session = await getSession()

  if (!session) {
    redirect('/')
  }

  if (session.role !== 'OWNER') {
    redirect('/batches')
  }

  const recipes = await prisma.recipe.findMany({
    include: {
      steps: {
        orderBy: {
          order: 'asc',
        },
      },
    },
    orderBy: {
      name: 'asc',
    },
  })

  return (
    <div className="min-h-screen bg-zinc-950">
      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/dashboard"
            className="inline-flex items-center text-zinc-400 hover:text-white mb-4 text-sm"
          >
            <ArrowLeftIcon className="w-4 h-4 inline mr-1" />Back to Dashboard
          </Link>
          <h1 className="text-3xl font-bold text-white mb-2">
            Create New Batch
          </h1>
          <p className="text-zinc-400">
            Select a recipe and configure your batch
          </p>
        </div>

        {recipes.length === 0 ? (
          <div className="bg-zinc-900 rounded-2xl p-12 border border-zinc-800 text-center">
            <p className="text-zinc-400 mb-4">
              No recipes available. Create a recipe first.
            </p>
            <Link
              href="/recipes"
              className="inline-block px-6 py-3 rounded-xl bg-green-600 hover:bg-green-500 text-white font-semibold transition-colors"
            >
              Go to Recipes
            </Link>
          </div>
        ) : (
          <BatchCreator recipes={recipes} />
        )}
      </div>
    </div>
  )
}
