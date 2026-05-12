import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

export async function PATCH(req: Request) {
  const session = await auth()

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const data = await req.json()
  const { currentPassword, newPassword } = data

  // Validate
  if (!currentPassword || !newPassword) {
    return NextResponse.json(
      { error: 'Both current and new password are required' },
      { status: 400 }
    )
  }

  if (newPassword.length < 8) {
    return NextResponse.json(
      { error: 'New password must be at least 8 characters' },
      { status: 400 }
    )
  }

  if (currentPassword === newPassword) {
    return NextResponse.json(
      { error: 'New password must be different from current password' },
      { status: 400 }
    )
  }

  try {
    // Get user account
    const account = await prisma.userAccount.findFirst({
      where: { memberId: session.user.id }
    })

    if (!account) {
      return NextResponse.json(
        { error: 'User account not found' },
        { status: 404 }
      )
    }

    // Verify current password
    const valid = await bcrypt.compare(currentPassword, account.passwordHash)
    if (!valid) {
      return NextResponse.json(
        { error: 'Current password is incorrect' },
        { status: 400 }
      )
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10)

    // Update password
    await prisma.userAccount.update({
      where: { id: account.id },
      data: { passwordHash: hashedPassword }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Password change error:', error)
    return NextResponse.json(
      { error: 'Failed to change password' },
      { status: 500 }
    )
  }
}
