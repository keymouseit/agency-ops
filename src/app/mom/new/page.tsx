import { prisma } from '@/lib/prisma'
import { encodeMomClientKey, groupMomsByClient } from '@/lib/mom'
import { fmtDate } from '@/lib/utils'
import Link from 'next/link'
import MomForm from '../MomForm'

export const dynamic = 'force-dynamic'

export default async function NewMomPage({
  searchParams,
}: {
  searchParams: { callId?: string }
}) {
  const [members, records, campaignCall, openCalls] = await Promise.all([
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
          include: { campaign: { select: { name: true } } },
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
  ])

  const clientGroups = groupMomsByClient(records)

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

  const prefill = campaignCall
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
    : undefined

  return (
    <div className="max-w-4xl">
      <div className="text-xs text-gray-400 mb-4">
        ← <Link href="/mom" className="hover:text-gray-700">Minutes of Meeting</Link>
      </div>

      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">New Minutes of Meeting</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Capture client meeting details, notes, and follow-ups.
          {campaignCall && (
            <> From campaign: <span className="font-medium text-gray-700">{campaignCall.campaign.name}</span></>
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
        campaignCalls={callOptions}
      />
    </div>
  )
}
