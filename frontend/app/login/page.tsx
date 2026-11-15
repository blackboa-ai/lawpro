"use client";

import Link from 'next/link'
import { useState } from 'react'
import { login } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login: authLogin } = useAuth()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    
    try {
      const data = await login({ email, password })
      authLogin(data.access_token)
    } catch (err: any) {
      setError(err.message || 'Invalid credentials')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-md rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-8">
      <h1 className="mb-6 text-center text-3xl font-semibold tracking-tight">Sign In</h1>
      
      {error && (
        <div role="alert" className="bg-red-100 border border-red-400 text-red-700 px-3 py-2 rounded mb-4">
          {error}
        </div>
      )}
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium mb-1">
            Email
          </label>
          <input
            type="email"
            id="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-slate-300 min-h-12 px-3 py-2.5 text-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-700"
            placeholder="your@email.com"
            required
            disabled={loading}
          />
        </div>
        
        <div>
          <label htmlFor="password" className="block text-sm font-medium mb-1">
            Password
          </label>
          <input
            type="password"
            id="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-slate-300 min-h-12 px-3 py-2.5 text-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-700"
            required
            disabled={loading}
          />
        </div>
        
        <button
          type="submit"
          className="w-full rounded-lg min-h-12 bg-slate-900 py-2.5 font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
          disabled={loading}
        >
          {loading ? 'Signing in...' : 'Sign In'}
        </button>
      </form>
      
      <div className="mt-4 text-center">
        <Link href="/register" className="inline-flex min-h-11 items-center justify-center text-sm font-medium text-slate-700 underline underline-offset-4">
          Don't have an account? Register
        </Link>
      </div>
    </div>
  )
}