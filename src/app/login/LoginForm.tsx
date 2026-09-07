'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useSearchParams } from 'next/navigation'

export default function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const searchParams = useSearchParams()
  const callbackUrl = searchParams.get('callbackUrl') ?? '/me'

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const result = await signIn('credentials', {
      email,
      password,
      redirect: false,
    })

    if (result?.error) {
      setLoading(false)
      setError('Incorrect email or password. Check your credentials and try again.')
    } else {
      window.location.href = callbackUrl
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-gray-50 flex items-center justify-center p-4">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-24 left-1/4 h-72 w-72 rounded-full bg-violet-200/40 blur-3xl" />
        <div className="absolute bottom-0 right-1/4 h-80 w-80 rounded-full bg-blue-200/35 blur-3xl" />
        <div className="absolute top-1/2 left-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-teal-100/50 blur-3xl" />
      </div>

      <div className="relative w-full max-w-[26rem]">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-gray-900 text-white text-sm font-bold shadow-md mb-4">
            AO
          </div>
          <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">Agency Ops</h1>
          <p className="text-sm text-gray-500 mt-1">KeyMouse IT · Internal platform</p>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white shadow-xl shadow-gray-200/60 overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-violet-400 via-blue-400 to-teal-400" />

          <div className="p-8">
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-gray-900">Sign in</h2>
              <p className="text-sm text-gray-500 mt-0.5">Use your team email and password.</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="label">Email</label>
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="login-input input bg-gray-50/80 focus:bg-white"
                  placeholder="you@keymouse.com"
                />
              </div>

              <div>
                <label className="label">Password</label>
                <input
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="login-input input bg-gray-50/80 focus:bg-white"
                  placeholder="••••••••"
                />
              </div>

              {error && (
                <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3.5 py-3">
                  <span className="text-red-500 shrink-0" aria-hidden>
                    ⚠
                  </span>
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !email || !password}
                className="btn-primary w-full py-3 mt-1 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
              >
                {loading ? 'Signing in…' : 'Sign in →'}
              </button>
            </form>

            <div className="mt-6 pt-5 border-t border-gray-100">
              <p className="text-xs text-gray-500 text-center leading-relaxed">
                Can&apos;t log in? Ask Shiven to reset your password.
              </p>
            </div>
          </div>
        </div>

        <p className="text-center text-[11px] text-gray-400 mt-6">
          KeyMouse IT · Agency Ops · Internal use only
        </p>
      </div>

      <style jsx global>{`
        .login-input:-webkit-autofill,
        .login-input:-webkit-autofill:hover,
        .login-input:-webkit-autofill:focus {
          -webkit-text-fill-color: #111827;
          -webkit-box-shadow: 0 0 0 1000px #f9fafb inset;
          transition: background-color 5000s ease-in-out 0s;
          caret-color: #111827;
        }
      `}</style>
    </div>
  )
}
