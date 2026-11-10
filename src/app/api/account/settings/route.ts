import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'

/**
 * Self-service profile edits are disabled: an employee's name and email (and
 * designation, birthday, joining date) can only be changed by HR/Admin via
 * PATCH /api/team/[id]. This endpoint stays only to return a clear error to
 * any old client that still calls it.
 */
export async function PATCH(req: Request) {
  const session = await auth()

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let data: Record<string, unknown> = {}
  try {
    const body = await req.json()
    if (body && typeof body === 'object') data = body as Record<string, unknown>
  } catch {
    // empty or invalid body — fall through
  }

  if ('name' in data || 'email' in data) {
    return NextResponse.json(
      { error: 'You cannot change your own name or email. Please contact HR or Admin.' },
      { status: 403 },
    )
  }

  return NextResponse.json(
    { error: 'No self-editable profile fields. Please contact HR or Admin to update your profile.' },
    { status: 400 },
  )
}
