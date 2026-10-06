import { differenceInDays, startOfDay } from 'date-fns'
import { prisma } from '@/lib/prisma'
import {
  isMomActionBlockingAttend,
  isMomActionClosed,
  isMomActionOpenish,
  isMomActionStatus,
  momRequiresActionItems,
  type MomActionStatus,
} from '@/lib/utils'

function parseMomDate(value: FormDataEntryValue | string | null) {
  if (!value || typeof value !== 'string' || !value.trim()) return null
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

function momFormStr(value: FormDataEntryValue | null) {
  if (!value || typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed || null
}


export type ParsedMomActionInput = {
  id?: string
  title: string
  ownerId: string
  dueDate: Date
  status: MomActionStatus
  blockedReason: string | null
  sortOrder: number
}

export type MomActionFormRow = {
  id?: string
  title: string
  ownerId: string
  dueDate: string
  status: string
  blockedReason?: string | null
}

/** Parse actionItems JSON from FormData. */
export function parseMomActionItemsFromForm(form: FormData): ParsedMomActionInput[] {
  const raw = momFormStr(form.get('actionItems'))
  if (!raw) return []

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw Object.assign(new Error('Invalid action items payload.'), { status: 400 })
  }

  if (!Array.isArray(parsed)) {
    throw Object.assign(new Error('Action items must be an array.'), { status: 400 })
  }

  const results: ParsedMomActionInput[] = []
  parsed.forEach((item, index) => {
    const row = (item ?? {}) as MomActionFormRow
    const title = typeof row.title === 'string' ? row.title.trim() : ''
    const ownerId = typeof row.ownerId === 'string' ? row.ownerId.trim() : ''
    const dueDate = parseMomDate(typeof row.dueDate === 'string' ? row.dueDate : null)
    const statusRaw = typeof row.status === 'string' && row.status.trim() ? row.status.trim() : 'Open'
    const blockedReason =
      typeof row.blockedReason === 'string' && row.blockedReason.trim()
        ? row.blockedReason.trim()
        : null

    if (!isMomActionStatus(statusRaw)) {
      throw Object.assign(new Error(`Action #${index + 1}: invalid status.`), { status: 400 })
    }
    if ((statusRaw === 'Blocked' || statusRaw === 'Skipped') && !blockedReason) {
      throw Object.assign(
        new Error(
          statusRaw === 'Skipped'
            ? `Action #${index + 1}: skipped reason is required when status is Skipped.`
            : `Action #${index + 1}: blocked reason is required when status is Blocked.`
        ),
        { status: 400 }
      )
    }

    // Skip blank shell rows
    if (!title && !ownerId && !dueDate) return

    if (!title) {
      throw Object.assign(new Error(`Action #${index + 1}: what / title is required.`), { status: 400 })
    }
    if (!ownerId) {
      throw Object.assign(new Error(`Action #${index + 1}: owner is required.`), { status: 400 })
    }
    if (!dueDate) {
      throw Object.assign(new Error(`Action #${index + 1}: due date is required.`), { status: 400 })
    }

    results.push({
      id: typeof row.id === 'string' && row.id.trim() ? row.id.trim() : undefined,
      title,
      ownerId,
      dueDate,
      status: statusRaw,
      blockedReason: statusRaw === 'Blocked' || statusRaw === 'Skipped' ? blockedReason : null,
      sortOrder: index,
    })
  })
  return results
}

export function validateMomActionsForStatus(opts: {
  finalStatus: string
  followUpDate: Date | null
  actions: ParsedMomActionInput[]
}) {
  const { finalStatus, followUpDate, actions } = opts

  if (momRequiresActionItems(finalStatus)) {
    if (!actions.length) {
      throw Object.assign(
        new Error('At least one action item (what, owner, due date) is required for this status.'),
        { status: 400 }
      )
    }
  }

  const openActions = actions.filter(a => isMomActionOpenish(a.status))
  if (finalStatus === 'Active' && openActions.length > 0 && !followUpDate) {
    throw Object.assign(
      new Error('Follow-up date is required when status is Active and open action items exist.'),
      { status: 400 }
    )
  }
}

export async function assertValidActionOwners(ownerIds: string[]) {
  const unique = [...new Set(ownerIds)]
  if (!unique.length) return
  const members = await prisma.teamMember.findMany({
    where: { id: { in: unique }, active: true },
    select: { id: true },
  })
  if (members.length !== unique.length) {
    throw Object.assign(new Error('One or more action owners are invalid or inactive.'), { status: 400 })
  }
}

/** Replace all action items for a MOM (delete + create). Keeps history simple. */
export async function replaceMomActionItems(momId: string, actions: ParsedMomActionInput[]) {
  await assertValidActionOwners(actions.map(a => a.ownerId))

  await prisma.$transaction(async tx => {
    await tx.momActionItem.deleteMany({ where: { momId } })
    if (!actions.length) return
    await tx.momActionItem.createMany({
      data: actions.map(a => ({
        momId,
        title: a.title,
        ownerId: a.ownerId,
        dueDate: a.dueDate,
        status: a.status,
        blockedReason: a.blockedReason,
        sortOrder: a.sortOrder,
        completedAt: a.status === 'Done' ? new Date() : null,
      })),
    })
  })
}

/** Derive a legacy nextActionItem summary from structured actions. */
export function summarizeActionsAsNextItem(actions: ParsedMomActionInput[]): string | null {
  if (!actions.length) return null
  return actions
    .map(a => {
      const due = a.dueDate.toISOString().slice(0, 10)
      return `${a.title} (due ${due})`
    })
    .join('\n')
}

export function isActionOverdue(
  action: { dueDate: Date; status: string },
  today = startOfDay(new Date())
) {
  if (isMomActionClosed(action.status)) return false
  return differenceInDays(startOfDay(action.dueDate), today) < 0
}

export function actionOverdueDays(
  action: { dueDate: Date; status: string },
  today = startOfDay(new Date())
) {
  if (isMomActionClosed(action.status)) return 0
  const days = differenceInDays(today, startOfDay(action.dueDate))
  return days > 0 ? days : 0
}

export function actionAgingBucket(overdueDays: number): '0-2d' | '3-7d' | '8+d' | 'not_overdue' {
  if (overdueDays <= 0) return 'not_overdue'
  if (overdueDays <= 2) return '0-2d'
  if (overdueDays <= 7) return '3-7d'
  return '8+d'
}

/** Actions that block marking follow-up attended on a MOM thread. */
export async function getThreadBlockingActions(momId: string) {
  const mom = await prisma.meetingMinute.findUnique({
    where: { id: momId },
    select: { id: true, parentId: true },
  })
  if (!mom) return []
  const rootId = mom.parentId ?? mom.id
  const threadIds = (
    await prisma.meetingMinute.findMany({
      where: { OR: [{ id: rootId }, { parentId: rootId }] },
      select: { id: true },
    })
  ).map(m => m.id)

  const actions = await prisma.momActionItem.findMany({
    where: {
      momId: { in: threadIds },
      status: { in: ['Open', 'InProgress'] },
    },
    include: {
      owner: { select: { id: true, name: true } },
      mom: { select: { id: true, clientName: true } },
    },
    orderBy: [{ dueDate: 'asc' }, { sortOrder: 'asc' }],
  })

  return actions.filter(a => isMomActionBlockingAttend(a.status))
}

export const momActionInclude = {
  owner: { select: { id: true, name: true, role: true } },
} as const
