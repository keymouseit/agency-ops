import { prisma } from '@/lib/prisma'
import { businessDayStart } from '@/lib/daily'
import { istDateInputValue } from '@/lib/ist'
import {
  fallbackEmpNo,
  fallbackFixedHours,
  shouldExcludeFromAttendance,
} from './fallbacks'
import type { AttendanceAdjustmentRow, AttendanceMember } from './types'

type RawMember = {
  id: string
  name: string
  email: string
  role: string
  ssmEmploymentId?: number | null
  attendanceEmpNo?: number | null
  attendanceExcluded?: boolean | null
  attendanceFixedStart?: string | null
  attendanceFixedEnd?: string | null
}

/**
 * When migration fields are missing/null, apply attendance-dashboard name fallbacks
 * (exclusions + Sushant fixed hours). Once HR sets DB fields, those win.
 */
function withFallbacks(m: RawMember, _schemaReady: boolean): AttendanceMember {
  // Built-in exclusions (shiven / Founder / harshil) always win; DB flag can only add exclusions.
  const excluded = shouldExcludeFromAttendance({
    name: m.name,
    email: m.email,
    role: m.role,
    attendanceExcluded: m.attendanceExcluded,
  })

  const nameFixed = fallbackFixedHours(m.name)
  let fixedStart = m.attendanceFixedStart ?? null
  let fixedEnd = m.attendanceFixedEnd ?? null
  if (!fixedStart && !fixedEnd && nameFixed) {
    // Only auto-apply name fixed hours when DB has not set either field
    fixedStart = nameFixed.start
    fixedEnd = nameFixed.end
  }

  return {
    id: m.id,
    name: m.name,
    email: m.email,
    role: m.role,
    ssmEmploymentId: m.ssmEmploymentId ?? null,
    attendanceEmpNo: m.attendanceEmpNo ?? null,
    attendanceExcluded: excluded,
    attendanceFixedStart: fixedStart,
    attendanceFixedEnd: fixedEnd,
  }
}

/**
 * Load active members with attendance mapping fields.
 * Falls back safely when migration has not been applied yet.
 */
export async function loadAttendanceMembers(): Promise<{
  members: AttendanceMember[]
  schemaReady: boolean
}> {
  try {
    const rows = await prisma.teamMember.findMany({
      where: { active: true },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        ssmEmploymentId: true,
        attendanceEmpNo: true,
        attendanceExcluded: true,
        attendanceFixedStart: true,
        attendanceFixedEnd: true,
      },
      orderBy: { name: 'asc' },
    })
    return {
      members: rows.map(m => withFallbacks(m as RawMember, true)),
      schemaReady: true,
    }
  } catch {
    const rows = await prisma.teamMember.findMany({
      where: { active: true },
      select: { id: true, name: true, email: true, role: true },
      orderBy: { name: 'asc' },
    })
    return {
      members: rows.map(m => withFallbacks(m, false)),
      schemaReady: false,
    }
  }
}

export function resolveEmpNo(member: AttendanceMember, ssmId?: number | null): number {
  if (member.attendanceEmpNo != null) return member.attendanceEmpNo
  return fallbackEmpNo(member.name, ssmId ?? undefined)
}

export async function loadAttendanceAdjustments(
  memberIds: string[],
  fromKey: string,
  toKey: string,
): Promise<{ rows: AttendanceAdjustmentRow[]; schemaReady: boolean }> {
  if (memberIds.length === 0) return { rows: [], schemaReady: true }
  const from = businessDayStart(fromKey)
  const to = businessDayStart(toKey)
  try {
    const found = await prisma.attendanceAdjustment.findMany({
      where: {
        memberId: { in: memberIds },
        date: { gte: from, lte: to },
      },
      select: {
        memberId: true,
        date: true,
        grossHours: true,
        leaveHours: true,
        ebh: true,
        note: true,
      },
    })
    return {
      schemaReady: true,
      rows: found.map(r => ({
        memberId: r.memberId,
        dateKey: istDateInputValue(r.date),
        grossHours: r.grossHours,
        leaveHours: r.leaveHours,
        ebh: r.ebh,
        note: r.note,
      })),
    }
  } catch {
    return { rows: [], schemaReady: false }
  }
}
