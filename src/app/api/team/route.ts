import { NextResponse } from 'next/server'
import { checkRole } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

export async function POST(req: Request) {
  const deny = await checkRole(['Founder', 'Manager'])
  if (deny) return deny

  const data = await req.json()

  // Validate required fields
  if (!data.name || !data.email || !data.role) {
    return NextResponse.json(
      { error: 'Name, email, and role are required' },
      { status: 400 }
    )
  }

  // Check if email already exists
  const existing = await prisma.teamMember.findUnique({
    where: { email: data.email },
  })

  if (existing) {
    return NextResponse.json(
      { error: 'A team member with this email already exists' },
      { status: 400 }
    )
  }

  // Hash password if provided
  let hashedPassword = null
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
    },
  })

  // Create user account if password provided
  if (hashedPassword) {
    await prisma.userAccount.create({
      data: {
        memberId: member.id,
        email: data.email,
        password: hashedPassword,
      },
    })
  }

  return NextResponse.json(member)
}
