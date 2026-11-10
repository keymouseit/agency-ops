import { NextResponse } from 'next/server'
import { auth, authorizeRole } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { logger } from '@/lib/logger'
import { logTeamMemberChange, getClientIP } from '@/lib/audit'

import { sortByEmployeeNo } from '@/lib/employee-order'
import {
  TEAM_EDITOR_ROLES,
  canAssignRole,
  parseOptionalDate,
  parseOptionalDesignation,
} from '@/lib/team-permissions'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Sign in required.' }, { status: 401 })
    }
    const members = sortByEmployeeNo(
      await prisma.teamMember.findMany({
        where: { active: true },
        select: { id: true, name: true, email: true, role: true },
      })
    )
    return NextResponse.json(members, {
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function POST(req: Request) {
  const startTime = Date.now()
  logger.logApiRequest('POST', '/api/team', undefined)

  const authResult = await authorizeRole(TEAM_EDITOR_ROLES)
  if (authResult instanceof NextResponse) {
    logger.logApiResponse('POST', '/api/team', authResult.status, Date.now() - startTime)
    return authResult
  }
  const actorRole = authResult.role

  const data = await req.json()
  logger.info('Creating team member', { name: data.name, email: data.email, role: data.role })

  // Validate required fields
  if (!data.name || !data.email || !data.role) {
    return NextResponse.json(
      { error: 'Name, email, and role are required' },
      { status: 400 }
    )
  }

  // HR may create members, but never with the Founder/Manager role
  if (!canAssignRole(actorRole, data.role)) {
    return NextResponse.json(
      { error: 'You do not have permission to create a member with this role.' },
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

  // Check if email already exists
  const existing = await prisma.teamMember.findUnique({
    where: { email: data.email },
  })

  if (existing) {
    logger.warn('Team member creation failed - email already exists', { email: data.email })
    logger.logApiResponse('POST', '/api/team', 400, Date.now() - startTime)
    return NextResponse.json(
      { error: 'A team member with this email already exists' },
      { status: 400 }
    )
  }

  // Hash password if provided
  let hashedPassword: string | null = null
  if (data.password) {
    hashedPassword = await bcrypt.hash(data.password, 10)
  }

  // Create team member
  const member = await prisma.teamMember.create({
    data: {
      name: data.name,
      email: data.email,
      role: data.role,
      active: data.active !== false, // Default to true
      birthday: birthdayParsed.value ?? null,
      joiningDate: joiningParsed.value ?? null,
      designation: designationParsed.value ?? null,
      attendanceExcluded: data.attendanceExcluded === true,
    },
  })

  logger.info('Team member created successfully', { memberId: member.id, name: member.name })

  // Log audit trail
  await logTeamMemberChange(
    'created',
    member.id,
    member.name,
    undefined,
    req
  )

  // Create user account if password provided
  if (hashedPassword) {
    try {
      await prisma.userAccount.create({
        data: {
          memberId: member.id,
          passwordHash: hashedPassword,
        },
      })
      logger.info('User account created successfully', { memberId: member.id })
    } catch (err) {
      // User account creation failed, but member was created
      logger.error('User account creation failed', err as Error, { memberId: member.id })
      logger.logApiResponse('POST', '/api/team', 200, Date.now() - startTime)
      return NextResponse.json({
        success: true,
        warning: 'Team member created but user account setup failed. Please try setting password again.',
        member: {
          ...member,
          createdAt: member.createdAt.toISOString(),
        }
      })
    }
  }

  logger.logApiResponse('POST', '/api/team', 200, Date.now() - startTime)
  return NextResponse.json({
    success: true,
    member: {
      ...member,
      createdAt: member.createdAt.toISOString(),
    }
  })
}
