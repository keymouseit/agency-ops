/** Attendance status for one person on one weekday. */
export type AttendanceStatus = 'OK' | 'Short' | 'Leave' | 'Absent'

export type AttendanceMember = {
  id: string
  name: string
  email: string
  role: string
  ssmEmploymentId: number | null
  attendanceEmpNo: number | null
  attendanceExcluded: boolean
  attendanceFixedStart: string | null
  attendanceFixedEnd: string | null
}

export type AttendanceAdjustmentRow = {
  memberId: string
  dateKey: string
  grossHours: string | null
  leaveHours: string | null
  ebh: string | null
  note: string | null
}

export type AttendanceDayRow = {
  memberId: string
  empNo: number
  name: string
  date: string // YYYY-MM-DD IST
  start: string | null // C-In HH:MM IST
  end: string | null // C-Out HH:MM IST
  /** Active/tracked hours from ScreenshotMonitor (sum of activity durations). */
  twh: string
  /** Gross shift span (C-Out − C-In), or manual override. */
  grossTwh: string
  /** Leave hours credited (approved leave and/or manual). */
  leaveHours: string
  /** Short working hours for the day. */
  swh: string
  /** Extra billable hours (manual). */
  ebh: string
  /** Previous short-working balance before this day. */
  psw: string
  /** Total short-working balance after this day (surplus clamped to 0). */
  tswh: string
  status: AttendanceStatus
  /** Approved leave type when applicable (not WFH). */
  leaveType: string | null
  leaveLabel: string | null
  /** True when gross/leave/ebh came from a saved adjustment. */
  hasAdjustment: boolean
  fixedHours: boolean
  /** Confirmed national/company holiday — no shortage / no Absent. */
  isHoliday: boolean
  holidayName: string | null
}

export type AttendanceSheet = {
  from: string
  to: string
  rows: AttendanceDayRow[]
  /** Confirmed holidays in the selected range (for banner UI even when nobody worked). */
  holidays: Array<{ date: string; name: string }>
  tokenMissing: boolean
  schemaReady: boolean
  fetchError: string | null
  kpis: {
    presentToday: number
    /** Full/half leave day-equivalents (full=1, half=0.5). */
    leaveApprovedDays: number
    /** Count of short-leave days across everyone. */
    leaveShortDays: number
    /** People with any approved leave (incl. short). */
    leaveApprovedPeople: number
    /** Person-days absent without leave. */
    absentWithoutLeave: number
    /** Distinct people with ≥1 absent-without-leave day. */
    absentPeople: number
    totalShortageHours: string
    /** Distinct people with period-end shortage > 0. */
    shortagePeople: number
  }
}
