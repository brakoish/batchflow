import { NextResponse } from 'next/server'

const AUTH_COOKIE_NAMES = [
  'workerId',
  'next-auth.session-token',
  '__Secure-next-auth.session-token',
  'next-auth.csrf-token',
  '__Host-next-auth.csrf-token',
  'next-auth.callback-url',
  '__Secure-next-auth.callback-url',
]

function logoutResponse(requestUrl: string) {
  const response = NextResponse.redirect(new URL('/', requestUrl))
  const expires = new Date(0)

  AUTH_COOKIE_NAMES.forEach((name) => {
    response.cookies.set(name, '', {
      path: '/',
      secure: name.startsWith('__Secure-') || name.startsWith('__Host-'),
      expires,
      maxAge: 0,
    })
  })

  response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate')
  return response
}

export async function POST(request: Request) {
  return logoutResponse(request.url)
}

export async function GET(request: Request) {
  return logoutResponse(request.url)
}
