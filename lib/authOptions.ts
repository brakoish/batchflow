import { NextAuthOptions } from 'next-auth'
import { PrismaAdapter } from '@auth/prisma-adapter'
import EmailProvider from 'next-auth/providers/email'
import GoogleProvider from 'next-auth/providers/google'
import CredentialsProvider from 'next-auth/providers/credentials'
import { prisma } from '@/lib/prisma'

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    EmailProvider({
      server: process.env.EMAIL_SERVER,
      from: process.env.EMAIL_FROM,
    }),
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    }),
    CredentialsProvider({
      name: 'PIN',
      credentials: {
        pin: { label: 'PIN', type: 'text' },
      },
      async authorize(credentials) {
        if (!credentials?.pin || credentials.pin.length !== 4) {
          return null
        }

        const worker = await prisma.worker.findUnique({
          where: { pin: credentials.pin },
          include: { user: true },
        })

        if (!worker || !worker.user) {
          return null
        }

        return {
          id: worker.user.id,
          email: worker.user.email,
          name: worker.user.name,
          organizationId: worker.user.organizationId,
          role: worker.user.role,
          workerId: worker.id,
        }
      },
    }),
  ],
  pages: {
    signIn: '/login',
    verifyRequest: '/login/verify',
    newUser: '/org/new',
  },
  callbacks: {
    async session({ session, user }) {
      if (session.user) {
        const dbUser = await prisma.user.findUnique({
          where: { id: user.id },
          select: {
            id: true,
            email: true,
            name: true,
            image: true,
            organizationId: true,
            role: true,
            workerId: true,
          },
        })

        if (dbUser) {
          session.user.id = dbUser.id
          session.user.organizationId = dbUser.organizationId
          session.user.role = dbUser.role
          session.user.workerId = dbUser.workerId
        }
      }
      return session
    },
    async redirect({ url, baseUrl }) {
      // Redirect to org creation if no org
      if (url === baseUrl + '/api/auth/callback/email' || url === baseUrl + '/api/auth/callback/google') {
        return baseUrl + '/org/new'
      }
      if (url.startsWith(baseUrl)) return url
      if (url.startsWith('/')) return baseUrl + url
      return baseUrl
    },
  },
  session: {
    strategy: 'database',
  },
}
