import { NextResponse } from 'next/server'
import { authorizeRole } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { logger } from '@/lib/logger'
import { logTeamMemberChange, captureChanges, getClientIP } from '@/lib/audit'
import {
  TEAM_EDITOR_ROLES,
  canAssignRole,
  canEditMember,
  parseOptionalDate,
  parseOptionalDesignation,
} from '@/lib/team-permissions'

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const authResult = await authorizeRole(TEAM_EDITOR_ROLES)
  if (authResult instanceof NextResponse) return authResult
  const actorRole = authResult.role

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

  // HR cannot edit Founder/Manager members at all (profile, role, or password)
  if (!canEditMember(actorRole, member.role)) {
    return NextResponse.json(
      { error: 'You do not have permission to edit this member.' },
      { status: 403 }
    )
  }
  // ...and cannot promote anyone to Founder/Manager
  if (data.role !== undefined && data.role !== member.role && !canAssignRole(actorRole, data.role)) {
    return NextResponse.json(
      { error: 'You do not have permission to assign this role.' },
      { status: 403 }
    )
  }

  const birthdayParsed = parseOptionalDate(data.birthday)
  if ('error' in birthdayParsed) {
    return NextResponse.json({ error: `Birthday: ${birthdayParsed.error}` }, { status: 400 })
  }
  const joiningParsed = parseOptionalDate(data.joiningDate)
  if ('error' in joiningParsed) {
    return NextResponse.json({ error: `Joining date: ${joiningParsed.error}` }, { status: 400 })
  }
  const designationParsed = parseOptionalDesignation(data.designation)
  if ('error' in designationParsed) {
    return NextResponse.json({ error: designationParsed.error }, { status: 400 })
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
  if (birthdayParsed.value !== undefined) updateData.birthday = birthdayParsed.value
  if (joiningParsed.value !== undefined) updateData.joiningDate = joiningParsed.value
  if (designationParsed.value !== undefined) updateData.designation = designationParsed.value
  if (typeof data.attendanceExcluded === 'boolean') updateData.attendanceExcluded = data.attendanceExcluded

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
