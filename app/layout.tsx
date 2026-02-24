import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'BatchFlow',
  description: 'Factory-style production workflow tracker',
  viewport: 'width=device-width, initial-scale=1, viewport-fit=cover',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="overflow-x-hidden">{children}</body>
    </html>
  )
}
