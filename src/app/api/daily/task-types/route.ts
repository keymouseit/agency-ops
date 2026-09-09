import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getDailyTaskTypeCatalog } from '@/lib/daily-task-types'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Sign in required.' }, { status: 401 })
  }
  try {
    const catalog = await getDailyTaskTypeCatalog()
    return NextResponse.json(catalog)
  } catch (error) {
    console.error('Failed to load daily task types:', error)
    return NextResponse.json({ error: 'Failed to load daily task types' }, { status: 500 })
  }
}
