import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const REVIEWERS = ['Founder', 'HR', 'Manager']

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Sign in required.' }, { status: 401 })
    }
    if (!session.user.role || !REVIEWERS.includes(session.user.role)) {
      return NextResponse.json({ count: 0 })
    }

    const count = await prisma.leaveRequest.count({
      where: { status: 'pending' },
    })

    return NextResponse.json(
      { count },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (error: unknown) {
    console.error('Error counting pending leaves:', error)
    return NextResponse.json({ count: 0 })
  }
}
