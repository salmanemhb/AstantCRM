import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { PageErrorBoundary } from '@/components/error-boundary'
import { ToastProvider } from '@/components/toast'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Astant CRM',
  description: 'AI-powered investor outreach platform by Astant',
  icons: {
    icon: '/astant-logo.jpg',
    shortcut: '/astant-logo.jpg',
    apple: '/astant-logo.jpg',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <PageErrorBoundary>
          <ToastProvider>
            <div className="min-h-screen bg-gray-50">
              {children}
            </div>
          </ToastProvider>
        </PageErrorBoundary>
      </body>
    </html>
  )
}
