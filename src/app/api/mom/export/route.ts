import { NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { checkRole } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'

function formatDate(d: Date | null | undefined) {
  if (!d) return ''
  return d.toISOString().slice(0, 10)
}

function formatAttendees(raw: string | null) {
  if (!raw) return ''
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return raw
    return parsed
      .map(a => {
        if (!a || typeof a !== 'object') return ''
        const name = 'name' in a && typeof a.name === 'string' ? a.name : ''
        const role = 'role' in a && typeof a.role === 'string' ? a.role : ''
        if (!name) return ''
        return role ? `${name} (${role})` : name
      })
      .filter(Boolean)
      .join('; ')
  } catch {
    return raw
  }
}

export async function GET() {
  const deny = await checkRole(['Founder'])
  if (deny) return deny

  try {
    const records = await prisma.meetingMinute.findMany({
      include: {
        createdBy: { select: { name: true, email: true } },
        campaignCall: {
          include: { campaign: { select: { name: true, channel: true } } },
        },
      },
      orderBy: [{ meetingDate: 'desc' }, { createdAt: 'desc' }],
    })

    const rows = records.map(r => ({
      'Meeting Date': formatDate(r.meetingDate),
      'Meeting Time': r.meetingTime ?? '',
      'Client Name': r.clientName,
      'Company Name': r.companyName ?? '',
      'Client LinkedIn': r.clientLinkedIn ?? '',
      'Company LinkedIn': r.companyLinkedIn ?? '',
      'Client Email': r.clientEmail ?? '',
      'Client Phone': r.clientPhone ?? '',
      'Meeting Type': r.meetingType,
      'Meeting Outcome': r.meetingOutcome ?? '',
      'Industry / Domain': r.domain ?? '',
      Attendees: formatAttendees(r.attendees),
      'Client Pain Points': r.clientPainPoints ?? '',
      'Our Approach': r.ourApproach ?? '',
      'Requirements From Client': r.requirementsFromClient ?? '',
      'Next Action Item': r.nextActionItem ?? '',
      'Follow-up Date': formatDate(r.followUpDate),
      'Follow-up Completed At': formatDate(r.followUpCompletedAt),
      'Lead Source': r.leadSource ?? '',
      'Campaign': r.campaignCall?.campaign?.name ?? '',
      'Campaign Channel': r.campaignCall?.campaign?.channel ?? '',
      'Meeting Video URL': r.meetingVideoUrl ?? '',
      'Meeting Video Path': r.meetingVideoPath ?? '',
      'Logged By': r.createdBy.name,
      'Logged By Email': r.createdBy.email,
      'Created At': formatDate(r.createdAt),
      'Updated At': formatDate(r.updatedAt),
    }))

    const worksheet = XLSX.utils.json_to_sheet(rows)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'MOMs')

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer
    const filename = `mom-export-${new Date().toISOString().slice(0, 10)}.xlsx`

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    logger.error('MOM export failed', err instanceof Error ? err : new Error(String(err)))
    return NextResponse.json({ error: 'Failed to export MOM data' }, { status: 500 })
  }
}
