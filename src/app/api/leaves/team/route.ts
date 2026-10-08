import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { sortByEmployeeNo } from '@/lib/employee-order'

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
