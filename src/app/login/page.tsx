import { Suspense } from 'react'
import { getBranding } from '@/lib/branding'
import LoginForm from './LoginForm'

export default async function LoginPage() {
  const branding = await getBranding()

  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="h-8 w-8 rounded-full border-2 border-gray-200 border-t-gray-900 animate-spin" />
      </div>
    }>
      <LoginForm branding={branding} />
    </Suspense>
  )
}
