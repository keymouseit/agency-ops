/** Normalized key to group MOMs for the same client + company */
import { differenceInDays, startOfDay } from 'date-fns'
import { fmtDate } from '@/lib/utils'

export function momClientKey(clientName: string, companyName?: string | null) {
  const name = clientName.trim().toLowerCase()
  const company = (companyName ?? '').trim().toLowerCase()
  return company ? `${name}::${company}` : name
}

export function momClientLabel(clientName: string, companyName?: string | null) {
  return companyName?.trim() ? `${clientName} · ${companyName}` : clientName
}

export function encodeMomClientKey(key: string) {
  return Buffer.from(key, 'utf8').toString('base64url')
}

export function decodeMomClientKey(encoded: string) {
  return Buffer.from(encoded, 'base64url').toString('utf8')
}

export type MomRecordBase = {
  id: string
  clientName: string
  companyName: string | null
  meetingDate: Date
  meetingTime: string | null
  meetingType: string
  meetingOutcome: string | null
  followUpDate: Date | null
  followUpCompletedAt?: Date | null
  leadSource: string | null
  createdBy: { name: string }
}

export type MomFollowUpFields = {
  followUpDate: Date | null
  followUpCompletedAt?: Date | null
}

export function isFollowUpPending(r: MomFollowUpFields) {
  return !!r.followUpDate && !r.followUpCompletedAt
}

export function followUpStatusLabel(r: MomFollowUpFields, today = startOfDay(new Date())) {
  if (!r.followUpDate) return null
  if (r.followUpCompletedAt) {
    return { text: 'Completed', cls: 'bg-green-50 text-green-700 border-green-100' }
  }
  const days = differenceInDays(startOfDay(r.followUpDate), today)
  if (days < 0) return { text: `${Math.abs(days)}d overdue`, cls: 'bg-red-50 text-red-700 border-red-100' }
  if (days === 0) return { text: 'Today', cls: 'bg-amber-50 text-amber-800 border-amber-100' }
  if (days <= 7) return { text: `In ${days}d`, cls: 'bg-blue-50 text-blue-700 border-blue-100' }
  return { text: fmtDate(r.followUpDate), cls: 'bg-gray-50 text-gray-600 border-gray-100' }
}

export function groupMomsByClient<T extends MomRecordBase>(records: T[]) {
  const map = new Map<string, T[]>()
  for (const r of records) {
    const key = momClientKey(r.clientName, r.companyName)
    const list = map.get(key) ?? []
    list.push(r)
    map.set(key, list)
  }

  return [...map.entries()]
    .map(([key, meetings]) => ({
      key,
      clientName: meetings[0].clientName,
      companyName: meetings[0].companyName,
      meetings: meetings.sort((a, b) => {
        const dateDiff = b.meetingDate.getTime() - a.meetingDate.getTime()
        if (dateDiff !== 0) return dateDiff
        return b.meetingTime?.localeCompare(a.meetingTime ?? '') ?? 0
      }),
    }))
    .sort((a, b) => b.meetings[0].meetingDate.getTime() - a.meetings[0].meetingDate.getTime())
}
