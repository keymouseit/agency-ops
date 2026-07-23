import { prisma } from '@/lib/prisma'
import { isSameDay } from 'date-fns'

export const MAX_DAILY_PLAN_HOURS = 8

export const DAILY_TASK_TYPES = [
  { value: 'feature', label: 'Feature (Dev)' },
  { value: 'bug', label: 'Bug (Dev)' },
  { value: 'backend', label: 'Backend (Dev)' },
  { value: 'review', label: 'Code review (Dev)' },
  { value: 'research', label: 'Research (Dev)' },
  { value: 'qa', label: 'QA' },
  { value: 'bd', label: 'BD / Sales' },
  { value: 'hr', label: 'HR' },
  { value: 'social_media', label: 'Social media' },
  { value: 'meeting', label: 'Meeting' },
  { value: 'admin', label: 'Admin' },
] as const

export type DailyTaskType = (typeof DAILY_TASK_TYPES)[number]['value']

export const DAILY_TASK_TYPE_COLORS: Record<string, string> = {
  feature: 'bg-green-100 text-green-800',
  bug: 'bg-red-100 text-red-800',
  backend: 'bg-indigo-100 text-indigo-800',
  review: 'bg-purple-100 text-purple-800',
  research: 'bg-amber-100 text-amber-800',
  qa: 'bg-teal-100 text-teal-800',
  bd: 'bg-blue-100 text-blue-800',
  hr: 'bg-rose-100 text-rose-800',
  social_media: 'bg-pink-100 text-pink-800',
  meeting: 'bg-gray-100 text-gray-700',
  admin: 'bg-gray-100 text-gray-500',
}

export function dailyTaskTypeLabel(value: string) {
  return DAILY_TASK_TYPES.find(t => t.value === value)?.label ?? value.replace(/_/g, ' ')
}

export function defaultDailyTaskType(role: string): DailyTaskType {
  switch (role) {
    case 'QA': return 'qa'
    case 'BD': return 'bd'
    case 'Both': return 'bd'
    case 'HR': return 'hr'
    case 'SocialMedia': return 'social_media'
    default: return 'feature'
  }
}

const openLogInclude = {
  member: true,
  tasks: {
    include: { project: { select: { name: true } } },
    orderBy: { priority: 'asc' as const },
  },
}

/** Most recent DailyLog with a morning plan submitted but EOD still open */
export function findOpenDailyLog(memberId: string) {
  return prisma.dailyLog.findFirst({
    where: {
      memberId,
      planSubmittedAt: { not: null },
      eodSubmittedAt: null,
    },
    include: openLogInclude,
    orderBy: { date: 'desc' },
  })
}

export const dailyLogWithTasksInclude = openLogInclude

/** True if EOD has not been submitted yet, or was submitted today (editable until midnight). */
export function canEditEod(eodSubmittedAt: Date | string | null | undefined): boolean {
  if (!eodSubmittedAt) return true
  return isSameDay(new Date(eodSubmittedAt), new Date())
}

export function isEodReadOnly(eodSubmittedAt: Date | string | null | undefined): boolean {
  return !!eodSubmittedAt && !canEditEod(eodSubmittedAt)
}

/** Today's log with EOD submitted today — available for same-day edits. */
export function findTodayEditableEodLog(memberId: string) {
  return prisma.dailyLog.findFirst({
    where: {
      memberId,
      eodSubmittedAt: { not: null },
    },
    include: openLogInclude,
    orderBy: { eodSubmittedAt: 'desc' },
  }).then(log => (log && canEditEod(log.eodSubmittedAt) ? log : null))
}
