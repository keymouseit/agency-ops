import { prisma } from '@/lib/prisma'
import { fmtDate, ROLE_COLORS, MOM_MEETING_TYPE_COLORS, MOM_FINAL_STATUS_COLORS } from '@/lib/utils'
import { encodeMomClientKey, momClientKey } from '@/lib/mom'
import { getMomFinalStatus } from '@/lib/mom-form'
import MomFollowUpButton from '../MomFollowUpButton'
import MomFinalStatusControl from '../MomFinalStatusControl'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { differenceInDays, startOfDay } from 'date-fns'

export const dynamic = 'force-dynamic'

type Attendee = { name: string; role: string }

function parseAttendees(raw: string | null): Attendee[] | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as Attendee[]
    if (Array.isArray(parsed) && parsed.every(a => a.name && a.role)) return parsed
  } catch {
    return null
  }
  return null
}

function initials(name: string) {
  return name.split(' ').slice(0, 2).map(p => p[0]).join('').toUpperCase()
}

function MetaPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-3 py-2 rounded-lg bg-white/80 border border-gray-100">
      <div className="text-[10px] uppercase tracking-wide text-gray-400 font-medium">{label}</div>
      <div className="text-sm font-medium text-gray-900 mt-0.5">{value}</div>
    </div>
  )
}

function ContactRow({
  label,
  value,
  href,
}: {
  label: string
  value: string | null
  href?: string
}) {
  if (!value) return null
  return (
    <div className="flex items-start justify-between gap-3 py-2.5 border-b border-gray-50 last:border-0">
      <span className="text-xs text-gray-400 uppercase tracking-wide font-medium shrink-0">{label}</span>
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-blue-600 hover:underline text-right break-all"
        >
          View profile →
        </a>
      ) : (
        <span className="text-sm text-gray-800 text-right break-all">{value}</span>
      )}
    </div>
  )
}

function NoteBlock({
  title,
  value,
  accent,
}: {
  title: string
  value: string | null
  accent: 'gray' | 'red' | 'blue' | 'amber' | 'green'
}) {
  const styles = {
    gray: 'border-gray-100 bg-gray-50',
    red: 'border-red-100 bg-red-50/60',
    blue: 'border-blue-100 bg-blue-50/60',
    amber: 'border-amber-200 bg-amber-50',
    green: 'border-green-100 bg-green-50/60',
  }
  const titleStyles = {
    gray: 'text-gray-700',
    red: 'text-red-800',
    blue: 'text-blue-800',
    amber: 'text-amber-900',
    green: 'text-green-800',
  }

  return (
    <div className={`rounded-xl border p-4 ${styles[accent]}`}>
      <h3 className={`text-xs font-semibold uppercase tracking-wide mb-2 ${titleStyles[accent]}`}>{title}</h3>
      <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
        {value || <span className="text-gray-400">Not recorded</span>}
      </p>
    </div>
  )
}

export default async function MomDetailPage({
  params,
  searchParams,
}: {
  params: { id: string }
  searchParams: { view?: string }
}) {
  const record = await prisma.meetingMinute.findUnique({
    where: { id: params.id },
    include: { createdBy: { select: { name: true, email: true } } },
  })

  if (!record) notFound()

  const finalStatus = await getMomFinalStatus(record.id)

  if (record.parentId) {
    redirect(`/mom/${record.parentId}?view=${record.id}`)
  }

  const followUps = await prisma.meetingMinute.findMany({
    where: { parentId: record.id },
    include: { createdBy: { select: { name: true, email: true } } },
    orderBy: [{ meetingDate: 'asc' }, { createdAt: 'asc' }],
  })

  const selected =
    (searchParams.view ? followUps.find(m => m.id === searchParams.view) : null) ?? record

  const relatedMeetings = (
    await prisma.meetingMinute.findMany({
      where: {
        id: { not: record.id },
        clientName: record.clientName,
      },
      include: { createdBy: { select: { name: true } } },
      orderBy: [{ meetingDate: 'desc' }, { meetingTime: 'desc' }],
    })
  ).filter(
    m =>
      m.parentId !== record.id &&
      momClientKey(m.clientName, m.companyName) === momClientKey(record.clientName, record.companyName)
  )

  const clientThreadHref = `/mom/client/${encodeMomClientKey(momClientKey(record.clientName, record.companyName))}`
  const totalMeetings = relatedMeetings.length + 1 + followUps.length

  const attendees = parseAttendees(selected.attendees)
  const typeColor = `${MOM_MEETING_TYPE_COLORS[selected.meetingType] ?? 'bg-gray-100 text-gray-700'} border-gray-200`
  const followUpDays = selected.followUpDate && !selected.followUpCompletedAt
    ? differenceInDays(startOfDay(selected.followUpDate), startOfDay(new Date()))
    : null
  const selectedIsFollowUp = selected.id !== record.id
  const followUpIndex = followUps.findIndex(m => m.id === selected.id)

  return (
    <div className="w-full">
      <div className="text-xs text-gray-400 mb-4">
        ← <Link href="/mom" className="hover:text-gray-700">Minutes of Meeting</Link>
      </div>

      {/* Hero */}
      <div className="card p-6 mb-5 bg-gradient-to-br from-slate-50 via-white to-blue-50/40 border-gray-100">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-5">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className={`badge border ${typeColor}`}>{selected.meetingType}</span>
              {selectedIsFollowUp && (
                <span className="badge bg-sky-50 text-sky-800 border border-sky-100">
                  Follow-up {followUpIndex + 1}
                </span>
              )}
              {selected.leadSource && (
                <span className="badge bg-gray-100 text-gray-600 border border-gray-200">{selected.leadSource}</span>
              )}
              <span className={`badge border ${MOM_FINAL_STATUS_COLORS[finalStatus] ?? 'bg-gray-100 text-gray-700 border-gray-200'}`}>
                {finalStatus}
              </span>
            </div>
            <h1 className="text-2xl font-semibold text-gray-900">{record.clientName}</h1>
            <p className="text-sm text-gray-500 mt-1">
              {record.companyName || 'No company listed'}
              {totalMeetings > 1 && (
                <>
                  {' · '}
                  <Link href={clientThreadHref} className="text-violet-600 hover:underline">
                    {totalMeetings} meetings with this client
                  </Link>
                </>
              )}
            </p>
          </div>
          <div className="text-left sm:text-right shrink-0 space-y-2">
            <div>
              <div className="text-lg font-semibold text-gray-900">{fmtDate(selected.meetingDate)}</div>
              {selected.meetingTime && (
                <div className="text-sm text-gray-500 mt-0.5">{selected.meetingTime}</div>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:justify-end">
              <MomFinalStatusControl id={record.id} status={finalStatus} />
              <Link
                href={`/mom/new?from=${record.id}`}
                className="inline-flex items-center px-3 py-1.5 text-xs font-medium bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors"
              >
                + Add follow-up
              </Link>
              <Link
                href={`/mom/${selected.id}/edit`}
                className="inline-flex items-center px-3 py-1.5 text-xs font-medium border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Edit MOM
              </Link>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-5">
          <MetaPill label="Logged by" value={selected.createdBy.name} />
          <MetaPill
            label="Follow-up"
            value={
              followUps.length
                ? `${followUps.length} logged`
                : selected.followUpCompletedAt
                  ? 'Completed'
                  : selected.followUpDate
                    ? fmtDate(selected.followUpDate)
                    : '—'
            }
          />
          <MetaPill
            label="Industry"
            value={selected.domain || '—'}
          />
          <MetaPill
            label="Attendees"
            value={attendees?.length ? `${attendees.length} people` : '—'}
          />
        </div>

        {attendees?.length ? (
          <div>
            <div className="text-[10px] uppercase tracking-wide text-gray-400 font-medium mb-2">Team on the call</div>
            <div className="flex flex-wrap gap-2">
              {attendees.map(a => (
                <div
                  key={`${a.name}-${a.role}`}
                  className="inline-flex items-center gap-2 pl-1 pr-2.5 py-1 rounded-full bg-white border border-gray-200 shadow-sm"
                >
                  <div className="w-7 h-7 rounded-full bg-gray-900 text-white flex items-center justify-center text-[10px] font-semibold">
                    {initials(a.name)}
                  </div>
                  <span className="text-sm text-gray-800">{a.name}</span>
                  <span className={`badge text-xs ${ROLE_COLORS[a.role] ?? 'bg-gray-100 text-gray-600'}`}>
                    {a.role}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : selected.attendees ? (
          <div>
            <div className="text-[10px] uppercase tracking-wide text-gray-400 font-medium mb-1">Attendees</div>
            <p className="text-sm text-gray-700">{selected.attendees}</p>
          </div>
        ) : null}

        {followUpDays != null && (
          <div className={`mt-4 px-3 py-2 rounded-lg text-xs font-medium ${
            followUpDays < 0
              ? 'bg-red-50 text-red-700 border border-red-100'
              : followUpDays === 0
                ? 'bg-amber-50 text-amber-800 border border-amber-100'
                : 'bg-blue-50 text-blue-700 border border-blue-100'
          }`}>
            {followUpDays < 0
              ? `Follow-up was ${Math.abs(followUpDays)} day${Math.abs(followUpDays) === 1 ? '' : 's'} ago`
              : followUpDays === 0
                ? 'Follow-up is today'
                : `Follow-up in ${followUpDays} day${followUpDays === 1 ? '' : 's'}`}
          </div>
        )}

        {selected.followUpDate && (
          <MomFollowUpButton
            id={selected.id}
            followUpDate={selected.followUpDate.toISOString()}
            completedAt={selected.followUpCompletedAt?.toISOString() ?? null}
          />
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-5">
        <Link
          href={`/mom/${record.id}`}
          className={`px-3.5 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
            !selectedIsFollowUp
              ? 'bg-slate-900 text-white shadow-sm'
              : 'bg-white text-gray-600 ring-1 ring-gray-200 hover:text-gray-900'
          }`}
        >
          First meeting
        </Link>
        {followUps.map((m, i) => (
          <Link
            key={m.id}
            href={`/mom/${record.id}?view=${m.id}`}
            className={`px-3.5 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
              selected.id === m.id
                ? 'bg-slate-900 text-white shadow-sm'
                : 'bg-white text-gray-600 ring-1 ring-gray-200 hover:text-gray-900'
            }`}
          >
            Follow-up {i + 1}
            <span className={`ml-1.5 text-[11px] font-medium ${selected.id === m.id ? 'text-white/70' : 'text-gray-400'}`}>
              {fmtDate(m.meetingDate)}
            </span>
          </Link>
        ))}
      </div>

      {relatedMeetings.length > 0 && (
        <div className="card p-5 mb-4">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div>
              <h2 className="text-sm font-semibold text-gray-900">Meeting history</h2>
              <p className="text-xs text-gray-400 mt-0.5">Other calls logged for this client</p>
            </div>
            <Link href={clientThreadHref} className="text-xs text-violet-600 hover:underline shrink-0">
              View full timeline →
            </Link>
          </div>
          <div className="space-y-2">
            {relatedMeetings.map(m => {
              const typeColor = MOM_MEETING_TYPE_COLORS[m.meetingType] ?? 'bg-gray-100 text-gray-600'
              return (
                <Link
                  key={m.id}
                  href={`/mom/${m.id}`}
                  className="flex items-center justify-between gap-3 p-3 rounded-lg border border-gray-100 hover:border-gray-200 hover:bg-gray-50/80 transition-colors"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-gray-900">
                      {fmtDate(m.meetingDate)}
                      {m.meetingTime ? ` · ${m.meetingTime}` : ''}
                    </div>
                    {m.meetingOutcome && (
                      <p className="text-xs text-gray-500 truncate mt-0.5">{m.meetingOutcome}</p>
                    )}
                  </div>
                  <span className={`badge shrink-0 ${typeColor}`}>{m.meetingType}</span>
                </Link>
              )
            })}
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-4 mb-4">
        {/* Client contact */}
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-1">Client & company</h2>
          <p className="text-xs text-gray-400 mb-4">Contact details captured from the meeting</p>
          <ContactRow label="Email" value={record.clientEmail} />
          <ContactRow label="Phone" value={record.clientPhone} />
          <ContactRow label="Client LinkedIn" value={record.clientLinkedIn} href={record.clientLinkedIn ?? undefined} />
          <ContactRow label="Company" value={record.companyName} />
          <ContactRow label="Company LinkedIn" value={record.companyLinkedIn} href={record.companyLinkedIn ?? undefined} />
          {!record.clientEmail && !record.clientPhone && !record.clientLinkedIn && !record.companyLinkedIn && (
            <p className="text-sm text-gray-400 py-4 text-center">No contact details recorded</p>
          )}
        </div>

        {/* Meeting outcome */}
        <div className="card p-5 flex flex-col">
          <h2 className="text-sm font-semibold text-gray-900 mb-1">Meeting outcome</h2>
          <p className="text-xs text-gray-400 mb-4">Summary of what was discussed and decided</p>
          <div className="flex-1 rounded-xl bg-gray-50 border border-gray-100 p-4">
            <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
              {selected.meetingOutcome || <span className="text-gray-400">No outcome recorded</span>}
            </p>
          </div>
        </div>
      </div>

      {/* Discussion notes */}
      <div className="mb-4">
        <h2 className="text-sm font-semibold text-gray-900 mb-3">Discussion notes</h2>
        <div className="grid sm:grid-cols-2 gap-3">
          <NoteBlock title="Client pain points" value={selected.clientPainPoints} accent="red" />
          <NoteBlock title="Our approach" value={selected.ourApproach} accent="blue" />
          <NoteBlock title="Requirement from client" value={selected.requirementsFromClient} accent="gray" />
          <NoteBlock title="Next action item" value={selected.nextActionItem} accent="amber" />
        </div>
      </div>

      {/* Video */}
      {(selected.meetingVideoPath || selected.meetingVideoUrl) && (
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Meeting recording</h2>
          <div className="space-y-4">
            {selected.meetingVideoPath && (
              <div>
                <div className="text-xs text-gray-500 mb-2 font-medium uppercase tracking-wide">Uploaded file</div>
                <video
                  src={selected.meetingVideoPath}
                  controls
                  className="w-full rounded-xl bg-black max-h-[28rem] shadow-sm"
                />
                <a
                  href={selected.meetingVideoPath}
                  download
                  className="inline-flex items-center gap-1 mt-3 text-xs text-gray-500 hover:text-gray-800 font-medium"
                >
                  ↓ Download video
                </a>
              </div>
            )}

            {selected.meetingVideoUrl && (
              <div className={selected.meetingVideoPath ? 'pt-4 border-t border-gray-100' : ''}>
                <div className="text-xs text-gray-500 mb-2 font-medium uppercase tracking-wide">External link</div>
                <a
                  href={selected.meetingVideoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 p-4 rounded-xl border border-gray-200 bg-gray-50 hover:bg-gray-100 transition-colors group"
                >
                  <div className="w-10 h-10 rounded-lg bg-red-100 text-red-600 flex items-center justify-center text-lg shrink-0">
                    ▶
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-gray-900 group-hover:text-blue-700">Open recording</div>
                    <div className="text-xs text-gray-500 truncate mt-0.5">{selected.meetingVideoUrl}</div>
                  </div>
                  <span className="text-gray-400 text-sm shrink-0">→</span>
                </a>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
