import { prisma } from '@/lib/prisma'
import { encodeMomClientKey, groupMomsByClient } from '@/lib/mom'
import { fmtDate } from '@/lib/utils'
import { parseMomAttendeesJson, splitMomAttendees } from '@/lib/mom-form'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import MomForm from '../MomForm'

export const dynamic = 'force-dynamic'

export default async function NewMomPage({
  searchParams,
}: {
  searchParams: { callId?: string; from?: string }
}) {
  const parentId = searchParams.from
  const [members, records, campaignCall, openCalls, parentMom] = await Promise.all([
    prisma.teamMember.findMany({
      where: { active: true },
      select: { id: true, name: true, role: true },
      orderBy: { name: 'asc' },
    }),
    prisma.meetingMinute.findMany({
      select: {
        id: true,
        clientName: true,
        companyName: true,
        meetingDate: true,
        meetingTime: true,
        meetingType: true,
        meetingOutcome: true,
        followUpDate: true,
        leadSource: true,
        createdBy: { select: { name: true } },
      },
    }),
    searchParams.callId
      ? prisma.campaignCall.findUnique({
          where: { id: searchParams.callId },
          include: { campaign: { select: { id: true, name: true } } },
        })
      : Promise.resolve(null),
    prisma.campaignCall.findMany({
      where: {
        momId: null,
        status: { in: ['scheduled', 'completed'] },
      },
      include: {
        campaign: { select: { id: true, name: true } },
      },
      orderBy: [{ scheduledDate: 'desc' }, { scheduledTime: 'desc' }],
    }),
    parentId
      ? prisma.meetingMinute.findUnique({ where: { id: parentId } })
      : Promise.resolve(null),
  ])

  if (parentId && !parentMom) notFound()

  const clientGroups = groupMomsByClient(records)
  const parsedParentAttendees = parentMom ? parseMomAttendeesJson(parentMom.attendees) : []
  const parentAttendees = parentMom
    ? splitMomAttendees(parsedParentAttendees, members)
    : { memberIds: [] as string[], customAttendees: [] }

  const callOptions = openCalls.map(c => ({
    id: c.id,
    campaignId: c.campaign.id,
    campaignName: c.campaign.name,
    clientName: c.clientName,
    companyName: c.companyName,
    clientLinkedIn: c.clientLinkedIn,
    clientEmail: c.clientEmail,
    clientPhone: c.clientPhone,
    scheduledDate: c.scheduledDate.toISOString().slice(0, 10),
    scheduledTime: c.scheduledTime,
    label: `${c.campaign.name} · ${c.clientName}${c.companyName ? ` (${c.companyName})` : ''} · ${fmtDate(c.scheduledDate)}${c.scheduledTime ? ` ${c.scheduledTime}` : ''}`,
  }))

  if (campaignCall && !callOptions.some(c => c.id === campaignCall.id)) {
    callOptions.unshift({
      id: campaignCall.id,
      campaignId: campaignCall.campaign.id,
      campaignName: campaignCall.campaign.name,
      clientName: campaignCall.clientName,
      companyName: campaignCall.companyName,
      clientLinkedIn: campaignCall.clientLinkedIn,
      clientEmail: campaignCall.clientEmail,
      clientPhone: campaignCall.clientPhone,
      scheduledDate: campaignCall.scheduledDate.toISOString().slice(0, 10),
      scheduledTime: campaignCall.scheduledTime,
      label: `${campaignCall.campaign.name} · ${campaignCall.clientName}${campaignCall.companyName ? ` (${campaignCall.companyName})` : ''} · ${fmtDate(campaignCall.scheduledDate)}${campaignCall.scheduledTime ? ` ${campaignCall.scheduledTime}` : ''}`,
    })
  }

  const followUpPrefill = parentMom
    ? {
        parentId: parentMom.parentId ?? parentMom.id,
        clientName: parentMom.clientName,
        companyName: parentMom.companyName ?? undefined,
        clientLinkedIn: parentMom.clientLinkedIn ?? undefined,
        companyLinkedIn: parentMom.companyLinkedIn ?? undefined,
        clientEmail: parentMom.clientEmail ?? undefined,
        clientPhone: parentMom.clientPhone ?? undefined,
        leadSource: parentMom.leadSource ?? undefined,
        domain: parentMom.domain ?? undefined,
        meetingType: 'Follow-up',
        finalStatus: parentMom.finalStatus ?? 'Active',
        attendeeIds: parentAttendees.memberIds,
        customAttendees: parentAttendees.customAttendees,
      }
    : undefined

  const prefill = followUpPrefill
    ?? (campaignCall
      ? {
          campaignCallId: campaignCall.id,
          clientName: campaignCall.clientName,
          companyName: campaignCall.companyName ?? undefined,
          clientLinkedIn: campaignCall.clientLinkedIn ?? undefined,
          clientEmail: campaignCall.clientEmail ?? undefined,
          clientPhone: campaignCall.clientPhone ?? undefined,
          meetingDate: campaignCall.scheduledDate.toISOString().slice(0, 10),
          meetingTime: campaignCall.scheduledTime ?? undefined,
          leadSource: 'LinkedIn',
        }
      : undefined)

  return (
    <div className="w-full">
      <div className="text-xs text-gray-400 mb-4">
        ←{' '}
        <Link
          href={parentMom ? `/mom/${parentMom.parentId ?? parentMom.id}` : '/mom'}
          className="hover:text-gray-700"
        >
          {parentMom ? 'Back to MOM' : 'Minutes of Meeting'}
        </Link>
      </div>

      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">
          {parentMom ? 'Add follow-up MOM' : 'New Minutes of Meeting'}
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {parentMom ? (
            <>
              Client and company are copied from{' '}
              <span className="font-medium text-gray-700">{parentMom.clientName}</span>
              {parentMom.companyName ? ` · ${parentMom.companyName}` : ''}. Add this meeting&apos;s notes.
            </>
          ) : (
            <>
              Capture client meeting details, notes, and follow-ups.
              {campaignCall && (
                <> From campaign: <span className="font-medium text-gray-700">{campaignCall.campaign.name}</span></>
              )}
            </>
          )}
        </p>
      </div>

      <MomForm
        members={members}
        existingClients={clientGroups.map(g => ({
          key: g.key,
          clientName: g.clientName,
          companyName: g.companyName,
          meetingCount: g.meetings.length,
          threadHref: `/mom/client/${encodeMomClientKey(g.key)}`,
        }))}
        prefill={prefill}
        campaignCalls={parentMom ? [] : callOptions}
      />
    </div>
  )
}
