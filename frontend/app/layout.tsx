import './globals.css'
import './workspace.css'
import type { Metadata, Viewport } from 'next'
import Link from 'next/link'
import { Scale } from 'lucide-react'
import AccountNavigation from './AccountNavigation'
import { AuthProvider } from '@/context/AuthContext'

export const metadata: Metadata = {
  title: 'LawPro - Hearing Date Tracker',
  description: 'Professional hearing date tracker for Indian lawyers',
}

export const viewport: Viewport = { viewportFit: 'cover' }

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">
        <AuthProvider>
          <nav aria-label="Main navigation" className="workspace-nav">
            <div className="workspace-nav-inner">
              <Link href="/" className="workspace-brand">
                <Scale aria-hidden={true} size={21} />
                LawPro
              </Link>
              <AccountNavigation />
            </div>
          </nav>
          <main className="workspace-main py-8 sm:py-12">
            {children}
          </main>
        </AuthProvider>
      </body>
    </html>
  )
}
