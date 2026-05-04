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
            Your last loaded data is still available in batches you've already opened.
          </p>
        </div>
        <button
          onClick={() => window.location.reload()}
          className="w-full rounded-xl bg-foreground text-background py-3 px-6 font-medium active:scale-[0.98] transition-transform"
        >
          Try Again
        </button>
        <p className="text-xs text-muted-foreground">
          Tip: log shifts and progress when you regain signal — nothing is lost.
        </p>
      </div>
    </div>
  )
}
