import { prisma } from '@/lib/prisma'
import { fmtDate, MOM_MEETING_TYPE_COLORS } from '@/lib/utils'
import { decodeMomClientKey, followUpStatusLabel, momClientKey } from '@/lib/mom'
import Link from 'next/link'
import { notFound } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function MomClientPage({ params }: { params: { key: string } }) {
  let clientKey: string
  try {
    clientKey = decodeMomClientKey(params.key)
  } catch {
    notFound()
  }

  const all = await prisma.meetingMinute.findMany({
    include: { createdBy: { select: { name: true } } },
    orderBy: [{ meetingDate: 'asc' }, { meetingTime: 'asc' }],
  })

  const meetings = all.filter(r => momClientKey(r.clientName, r.companyName) === clientKey)
  if (!meetings.length) notFound()

  const { clientName, companyName } = meetings[0]
  const latest = meetings[meetings.length - 1]

  return (
    <div className="w-full">
      <div className="text-xs text-gray-400 mb-4">
        ← <Link href="/mom" className="hover:text-gray-700">Minutes of Meeting</Link>
      </div>

      <div className="card p-6 mb-5 bg-gradient-to-br from-slate-50 via-white to-violet-50/30">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-[10px] uppercase tracking-wide text-violet-600 font-semibold mb-1">
              Client thread
            </div>
            <h1 className="text-2xl font-semibold text-gray-900">{clientName}</h1>
            {companyName && <p className="text-sm text-gray-500 mt-0.5">{companyName}</p>}
          </div>
          <div className="text-right shrink-0">
            <div className="text-2xl font-bold text-gray-900">{meetings.length}</div>
            <div className="text-xs text-gray-500">meetings logged</div>
          </div>
        </div>
        <p className="text-xs text-gray-400 mt-3">
          First contact {fmtDate(meetings[0].meetingDate)} · Latest {fmtDate(latest.meetingDate)}
        </p>
      </div>

      <div className="card p-5">
        <h2 className="text-sm font-semibold text-gray-900 mb-4">Meeting timeline</h2>
        <div className="relative">
          <div className="absolute left-[11px] top-2 bottom-2 w-px bg-gray-200" />
          <div className="space-y-4">
            {meetings.map((m, i) => {
              const followUp = followUpStatusLabel(m)
              const typeColor = MOM_MEETING_TYPE_COLORS[m.meetingType] ?? 'bg-gray-100 text-gray-600'
              const isLatest = i === meetings.length - 1

              return (
                <div key={m.id} className="relative pl-8">
                  <div className={`absolute left-0 top-1.5 w-6 h-6 rounded-full border-2 flex items-center justify-center text-[10px] font-bold ${
                    isLatest ? 'bg-gray-900 border-gray-900 text-white' : 'bg-white border-gray-300 text-gray-500'
                  }`}>
                    {i + 1}
                  </div>
                  <Link
                    href={`/mom/${m.id}`}
                    className="block rounded-xl border border-gray-100 p-4 hover:border-gray-200 hover:bg-gray-50/80 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div>
                        <div className="font-medium text-gray-900">
                          {fmtDate(m.meetingDate)}
                          {m.meetingTime ? ` · ${m.meetingTime}` : ''}
                        </div>
                        <div className="text-xs text-gray-400 mt-0.5">Logged by {m.createdBy.name}</div>
                      </div>
                      <span className={`badge shrink-0 ${typeColor}`}>{m.meetingType}</span>
                    </div>
                    {m.meetingOutcome && (
                      <p className="text-sm text-gray-600 line-clamp-2">{m.meetingOutcome}</p>
                    )}
                    <div className="flex flex-wrap gap-2 mt-2">
                      {followUp && (
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${followUp.cls}`}>
                          Follow-up: {followUp.text}
                        </span>
                      )}
                      {m.leadSource && (
                        <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                          {m.leadSource}
                        </span>
                      )}
                    </div>
                  </Link>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
