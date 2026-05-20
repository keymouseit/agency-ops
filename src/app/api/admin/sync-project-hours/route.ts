import { NextResponse } from 'next/server'
import { checkRole } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * One-time sync endpoint to backfill project.actualHours from daily task logs
 * This recalculates actual hours for ALL projects from ALL daily tasks
 */
export async function POST(req: Request) {
  // Only founders can run this
  const deny = await checkRole(['Founder'])
  if (deny) return deny

  try {
    // Get all projects
    const projects = await prisma.project.findMany({
      select: { id: true, name: true }
    })

    const results: Array<{
      projectId: string
      projectName: string
      actualHours: number
    }> = []

    for (const project of projects) {
      // Sum ALL actual hours ever logged against this project
      const agg = await prisma.dailyTask.aggregate({
        where: {
          projectId: project.id,
          actualHours: { not: null }
        },
        _sum: { actualHours: true },
      })

      const totalHours = agg._sum.actualHours ?? 0

      // Update the project
      await prisma.project.update({
        where: { id: project.id },
        data: { actualHours: totalHours },
      })

      results.push({
        projectId: project.id,
        projectName: project.name,
        actualHours: totalHours
      })
    }

    return NextResponse.json({
      success: true,
      message: `Synced actual hours for ${projects.length} projects`,
      results
    })
  } catch (error) {
    console.error('Error syncing project hours:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
