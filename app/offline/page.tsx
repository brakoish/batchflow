'use client'

export default function OfflinePage() {
  return (
    <div className="min-h-dvh flex items-center justify-center px-6 bg-background text-foreground">
      <div className="max-w-sm w-full text-center space-y-6">
        <div className="text-6xl">📡</div>
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold">You're offline</h1>
          <p className="text-muted-foreground text-sm leading-relaxed">
            BatchFlow needs a connection to sync your progress.
            Reconnect before recording work. Unsaved entries are not queued for automatic upload.
          </p>
        </div>
        <button
          onClick={() => window.location.reload()}
          className="bf-btn bf-btn-primary bf-btn-full"
        >
          Try Again
        </button>
        <p className="text-xs text-muted-foreground">
          Wait for a saved confirmation before leaving a recording screen.
        </p>
      </div>
    </div>
  )
}
