import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logTeamMemberChange, captureChanges } from '@/lib/audit'

export async function PATCH(req: Request) {
  const session = await auth()

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const data = await req.json()
  const { name, email } = data

  // Validate
  if (!name || name.trim().length === 0) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 })
  }

  if (!email || !email.includes('@')) {
    return NextResponse.json({ error: 'Valid email is required' }, { status: 400 })
  }

  // Check if email is already used by another member
  if (email !== session.user.email) {
    const existing = await prisma.teamMember.findFirst({
      where: {
        email,
        id: { not: session.user.id }
      }
    })

    if (existing) {
      return NextResponse.json(
        { error: 'This email is already in use' },
        { status: 400 }
      )
    }
  }

  // Update member
  try {
    // Get current member data for audit logging
    const currentMember = await prisma.teamMember.findUnique({
      where: { id: session.user.id }
    })

    if (!currentMember) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 })
    }

    const updated = await prisma.teamMember.update({
      where: { id: session.user.id },
      data: {
        name: name.trim(),
        email: email.trim().toLowerCase(),
      }
    })

    // Capture changes for audit log
    const changes = captureChanges(currentMember, {
      name: name.trim(),
      email: email.trim().toLowerCase(),
    })

    // Log the change if there are any
    if (Object.keys(changes).length > 0) {
      await logTeamMemberChange(
        'updated',
        session.user.id,
        updated.name,
        changes,
        req
      )
    }

    return NextResponse.json({
      success: true,
      member: {
        id: updated.id,
        name: updated.name,
        email: updated.email,
        role: updated.role,
      }
    })
  } catch (error) {
    console.error('Profile update error:', error)
    return NextResponse.json(
      { error: 'Failed to update profile' },
      { status: 500 }
    )
  }
}
