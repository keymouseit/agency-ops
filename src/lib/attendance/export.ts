import type { AttendanceDayRow } from './types'
import { getHolidayName } from '@/lib/holidays'
import { attendanceRowBgHex, isWeekendDateKey } from './math'

type CellOpts = {
  bg?: string
  color?: string
  bold?: boolean
  sz?: number
  align?: 'center' | 'left' | 'right'
  border?: boolean
}

/**
 * Build a styled Attendance_Report.xlsx workbook (ported from attendance-dashboard).
 * Uses xlsx-js-style when available; falls back to plain xlsx.
 */
export async function buildAttendanceWorkbook(
  rows: AttendanceDayRow[],
  fallbackStartDate: string,
  holidays: Array<{ date: string; name: string }> = [],
) {
  // Prefer xlsx-js-style for cell styling; fall back to plain xlsx until installed.
  let XLSX: any
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const styled = await import('xlsx-js-style')
    XLSX = (styled as any).default ?? styled
  } catch {
    XLSX = await import('xlsx')
  }

  const createCell = (value: unknown, options: CellOpts = {}) => {
    const style: Record<string, unknown> = {
      font: {
        name: 'Arial',
        sz: options.sz || 11,
        bold: !!options.bold,
        ...(options.color ? { color: { rgb: options.color.replace('#', '') } } : {}),
      },
      alignment: {
        horizontal: options.align || 'center',
        vertical: 'center',
        wrapText: true,
      },
    }
    if (options.bg) {
      style.fill = {
        patternType: 'solid',
        fgColor: { rgb: options.bg.replace('#', '') },
      }
    }
    if (options.border !== false) {
      style.border = {
        top: { style: 'thin', color: { rgb: '000000' } },
        bottom: { style: 'thin', color: { rgb: '000000' } },
        left: { style: 'thin', color: { rgb: '000000' } },
        right: { style: 'thin', color: { rgb: '000000' } },
      }
    }
    return {
      v: value as string | number,
      t: typeof value === 'number' ? 'n' : 's',
      s: style,
    }
  }

  const groups: Record<string, AttendanceDayRow[]> = {}
  for (const rec of rows) {
    const d = rec.date || fallbackStartDate
    if (isWeekendDateKey(d)) continue
    if (!groups[d]) groups[d] = []
    groups[d].push(rec)
  }
  const holidayByDate = new Map(holidays.map(h => [h.date, h.name]))
  for (const h of holidays) {
    if (!groups[h.date]) groups[h.date] = []
  }
  // Also pick up holiday flags from rows
  for (const rec of rows) {
    if (rec.isHoliday && rec.holidayName) holidayByDate.set(rec.date, rec.holidayName)
  }
  const sortedDates = Object.keys(groups).sort()

  const ws: Record<string, unknown> = {}
  const merges: Array<{ s: { r: number; c: number }; e: { r: number; c: number } }> = []
  let currentRow = 0

  ws['!cols'] = [
    { wch: 12 },
    { wch: 25 },
    { wch: 10 },
    { wch: 10 },
    { wch: 12 },
    { wch: 12 },
    { wch: 12 },
    { wch: 10 },
    { wch: 14 },
    { wch: 10 },
    { wch: 10 },
    { wch: 10 },
  ]

  const setCell = (r: number, c: number, cellObj: unknown) => {
    const cellRef = XLSX.utils.encode_cell({ r, c })
    ws[cellRef] = cellObj
  }

  sortedDates.forEach((dateStr, groupIdx) => {
    const dateRecords = groups[dateStr].sort((a, b) => a.empNo - b.empNo || a.name.localeCompare(b.name))
    const [y, m, d] = dateStr.split('-').map(Number)
    const formattedDate = new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString('en-US', {
      timeZone: 'UTC',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      weekday: 'long',
    })

    if (groupIdx > 0) currentRow++

    const holidayName = holidayByDate.get(dateStr) || getHolidayName(dateStr)
    const headerLabel = holidayName
      ? `${formattedDate} · ${holidayName} · Holiday`
      : formattedDate
    const headerBg = holidayName ? 'ECFDF5' : 'FFFFFF' // emerald-50

    merges.push({ s: { r: currentRow, c: 0 }, e: { r: currentRow, c: 11 } })
    for (let col = 0; col < 12; col++) {
      setCell(
        currentRow,
        col,
        createCell(headerLabel, { bold: true, sz: 12, align: 'center', bg: headerBg }),
      )
    }
    currentRow++

    // Holiday with nobody working: banner only
    if (holidayName && dateRecords.length === 0) {
      return
    }

    const headers = [
      'EMP No.',
      'EMP Name',
      'C-In',
      'C-Out',
      'Gross Hrs',
      'TWH (SM)',
      'Leave Hrs',
      'SWH',
      'Status',
      'EBH',
      'PSW',
      'TSWH',
    ]
    headers.forEach((h, col) => {
      setCell(currentRow, col, createCell(h, { bold: true, align: 'center', bg: 'FFFFFF' }))
    })
    currentRow++

    dateRecords.forEach(emp => {
      const isLeave = emp.status === 'Leave' || emp.status === 'Absent'
      const rowBg = attendanceRowBgHex(emp)
      const std = (align: 'center' | 'left' = 'center') => ({
        align,
        bg: rowBg,
      })

      setCell(currentRow, 0, createCell(emp.empNo || '', { align: 'center', bg: 'FFFFFF' }))
      setCell(currentRow, 1, createCell(emp.name, { align: 'left', bg: 'FFFFFF' }))

      if (isLeave) {
        merges.push({ s: { r: currentRow, c: 2 }, e: { r: currentRow, c: 11 } })
        const label =
          emp.status === 'Absent' ? emp.leaveLabel || 'Absent (no leave)' : emp.leaveLabel || 'Leave'
        const bg =
          emp.status === 'Absent'
            ? 'FED7AA' // orange-200
            : emp.leaveType === 'half_day'
              ? 'FEE2E2'
              : 'FECACA' // red-200 for full-day leave
        for (let col = 2; col < 12; col++) {
          setCell(currentRow, col, createCell(label, { bold: true, align: 'center', bg, color: '000000' }))
        }
      } else {
        setCell(currentRow, 2, createCell(emp.start || '', std()))
        setCell(currentRow, 3, createCell(emp.end || '', std()))
        setCell(currentRow, 4, createCell(emp.grossTwh || '', std()))
        setCell(currentRow, 5, createCell(emp.twh || '', std()))
        setCell(currentRow, 6, createCell(emp.leaveHours || '0:00', std()))
        setCell(currentRow, 7, createCell(emp.swh || '', std()))
        const statusText =
          emp.leaveLabel && (emp.status === 'Short' || emp.status === 'OK')
            ? `${emp.leaveLabel}${emp.status === 'Short' ? ' · Short' : ''}`
            : emp.status || ''
        setCell(currentRow, 8, createCell(statusText, std()))
        setCell(currentRow, 9, createCell(emp.ebh || '0:00', std()))
        const hasPsw = emp.psw && emp.psw !== '0:00'
        setCell(currentRow, 10, createCell(emp.psw || '0:00', {
          align: 'center',
          bg: rowBg,
          color: hasPsw ? 'FF0000' : undefined,
        }))
        const hasTswh = emp.tswh && emp.tswh !== '0:00'
        setCell(currentRow, 11, createCell(emp.tswh || '0:00', {
          align: 'center',
          bg: rowBg,
          color: hasTswh ? 'FF0000' : undefined,
        }))
      }
      currentRow++
    })
  })

  ws['!ref'] = XLSX.utils.encode_range({
    s: { r: 0, c: 0 },
    e: { r: Math.max(currentRow - 1, 0), c: 11 },
  })
  ws['!merges'] = merges

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Attendance')
  const out = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' }) as string
  return out
}
