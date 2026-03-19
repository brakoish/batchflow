import { DefaultSession } from 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      organizationId?: string | null
      role?: string
      workerId?: string | null
    } & DefaultSession['user']
  }

  interface User {
    organizationId?: string | null
    role?: string
    workerId?: string | null
  }
}
