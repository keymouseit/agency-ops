'use client'

import { useState } from 'react'
import { getSession, signIn } from 'next-auth/react'
import { useSearchParams } from 'next/navigation'
import type { Branding } from '@/lib/branding'

function homeForRole(role: string | undefined) {
  return role === 'Founder' || role === 'Manager' ? '/' : '/me'
}

function resolvePostLoginUrl(rawCallback: string | null, role: string | undefined) {
  const home = homeForRole(role)
  const callback =
    rawCallback?.startsWith('/') && !rawCallback.startsWith('//') && rawCallback !== '/login'
      ? rawCallback
      : null

  // Founders/Managers briefly hitting /me → server redirect('/') causes a client React
  // hooks flash on production. Send them home (or keep a non-/me callback).
  if (role === 'Founder' || role === 'Manager') {
    if (!callback || callback === '/me' || callback.startsWith('/me/')) return home
  }

  return callback ?? home
}

export default function LoginForm({ branding }: { branding: Branding }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const searchParams = useSearchParams()
  const rawCallback = searchParams.get('callbackUrl')

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    if (typeof document !== 'undefined') {
      ;(document.activeElement as HTMLElement | null)?.blur?.()
    }

    const result = await signIn('credentials', {
      email,
      password,
      redirect: false,
    })

    if (result?.error) {
      setLoading(false)
      setError('Incorrect email or password. Check your credentials and try again.')
    } else {
      const session = await getSession()
      window.location.href = resolvePostLoginUrl(rawCallback, session?.user?.role)
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
            {branding.initials}
          </div>
          <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">{branding.name}</h1>
          <p className="text-sm text-gray-500 mt-1">{branding.tagline}</p>
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
                  disabled={loading}
                  readOnly={loading}
                  className="login-input input bg-gray-50/80 focus:bg-white disabled:opacity-60 disabled:cursor-not-allowed"
                  placeholder="you@keymouse.com"
                />
              </div>

              <div>
                <label className="label">Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    disabled={loading}
                    readOnly={loading}
                    className="login-input input bg-gray-50/80 focus:bg-white disabled:opacity-60 disabled:cursor-not-allowed pr-11"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    disabled={loading}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    aria-pressed={showPassword}
                    className="absolute inset-y-0 right-0 flex items-center justify-center w-11 text-gray-400 hover:text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {showPassword ? (
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.75}
                          d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                        />
                      </svg>
                    ) : (
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.75}
                          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.75}
                          d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                        />
                      </svg>
                    )}
                  </button>
                </div>
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
          {branding.name} · Internal use only
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
