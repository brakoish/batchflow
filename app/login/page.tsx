'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [emailSent, setEmailSent] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const callbackUrl = searchParams.get('callbackUrl') || '/dashboard'

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) {
      setError('Email is required')
      return
    }

    setLoading(true)
    setError('')

    try {
      const result = await signIn('email', {
        email: email.trim(),
        redirect: false,
        callbackUrl,
      })

      if (result?.error) {
        setError(result.error)
      } else {
        setEmailSent(true)
      }
    } catch (err) {
      setError('Failed to send magic link')
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleSignIn = async () => {
    setLoading(true)
    setError('')

    try {
      await signIn('google', {
        callbackUrl,
      })
    } catch (err) {
      setError('Failed to sign in with Google')
      setLoading(false)
    }
  }

  if (emailSent) {
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
              We sent a magic link to <span className="font-medium text-foreground">{email}</span>
            </p>
          </div>

          <div className="bg-muted rounded-lg p-6 mb-6">
            <p className="text-sm text-foreground">
              Click the link in your email to sign in. The link will expire in 24 hours.
            </p>
          </div>

          <button
            onClick={() => setEmailSent(false)}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Use a different email
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-dvh bg-background flex flex-col items-center justify-center px-6 py-8">
      <div className="w-full max-w-md">
        {/* Brand */}
        <div className="text-center mb-10">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" className="w-16 h-16 mx-auto mb-4 text-foreground" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="12" y="12" width="32" height="32" rx="6" fill="currentColor" stroke="none"/>
            <rect x="56" y="12" width="32" height="32" rx="6"/>
            <rect x="12" y="56" width="32" height="32" rx="6"/>
            <path d="M64 56h16a6 6 0 0 1 6 6v16a6 6 0 0 1-6 6H64a6 6 0 0 1-6-6V62a6 6 0 0 1 6-6z"/>
          </svg>
          <h1 className="text-2xl font-semibold text-foreground">Welcome to BatchFlow</h1>
          <p className="text-sm text-muted-foreground mt-2">
            Sign in to manage your batches
          </p>
        </div>

        {/* Email Sign In Form */}
        <form onSubmit={handleEmailSignIn} className="space-y-4 mb-6">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-foreground mb-2">
              Email Address
            </label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full px-4 py-3 rounded-lg bg-muted text-foreground placeholder:text-muted-foreground border border-border focus:outline-none focus:ring-2 focus:ring-foreground"
              disabled={loading}
              autoFocus
            />
          </div>

          {error && (
            <p className="text-destructive text-sm font-medium">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading || !email.trim()}
            className="w-full py-3 rounded-lg bg-foreground text-background font-medium hover:opacity-90 active:scale-[0.98] transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? 'Sending...' : 'Send magic link'}
          </button>
        </form>

        {/* Divider */}
        <div className="relative mb-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-background text-muted-foreground">Or continue with</span>
          </div>
        </div>

        {/* Google Sign In */}
        <button
          onClick={handleGoogleSignIn}
          disabled={loading}
          className="w-full py-3 rounded-lg bg-muted text-foreground font-medium hover:bg-muted/80 active:scale-[0.98] transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-3"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Sign in with Google
        </button>

        {/* Worker PIN Login Link */}
        <div className="mt-8 text-center">
          <p className="text-sm text-muted-foreground">
            Factory worker?{' '}
            <Link href="/" className="text-foreground font-medium hover:underline">
              Sign in with PIN
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
