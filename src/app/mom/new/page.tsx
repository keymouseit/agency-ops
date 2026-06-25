import { prisma } from '@/lib/prisma'
import { encodeMomClientKey, groupMomsByClient } from '@/lib/mom'
import Link from 'next/link'
import MomForm from '../MomForm'

export const dynamic = 'force-dynamic'

export default async function NewMomPage() {
  const [members, records] = await Promise.all([
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
  ])

  const clientGroups = groupMomsByClient(records)

  return (
    <div className="max-w-4xl">
      <div className="text-xs text-gray-400 mb-4">
        ← <Link href="/mom" className="hover:text-gray-700">Minutes of Meeting</Link>
      </div>

      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">New Minutes of Meeting</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Capture client meeting details, notes, and follow-ups.
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
      />
    </div>
  )
}
