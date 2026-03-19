'use client'

export default function VerifyPage() {
  return (
    <div className="min-h-dvh bg-background flex flex-col items-center justify-center px-6 py-8">
      <div className="w-full max-w-md text-center">
        {/* Brand */}
        <div className="mb-10">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" className="w-16 h-16 mx-auto mb-4 text-foreground" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="12" y="12" width="32" height="32" rx="6" fill="currentColor" stroke="none"/>
            <rect x="56" y="12" width="32" height="32" rx="6"/>
            <rect x="12" y="56" width="32" height="32" rx="6"/>
            <path d="M64 56h16a6 6 0 0 1 6 6v16a6 6 0 0 1-6 6H64a6 6 0 0 1-6-6V62a6 6 0 0 1 6-6z"/>
          </svg>
          <h1 className="text-2xl font-semibold text-foreground">Check your email</h1>
          <p className="text-sm text-muted-foreground mt-2">
            A sign-in link has been sent to your email address
          </p>
        </div>

        <div className="bg-muted rounded-lg p-6">
          <p className="text-sm text-foreground">
            Click the link in your email to sign in. The link will expire in 24 hours.
          </p>
        </div>
      </div>
    </div>
  )
}
