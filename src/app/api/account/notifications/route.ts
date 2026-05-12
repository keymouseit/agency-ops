import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: Request) {
  const session = await auth()

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Get or create notification preferences
    let preferences = await prisma.notificationPreference.findUnique({
      where: { memberId: session.user.id }
    })

    // If no preferences exist, create default ones
    if (!preferences) {
      preferences = await prisma.notificationPreference.create({
        data: {
          memberId: session.user.id,
          // All defaults are true (set in schema)
        }
      })
    }

    return NextResponse.json({
      preferences: {
        projectAssigned: preferences.projectAssigned,
        estimateRequested: preferences.estimateRequested,
        estimateNeedsReview: preferences.estimateNeedsReview,
        qaTestFailed: preferences.qaTestFailed,
        qaTestPassed: preferences.qaTestPassed,
        releaseSignedOff: preferences.releaseSignedOff,
        deadlineApproaching: preferences.deadlineApproaching,
        missingEOD: preferences.missingEOD,
        missingMorningPlan: preferences.missingMorningPlan,
        weeklyCheckInDue: preferences.weeklyCheckInDue,
      }
    })
  } catch (error) {
    console.error('Failed to load notification preferences:', error)
    return NextResponse.json(
      { error: 'Failed to load preferences' },
      { status: 500 }
    )
  }
}

export async function PATCH(req: Request) {
  const session = await auth()

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const data = await req.json()

  try {
    // Upsert preferences
    const preferences = await prisma.notificationPreference.upsert({
      where: { memberId: session.user.id },
      create: {
        memberId: session.user.id,
        ...data
      },
      update: data
    })

    return NextResponse.json({ success: true, preferences })
  } catch (error) {
    console.error('Failed to update notification preferences:', error)
    return NextResponse.json(
      { error: 'Failed to update preferences' },
      { status: 500 }
    )
  }
}
