import { NextResponse } from 'next/server'

// Turns the errors thrown by requireSession/requireOwner/... into the right
// HTTP status, so an expired sign-in reads as "sign in again" instead of
// "Internal server error". Returns null for every other error.
export function authErrorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : ''
  if (message === 'Unauthorized') {
    return NextResponse.json({ error: 'Your session has expired. Please sign in again.' }, { status: 401 })
  }
  if (message.startsWith('Forbidden') || message === 'No organization associated with user') {
    return NextResponse.json({ error: "You don't have access to do that." }, { status: 403 })
  }
  return null
}
