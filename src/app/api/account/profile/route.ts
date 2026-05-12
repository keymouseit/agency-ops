import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

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
    const updated = await prisma.teamMember.update({
      where: { id: session.user.id },
      data: {
        name: name.trim(),
        email: email.trim().toLowerCase(),
      }
    })

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
