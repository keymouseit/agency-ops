import { getExpectedHoursBatch } from '@/lib/expected-hours'
import { istDateInputValue } from '@/lib/ist'
import { businessDayStart } from '@/lib/daily'
import { getHolidayName, holidaysInRange, isHoliday } from '@/lib/holidays'
import { namesLikelyMatch, shouldExcludeFromAttendance } from './fallbacks'
import {
  applyRunningBalance,
  computeDayStatus,
  leaveHoursForApprovedType,
  leaveTypeDisplayLabel,
  secondsToTime,
  sumTswhSeconds,
  timeToSeconds,
  weekdayKeysInRange,
} from './math'
import { loadAttendanceAdjustments, loadAttendanceMembers, resolveEmpNo } from './members'
import {
  fetchSsmActivities,
  fetchSsmEmployments,
  hasScreenshotMonitorToken,
  rollupActivitiesByDay,
  type SsmDayActivity,
} from './ssm'
import type { AttendanceDayRow, AttendanceMember, AttendanceSheet } from './types'

function matchMemberToEmployment(
  member: AttendanceMember,
  employments: Array<{ id: number; name: string }>,
): number | null {
  if (member.ssmEmploymentId != null) {
    const hit = employments.find(e => e.id === member.ssmEmploymentId)
    if (hit) return hit.id
  }
  const byName = employments.find(e => namesLikelyMatch(member.name, e.name))
  return byName?.id ?? null
}

function fixedGrossAndTimes(start: string, end: string): {
  start: string
  end: string
  grossTwh: string
  twh: string
} {
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  let sec = eh * 3600 + em * 60 - (sh * 3600 + sm * 60)
  if (sec < 0) sec += 24 * 3600
  const t = secondsToTime(sec)
  return { start, end, grossTwh: t, twh: t }
}

/**
 * Build the attendance sheet for an inclusive IST date range.
 * Safe to call before the Prisma migration is applied (edits won't persist).
 */
export async function buildAttendanceSheet(fromKey: string, toKey: string): Promise<AttendanceSheet> {
  const todayKey = istDateInputValue()
  // Never include the live day — mid-shift hours look Short for everyone.
  const maxTo = (() => {
    const [y, m, d] = todayKey.split('-').map(Number)
    return new Date(Date.UTC(y, m - 1, d - 1)).toISOString().slice(0, 10)
  })()
  const rawFrom = fromKey <= toKey ? fromKey : toKey
  const rawTo = fromKey <= toKey ? toKey : fromKey
  const to = rawTo > maxTo ? maxTo : rawTo
  const from = rawFrom > to ? to : rawFrom

  const rangeHolidays = holidaysInRange(from, to).filter(h => h.date < todayKey)

  const emptyKpis = {
    presentToday: 0,
    leaveApprovedDays: 0,
    leaveShortDays: 0,
    leaveApprovedPeople: 0,
    absentWithoutLeave: 0,
    absentPeople: 0,
    totalShortageHours: '0:00',
    shortagePeople: 0,
  }

  if (!hasScreenshotMonitorToken()) {
    return {
      from,
      to,
      rows: [],
      holidays: rangeHolidays,
      tokenMissing: true,
      schemaReady: false,
      fetchError: null,
      kpis: emptyKpis,
    }
  }

  const { members: allMembers, schemaReady: membersSchemaReady } = await loadAttendanceMembers()
  const members = allMembers.filter(
    m =>
      !m.attendanceExcluded &&
      !shouldExcludeFromAttendance({
        name: m.name,
        email: m.email,
        role: m.role,
        attendanceExcluded: m.attendanceExcluded,
      }),
  )

  const weekdays = weekdayKeysInRange(from, to).filter(d => d < todayKey)
  if (members.length === 0 || weekdays.length === 0) {
    return {
      from,
      to,
      rows: [],
      holidays: rangeHolidays,
      tokenMissing: false,
      schemaReady: membersSchemaReady,
      fetchError: null,
      kpis: emptyKpis,
    }
  }

  let employments: Array<{ id: number; name: string }> = []
  let dayActivities: SsmDayActivity[] = []
  let fetchError: string | null = null

  try {
    employments = await fetchSsmEmployments()
    const memberEmploymentIds = new Map<string, number>()
    for (const m of members) {
      const eid = matchMemberToEmployment(m, employments)
      if (eid != null) memberEmploymentIds.set(m.id, eid)
    }

    // Also fetch any employment we can match so we don't miss activity
    const ids = [...new Set([...memberEmploymentIds.values(), ...employments.map(e => e.id)])]
    const activities = await fetchSsmActivities(ids, from, to)
    const nameById = new Map(employments.map(e => [e.id, e.name]))
    dayActivities = rollupActivitiesByDay(activities, nameById)
  } catch (e) {
    fetchError = e instanceof Error ? e.message : 'Failed to fetch ScreenshotMonitor data'
  }

  const activityByMemberDate = new Map<string, SsmDayActivity>()
  const employmentToMember = new Map<number, string>()
  for (const m of members) {
    const eid = matchMemberToEmployment(m, employments)
    if (eid != null) employmentToMember.set(eid, m.id)
  }
  for (const act of dayActivities) {
    const memberId = employmentToMember.get(act.employmentId)
    if (!memberId) {
      // Try late name match against members
      const m = members.find(x => namesLikelyMatch(x.name, act.name))
      if (!m) continue
      activityByMemberDate.set(`${m.id}-${act.date}`, act)
      continue
    }
    activityByMemberDate.set(`${memberId}-${act.date}`, act)
  }

  const memberIds = members.map(m => m.id)
  const expectedBatch = await getExpectedHoursBatch(
    memberIds,
    businessDayStart(from),
    businessDayStart(to),
  )

  const { rows: adjustments, schemaReady: adjSchemaReady } = await loadAttendanceAdjustments(
    memberIds,
    from,
    to,
  )
  const adjMap = new Map(adjustments.map(a => [`${a.memberId}-${a.dateKey}`, a]))
  const schemaReady = membersSchemaReady && adjSchemaReady

  const rawRows: AttendanceDayRow[] = []

  for (const date of weekdays) {
    const holidayName = getHolidayName(date)
    const dateIsHoliday = Boolean(holidayName)

    for (const member of members) {
      const empNo = resolveEmpNo(member, matchMemberToEmployment(member, employments))
      const act = activityByMemberDate.get(`${member.id}-${date}`)

      // Holidays: no Absent, no expected hours, leave ignored. Only show people who actually worked (SM activity).
      if (dateIsHoliday) {
        if (!act) continue
        const grossTwh = secondsToTime(act.grossSeconds)
        const twh = secondsToTime(act.twhSeconds)
        const adj = adjMap.get(`${member.id}-${date}`)
        let gross = grossTwh
        let leaveHours = '0:00'
        let ebh = '0:00'
        let hasAdjustment = false
        if (adj) {
          hasAdjustment = true
          if (adj.grossHours != null && adj.grossHours !== '') gross = adj.grossHours
          if (adj.leaveHours != null && adj.leaveHours !== '') leaveHours = adj.leaveHours
          if (adj.ebh != null && adj.ebh !== '') ebh = adj.ebh
        }
        rawRows.push({
          memberId: member.id,
          empNo,
          name: member.name,
          date,
          start: act.start,
          end: act.end,
          twh,
          grossTwh: gross,
          leaveHours,
          swh: '0:00',
          ebh,
          psw: '0:00',
          tswh: '0:00',
          status: 'OK',
          leaveType: null,
          leaveLabel: null,
          hasAdjustment,
          fixedHours: false,
          isHoliday: true,
          holidayName,
        })
        continue
      }

      const expected = expectedBatch.get(member.id)?.get(date)
      // Keep leave type on the row for UI colors (incl. WFH); hours still 0 for WFH.
      const approvedLeaveType = expected?.leaveType ?? null
      const approvedLeaveHoursH =
        approvedLeaveType != null ? leaveHoursForApprovedType(approvedLeaveType) : 0
      const approvedLeaveHours = approvedLeaveHoursH > 0 ? secondsToTime(approvedLeaveHoursH * 3600) : '0:00'

      const adj = adjMap.get(`${member.id}-${date}`)
      const fixed =
        member.attendanceFixedStart && member.attendanceFixedEnd
          ? fixedGrossAndTimes(member.attendanceFixedStart, member.attendanceFixedEnd)
          : null

      let start: string | null = null
      let end: string | null = null
      let twh = '0:00'
      let grossTwh = '0:00'
      let hasActivity = false

      if (fixed) {
        start = fixed.start
        end = fixed.end
        twh = fixed.twh
        grossTwh = fixed.grossTwh
        hasActivity = true
      } else if (act) {
        start = act.start
        end = act.end
        twh = secondsToTime(act.twhSeconds)
        grossTwh = secondsToTime(act.grossSeconds)
        hasActivity = true
      }

      let leaveHours = approvedLeaveHours
      let ebh = '0:00'
      let hasAdjustment = false

      if (adj) {
        hasAdjustment = true
        if (adj.grossHours != null && adj.grossHours !== '') grossTwh = adj.grossHours
        if (adj.leaveHours != null && adj.leaveHours !== '') leaveHours = adj.leaveHours
        if (adj.ebh != null && adj.ebh !== '') ebh = adj.ebh
      }

      // Approved leave (incl. WFH for row color) drives Leave Hrs / status unless fixed-hours override.
      let leaveType = approvedLeaveType
      let leaveLabel =
        leaveType != null
          ? leaveTypeDisplayLabel(leaveType, expected?.timeSlot ?? null)
          : null

      // Fixed-hours override (Sushant-style): always present with static C-In/C-Out — wins over leave/absence.
      let status: AttendanceDayRow['status']
      let swh: string
      if (fixed) {
        const computed = computeDayStatus({
          grossTwh,
          leaveHours: adj?.leaveHours ? leaveHours : '0:00',
          leaveType: null,
          hasActivity: true,
          fixedHours: true,
        })
        status = computed.status
        swh = computed.swh
        leaveType = null
        leaveLabel = null
      } else {
        const computed = computeDayStatus({
          grossTwh,
          leaveHours,
          leaveType,
          hasActivity,
          fixedHours: false,
        })
        status = computed.status
        swh = computed.swh
      }

      let finalStatus = status
      let finalLeaveLabel = leaveLabel
      if (status === 'Absent') {
        finalLeaveLabel = 'Absent (no leave)'
      } else if (status === 'Leave' && !finalLeaveLabel) {
        finalLeaveLabel = 'Leave'
      }

      // If full-day leave, zero out times for display (like old sheet)
      if (finalStatus === 'Leave') {
        start = null
        end = null
        twh = '0:00'
        if (!adj?.grossHours) grossTwh = '0:00'
      }

      rawRows.push({
        memberId: member.id,
        empNo,
        name: member.name,
        date,
        start,
        end,
        twh,
        grossTwh,
        leaveHours,
        swh,
        ebh,
        psw: '0:00',
        tswh: '0:00',
        status: finalStatus,
        leaveType,
        leaveLabel: finalLeaveLabel,
        hasAdjustment,
        fixedHours: Boolean(fixed),
        isHoliday: false,
        holidayName: null,
      })
    }
  }

  const rows = applyRunningBalance(rawRows)

  // "Present" for the latest completed *working* day (skip holidays — they are not attendance days).
  const workingRows = rows.filter(r => !r.isHoliday && !isHoliday(r.date))
  const latestDay = workingRows.reduce<string | null>((max, r) => (!max || r.date > max ? r.date : max), null)
  const latestDayRows = latestDay ? workingRows.filter(r => r.date === latestDay) : []
  const presentToday = latestDayRows.filter(r => r.status === 'OK' || r.status === 'Short').length

  const absentWithoutLeave = workingRows.filter(r => r.status === 'Absent').length
  const absentPeople = new Set(workingRows.filter(r => r.status === 'Absent').map(r => r.memberId)).size

  let leaveApprovedDays = 0
  let leaveShortDays = 0
  const leavePeople = new Set<string>()
  for (const r of workingRows) {
    if (r.status === 'Absent') continue
    const lt = r.leaveType
    if (!lt || lt === 'work_from_home') continue
    leavePeople.add(r.memberId)
    if (lt === 'short_leave') leaveShortDays += 1
    else if (lt === 'half_day') leaveApprovedDays += 0.5
    else leaveApprovedDays += 1
  }
  // Keep one decimal max
  leaveApprovedDays = Math.round(leaveApprovedDays * 10) / 10

  const totalShortageHours = secondsToTime(sumTswhSeconds(rows))
  const finalTswh = new Map<string, number>()
  for (const r of rows) finalTswh.set(r.memberId, timeToSeconds(r.tswh))
  const shortagePeople = [...finalTswh.values()].filter(s => s > 0).length

  return {
    from,
    to,
    rows,
    holidays: rangeHolidays,
    tokenMissing: false,
    schemaReady,
    fetchError,
    kpis: {
      presentToday,
      leaveApprovedDays,
      leaveShortDays,
      leaveApprovedPeople: leavePeople.size,
      absentWithoutLeave,
      absentPeople,
      totalShortageHours,
      shortagePeople,
    },
  }
}

