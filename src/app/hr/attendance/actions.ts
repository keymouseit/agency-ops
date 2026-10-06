'use server'

import { revalidatePath } from 'next/cache'
import { requireRole } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { businessDayStart } from '@/lib/daily'
import { buildAttendanceWorkbook } from '@/lib/attendance'

const VIEW_ROLES = ['HR', 'Founder'] as const
const EDIT_ROLES = ['HR'] as const

function isHHmm(value: string | null | undefined): boolean {
  if (value == null || value === '') return true
  return /^-?\d{1,3}:\d{2}$/.test(value.trim())
}

function emptyToNull(v: string | null | undefined): string | null {
  if (v == null) return null
  const t = v.trim()
  return t === '' ? null : t
}

export type SaveAttendanceAdjustmentInput = {
  memberId: string
  date: string // YYYY-MM-DD IST
  grossHours?: string | null
  leaveHours?: string | null
  ebh?: string | null
  note?: string | null
}

async function upsertOneAdjustment(
  actorId: string,
  input: SaveAttendanceAdjustmentInput,
): Promise<void> {
  const dateKey = (input.date || '').slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
    throw Object.assign(new Error('Invalid date.'), { soft: true })
  }
  if (!input.memberId) {
    throw Object.assign(new Error('Missing member.'), { soft: true })
  }

  for (const [label, val] of [
    ['Gross hours', input.grossHours],
    ['Leave hours', input.leaveHours],
    ['EBH', input.ebh],
  ] as const) {
    if (!isHHmm(val ?? null)) {
      throw Object.assign(new Error(`${label} must look like H:MM (e.g. 8:30).`), { soft: true })
    }
  }

  const day = businessDayStart(dateKey)
  await prisma.attendanceAdjustment.upsert({
    where: {
      memberId_date: { memberId: input.memberId, date: day },
    },
    create: {
      memberId: input.memberId,
      date: day,
      grossHours: emptyToNull(input.grossHours),
      leaveHours: emptyToNull(input.leaveHours),
      ebh: emptyToNull(input.ebh),
      note: emptyToNull(input.note),
      updatedById: actorId,
    },
    update: {
      grossHours: emptyToNull(input.grossHours),
      leaveHours: emptyToNull(input.leaveHours),
      ebh: emptyToNull(input.ebh),
      note: emptyToNull(input.note),
      updatedById: actorId,
    },
  })
}

function migrationNeededMessage(msg: string) {
  return /attendanceAdjustment|Unknown arg|does not exist|column|relation/i.test(msg)
}

/** @deprecated Prefer saveAttendanceAdjustmentsBatch — kept for compatibility. */
export async function saveAttendanceAdjustment(
  input: SaveAttendanceAdjustmentInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  return saveAttendanceAdjustmentsBatch([input])
}

/** Upsert many day adjustments in one request. HR only. */
export async function saveAttendanceAdjustmentsBatch(
  inputs: SaveAttendanceAdjustmentInput[],
): Promise<{ ok: true; saved: number } | { ok: false; error: string }> {
  try {
    const { memberId: actorId, role } = await requireRole([...VIEW_ROLES])
    if (!EDIT_ROLES.includes(role as (typeof EDIT_ROLES)[number])) {
      return { ok: false, error: 'Only HR can edit attendance adjustments.' }
    }
    if (!Array.isArray(inputs) || inputs.length === 0) {
      return { ok: false, error: 'No changes to save.' }
    }
    if (inputs.length > 500) {
      return { ok: false, error: 'Too many changes in one save (max 500).' }
    }

    try {
      for (const input of inputs) {
        await upsertOneAdjustment(actorId, input)
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      if ((e as { soft?: boolean })?.soft) {
        return { ok: false, error: msg }
      }
      if (migrationNeededMessage(msg)) {
        return {
          ok: false,
          error:
            'Attendance edits need the database migration. Ask an admin to run: npx prisma db push',
        }
      }
      throw e
    }

    revalidatePath('/hr/attendance')
    return { ok: true, saved: inputs.length }
  } catch (e) {
    const err = e as { message?: string; status?: number }
    if (err.status === 401) return { ok: false, error: 'Sign in required.' }
    if (err.status === 403) return { ok: false, error: 'You do not have permission.' }
    return { ok: false, error: err.message || 'Failed to save adjustments.' }
  }
}

export async function exportAttendanceExcel(
  from: string,
  to: string,
): Promise<{ ok: true; base64: string; filename: string } | { ok: false; error: string }> {
  try {
    await requireRole([...VIEW_ROLES])
    const { buildAttendanceSheet } = await import('@/lib/attendance')
    const sheet = await buildAttendanceSheet(from, to)
    if (sheet.tokenMissing) {
      return { ok: false, error: 'SM_API_TOKEN is not configured on the server.' }
    }
    if (sheet.fetchError) {
      return { ok: false, error: sheet.fetchError }
    }
    const base64 = await buildAttendanceWorkbook(sheet.rows, from, sheet.holidays)
    return {
      ok: true,
      base64,
      filename: `Attendance_${from}_to_${to}.xlsx`,
    }
  } catch (e) {
    const err = e as { message?: string; status?: number }
    if (err.status === 401) return { ok: false, error: 'Sign in required.' }
    if (err.status === 403) return { ok: false, error: 'You do not have permission.' }
    return { ok: false, error: err.message || 'Export failed.' }
  }
}
