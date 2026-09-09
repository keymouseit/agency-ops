import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { ROLES } from '@/lib/utils'
import {
  addDailyTaskTypeToRole,
  getDailyTaskTypeCatalog,
  removeDailyTaskTypeFromRole,
} from '@/lib/daily-task-types'

const SETTINGS_ROLES = ['Founder', 'Manager']

export async function GET() {
  const session = await auth()
  if (!session?.user?.id || !SETTINGS_ROLES.includes(session.user.role || '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  try {
    const catalog = await getDailyTaskTypeCatalog()
    return NextResponse.json({ ...catalog, roles: ROLES, canEdit: session.user.role === 'Founder' })
  } catch (error) {
    console.error('Failed to load daily task types:', error)
    return NextResponse.json({ error: 'Failed to load daily task types' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id || session.user.role !== 'Founder') {
    return NextResponse.json({ error: 'Only a Founder can change daily task types.' }, { status: 403 })
  }
  const body = await req.json().catch(() => ({}))
  try {
    const catalog = await addDailyTaskTypeToRole({
      role: String(body.role || ''),
      label: String(body.label || ''),
      groupLabel: String(body.groupLabel || ''),
      value: typeof body.value === 'string' ? body.value : undefined,
    })
    return NextResponse.json(catalog)
  } catch (error) {
    const err = error as { message?: string; status?: number }
    return NextResponse.json({ error: err.message || 'Failed to add type' }, { status: err.status || 500 })
  }
}

export async function DELETE(req: Request) {
  const session = await auth()
  if (!session?.user?.id || session.user.role !== 'Founder') {
    return NextResponse.json({ error: 'Only a Founder can change daily task types.' }, { status: 403 })
  }
  const body = await req.json().catch(() => ({}))
  const value = String(body.value || '')
  const role = String(body.role || '')
  if (!value || !role) {
    return NextResponse.json({ error: 'Type and role are required' }, { status: 400 })
  }
  try {
    const catalog = await removeDailyTaskTypeFromRole(value, role)
    return NextResponse.json(catalog)
  } catch (error) {
    console.error('Failed to remove daily task type:', error)
    return NextResponse.json({ error: 'Failed to remove type' }, { status: 500 })
  }
}
