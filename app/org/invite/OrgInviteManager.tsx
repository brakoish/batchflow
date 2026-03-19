'use client'

import { useState } from 'react'
import { LinkIcon, UserPlusIcon } from '@heroicons/react/24/outline'
import { haptic } from '@/lib/haptic'

type Worker = {
  id: string
  name: string
  role: string
  createdAt: string
}

type Organization = {
  id: string
  name: string
  slug: string
  workers: Worker[]
}

export default function OrgInviteManager({
  organization,
}: {
  organization: Organization
}) {
  const [copied, setCopied] = useState(false)

  const inviteUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/join/${organization.slug}`

  const copyInviteLink = () => {
    navigator.clipboard.writeText(inviteUrl)
    haptic('light')
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="space-y-6">
      {/* Invite Link */}
      <div className="bg-muted p-4 rounded-lg border border-border">
        <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
          <LinkIcon className="w-4 h-4" />
          Invite Link
        </h2>
        <p className="text-xs text-muted-foreground mb-3">
          Share this link with workers to join your organization. They'll need their PIN to sign in.
        </p>
        <div className="flex gap-2">
          <input
            type="text"
            value={inviteUrl}
            readOnly
            className="flex-1 px-3 py-2 text-sm rounded-md bg-background text-foreground border border-border font-mono"
          />
          <button
            onClick={copyInviteLink}
            className="px-4 py-2 text-sm font-medium rounded-md bg-foreground text-background hover:opacity-90 transition-opacity"
          >
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
      </div>

      {/* Workers List */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <UserPlusIcon className="w-4 h-4" />
            Workers ({organization.workers.length})
          </h2>
        </div>

        <div className="space-y-2">
          {organization.workers.map((worker) => (
            <div
              key={worker.id}
              className="p-3 rounded-lg bg-muted border border-border"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {worker.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {worker.role === 'OWNER' ? 'Owner' : worker.role === 'SUPERVISOR' ? 'Supervisor' : 'Worker'}
                  </p>
                </div>
                <span className="text-xs text-muted-foreground">
                  Joined {new Date(worker.createdAt).toLocaleDateString()}
                </span>
              </div>
            </div>
          ))}
        </div>

        {organization.workers.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">
            No workers yet. Share the invite link to get started!
          </p>
        )}
      </div>

      <div className="bg-muted/50 p-4 rounded-lg border border-border">
        <h3 className="text-sm font-medium text-foreground mb-2">
          How to add workers
        </h3>
        <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
          <li>Go to the Workers page to create new worker accounts with PINs</li>
          <li>Share the invite link above with your workers</li>
          <li>Workers use their PIN to join your organization</li>
        </ol>
      </div>
    </div>
  )
}
