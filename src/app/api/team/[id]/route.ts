import { NextResponse } from 'next/server'
import { checkRole } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { logger } from '@/lib/logger'
import { logTeamMemberChange, captureChanges, getClientIP } from '@/lib/audit'

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const deny = await checkRole(['Founder', 'Manager'])
  if (deny) return deny

  const data = await req.json()

  // Check if member exists
  const member = await prisma.teamMember.findUnique({
    where: { id: params.id },
  })

  if (!member) {
    return NextResponse.json(
      { error: 'Team member not found' },
      { status: 404 }
    )
  }

  // If email is being changed, check for duplicates
  if (data.email && data.email !== member.email) {
    const existing = await prisma.teamMember.findUnique({
      where: { email: data.email },
    })

    if (existing) {
      return NextResponse.json(
        { error: 'A team member with this email already exists' },
        { status: 400 }
      )
    }
  }

  // Build update data
  const updateData: any = {}
  if (data.name !== undefined) updateData.name = data.name
  if (data.email !== undefined) updateData.email = data.email
  if (data.role !== undefined) updateData.role = data.role
  if (data.active !== undefined) updateData.active = data.active

  // Update team member
  const updated = await prisma.teamMember.update({
    where: { id: params.id },
    data: updateData,
  })

  // Log audit trail
  const changes = captureChanges(member, updateData)
  if (Object.keys(changes).length > 0) {
    // Determine action based on what changed
    const action = changes.active !== undefined
      ? (changes.active.new ? 'activated' : 'deactivated')
      : 'updated'

    await logTeamMemberChange(
      action,
      params.id,
      updated.name,
      changes,
      req
    )

    logger.info('Team member updated', { memberId: params.id, changes })
  }

  // Update password if provided
  if (data.password) {
    const hashedPassword = await bcrypt.hash(data.password, 10)

    try {
      // Check if user account exists
      const userAccount = await prisma.userAccount.findUnique({
        where: { memberId: params.id },
      })

      if (userAccount) {
        // Update existing account
        await prisma.userAccount.update({
          where: { memberId: params.id },
          data: { passwordHash: hashedPassword },
        })
      } else {
        // Create new account
        await prisma.userAccount.create({
          data: {
            memberId: params.id,
            passwordHash: hashedPassword,
          },
        })
      }

      // Log password change
      await logTeamMemberChange(
        'password_changed',
        params.id,
        updated.name,
        undefined,
        req
      )
      logger.info('Password changed for team member', { memberId: params.id })
    } catch (err) {
      // Password update failed, but member was updated
      return NextResponse.json({
        success: true,
        warning: 'Team member updated but password change failed. Please try again.',
        member: {
          ...updated,
          createdAt: updated.createdAt.toISOString(),
        }
      })
    }
  }

  return NextResponse.json({
    success: true,
    member: {
      ...updated,
      createdAt: updated.createdAt.toISOString(),
    }
  })
}
