import './globals.css'
import type { Metadata } from 'next'
import Link from 'next/link'
import { Scale } from 'lucide-react'
import { AuthProvider } from '@/context/AuthContext'

export const metadata: Metadata = {
  title: 'LawPro - Hearing Date Tracker',
  description: 'Professional hearing date tracker for Indian lawyers',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">
        <AuthProvider>
          <nav className="border-b border-slate-700 bg-slate-950 text-white">
            <div className="mx-auto flex max-w-6xl px-4 py-4 sm:px-8">
              <Link href="/" className="inline-flex items-center gap-3 text-xl font-semibold tracking-tight">
                <Scale aria-hidden={true} size={22} className="text-amber-300" />
                LawPro
              </Link>
            </div>
          </nav>
          <main className="mx-auto max-w-6xl px-4 py-8 sm:px-8 sm:py-12">
            {children}
          </main>
        </AuthProvider>
      </body>
    </html>
  )
}
