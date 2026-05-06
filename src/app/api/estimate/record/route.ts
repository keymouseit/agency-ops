import { notify } from '@/lib/notify'
import { NextResponse } from 'next/server'
import { checkRole } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(req: Request) {
  const deny = await checkRole(['Dev', 'Both', 'Founder'])
  if (deny) return deny

  const data = await req.json()

  const rawHours = data.lines.reduce((s: number, l: { estimatedHours: number }) => s + (Number(l.estimatedHours) || 0), 0)
  const bufferedHours = Math.ceil(rawHours * (1 + (data.bufferPct || 20) / 100))
  const totalPrice = bufferedHours * (data.ratePerHour || 25)

  // Update request status
  await prisma.estimationRequest.update({
    where: { id: data.requestId },
    data: { status: data.confirm ? 'confirmed' : 'in_progress' },
  })

  const record = await prisma.estimationRecord.create({
    data: {
      requestId: data.requestId,
      leadId: data.leadId,
      estimatedById: data.estimatedById,
      totalHoursRaw: rawHours,
      bufferPct: data.bufferPct || 20,
      totalHoursFinal: bufferedHours,
      ratePerHour: data.ratePerHour || 25,
      totalPriceRaw: rawHours * (data.ratePerHour || 25),
      totalPriceFinal: totalPrice,
      overallRisk: data.overallRisk || 'medium',
      assumptions: data.assumptions || null,
      exclusions: data.exclusions || null,
      devConfirmedAt: data.confirm ? new Date() : null,
      devConfirmedNote: data.confirm ? 'Confirmed by developer' : null,
      lines: {
        create: data.lines.map((l: {
          phase: string; feature: string; description: string
          estimatedHours: number; complexityLevel: string; riskFlag: boolean
          riskNote: string; assumptions: string; sortOrder: number
        }, i: number) => ({
          phase: l.phase,
          feature: l.feature,
          description: l.description || null,
          estimatedHours: Number(l.estimatedHours) || 0,
          complexityLevel: l.complexityLevel || 'medium',
          riskFlag: l.riskFlag || false,
          riskNote: l.riskNote || null,
          assumptions: l.assumptions || null,
          sortOrder: l.sortOrder ?? i,
        })),
      },
    },
  })

  // Notify BD requester when dev confirms
  if (data.confirm) {
    const req = await prisma.estimationRequest.findUnique({
      where: { id: data.requestId },
      include: { lead: { select: { clientName: true } }, requester: { select: { id: true, name: true } } },
    })
    if (req) {
      const assigneeName = (await prisma.teamMember.findUnique({ where: { id: data.estimatedById }, select: { name: true } }))?.name ?? 'Developer'
      await notify('estimate_confirmed', [req.requestedBy],
        `${assigneeName} confirmed the estimate for ${req.lead.clientName} — ready for your review`,
        `/estimate/${req.leadId}`)
    }
  }

  return NextResponse.json(record)
}

export async function PATCH(req: Request) {
  const deny = await checkRole(['Dev', 'Both', 'Founder'])
  if (deny) return deny

  const data = await req.json()

  const rawHours = data.lines.reduce((s: number, l: { estimatedHours: number }) => s + (Number(l.estimatedHours) || 0), 0)
  const bufferedHours = Math.ceil(rawHours * (1 + (data.bufferPct || 20) / 100))
  const totalPrice = bufferedHours * (data.ratePerHour || 25)

  // Find existing record by requestId
  const existing = await prisma.estimationRecord.findUnique({ where: { requestId: data.requestId } })
  if (!existing) {
    return NextResponse.json({ error: 'Record not found' }, { status: 404 })
  }

  // Delete old lines and recreate
  await prisma.estimationLine.deleteMany({ where: { recordId: existing.id } })

  const record = await prisma.estimationRecord.update({
    where: { id: existing.id },
    data: {
      estimatedById: data.estimatedById,
      totalHoursRaw: rawHours,
      bufferPct: data.bufferPct || 20,
      totalHoursFinal: bufferedHours,
      ratePerHour: data.ratePerHour || 25,
      totalPriceRaw: rawHours * (data.ratePerHour || 25),
      totalPriceFinal: totalPrice,
      overallRisk: data.overallRisk || 'medium',
      assumptions: data.assumptions || null,
      exclusions: data.exclusions || null,
      devConfirmedAt: data.confirm ? new Date() : null,
      bdRevisionNote: null, // clear revision note on resubmit
      lines: {
        create: data.lines.map((l: {
          phase: string; feature: string; description: string
          estimatedHours: number; complexityLevel: string; riskFlag: boolean
          riskNote: string; assumptions: string; sortOrder: number
        }, i: number) => ({
          phase: l.phase,
          feature: l.feature,
          description: l.description || null,
          estimatedHours: Number(l.estimatedHours) || 0,
          complexityLevel: l.complexityLevel || 'medium',
          riskFlag: l.riskFlag || false,
          riskNote: l.riskNote || null,
          assumptions: l.assumptions || null,
          sortOrder: l.sortOrder ?? i,
        })),
      },
    },
  })

  await prisma.estimationRequest.update({
    where: { id: data.requestId },
    data: { status: data.confirm ? 'confirmed' : 'in_progress' },
  })

  // Notify BD requester when dev confirms
  if (data.confirm) {
    const req = await prisma.estimationRequest.findUnique({
      where: { id: data.requestId },
      include: { lead: { select: { clientName: true } }, requester: { select: { id: true, name: true } } },
    })
    if (req) {
      const assigneeName = (await prisma.teamMember.findUnique({ where: { id: data.estimatedById }, select: { name: true } }))?.name ?? 'Developer'
      await notify('estimate_confirmed', [req.requestedBy],
        `${assigneeName} confirmed the estimate for ${req.lead.clientName} — ready for your review`,
        `/estimate/${req.leadId}`)
    }
  }

  return NextResponse.json(record)
}
