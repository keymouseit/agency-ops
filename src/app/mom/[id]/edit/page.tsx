import { prisma } from '@/lib/prisma'
import { parseMomAttendeesJson, splitMomAttendees } from '@/lib/mom-form'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import MomForm from '../../MomForm'

export const dynamic = 'force-dynamic'

export default async function EditMomPage({ params }: { params: { id: string } }) {
  const [record, members] = await Promise.all([
    prisma.meetingMinute.findUnique({ where: { id: params.id } }),
    prisma.teamMember.findMany({
      where: { active: true },
      select: { id: true, name: true, role: true },
      orderBy: { name: 'asc' },
    }),
  ])

  if (!record) notFound()

  const parsedAttendees = parseMomAttendeesJson(record.attendees)
  const { memberIds, customAttendees } = splitMomAttendees(parsedAttendees, members)

  return (
    <div className="w-full">
      <div className="text-xs text-gray-400 mb-4">
        ← <Link href={`/mom/${record.id}`} className="hover:text-gray-700">Back to MOM</Link>
      </div>

      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Edit Minutes of Meeting</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Update details for {record.clientName}
          {record.companyName ? ` · ${record.companyName}` : ''}.
        </p>
      </div>

      <MomForm
        members={members}
        initialMom={{
          id: record.id,
          meetingDate: record.meetingDate.toISOString().slice(0, 10),
          meetingTime: record.meetingTime ?? '',
          meetingType: record.meetingType,
          leadSource: record.leadSource ?? '',
          domain: record.domain ?? '',
          clientName: record.clientName,
          clientLinkedIn: record.clientLinkedIn ?? '',
          companyName: record.companyName ?? '',
          companyLinkedIn: record.companyLinkedIn ?? '',
          clientEmail: record.clientEmail ?? '',
          clientPhone: record.clientPhone ?? '',
          meetingOutcome: record.meetingOutcome ?? '',
          clientPainPoints: record.clientPainPoints ?? '',
          ourApproach: record.ourApproach ?? '',
          requirementsFromClient: record.requirementsFromClient ?? '',
          nextActionItem: record.nextActionItem ?? '',
          followUpDate: record.followUpDate ? record.followUpDate.toISOString().slice(0, 10) : '',
          meetingVideoUrl: record.meetingVideoUrl ?? '',
          attendeeIds: memberIds,
          customAttendees,
        }}
      />
    </div>
  )
}
