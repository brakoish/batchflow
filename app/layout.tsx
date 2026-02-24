import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'BatchFlow',
  description: 'Factory-style production workflow tracker',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
