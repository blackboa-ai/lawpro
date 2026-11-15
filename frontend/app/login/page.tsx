"use client";

import { useState } from 'react'
import { login } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import { AuthFormLayout, AuthPasswordInput, AuthSubmit, authInputClass } from '../AuthForm'

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
    <AuthFormLayout>
      {error && (
        <p role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}

      <form onSubmit={handleSubmit} className="space-y-4" aria-busy={loading}>
        <div>
          <label htmlFor="email" className="mb-1.5 block text-sm font-semibold text-slate-800">
            Email
          </label>
          <input
            type="email"
            id="email"
            name="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={authInputClass}
            placeholder="you@example.com"
            required
            disabled={loading}
          />
        </div>

        <AuthPasswordInput
          autoComplete="current-password"
          value={password}
          onChange={event => setPassword(event.target.value)}
          disabled={loading}
        />
        <AuthSubmit loading={loading} label="Sign in" pendingLabel="Signing in…" />
      </form>
    </AuthFormLayout>
  )
}
