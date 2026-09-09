/** Company timezone — all user-facing dates and times use India Standard Time. */
export const IST_TIMEZONE = 'Asia/Kolkata'

export function formatIst(
  date: Date | string,
  options: Intl.DateTimeFormatOptions,
  locale = 'en-GB',
): string {
  return new Intl.DateTimeFormat(locale, { timeZone: IST_TIMEZONE, ...options }).format(new Date(date))
}

/** e.g. 8 Sep 2026 */
export function formatIstDate(date: Date | string) {
  return formatIst(date, { day: 'numeric', month: 'short', year: 'numeric' })
}

/** e.g. Tuesday 8 Sep */
export function formatIstWeekdayShort(date: Date | string) {
  return formatIst(date, { weekday: 'long', day: 'numeric', month: 'short' })
}

/** e.g. Tuesday 8 September */
export function formatIstWeekdayLong(date: Date | string) {
  return formatIst(date, { weekday: 'long', day: 'numeric', month: 'long' })
}

/** e.g. Tue, 8 Sep 2026 */
export function formatIstWeekdayCompact(date: Date | string) {
  return formatIst(date, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
}

export function formatIstDateTime(date: Date | string) {
  const d = new Date(date)
  return `${formatIstDate(d)} at ${formatIst(d, { hour: 'numeric', minute: '2-digit', hour12: true }, 'en-US')}`
}

export function formatIstDateTimeShort(date: Date | string) {
  return formatIst(
    date,
    { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true },
    'en-US',
  )
}

/** YYYY-MM-DD in IST — use for date inputs, never UTC `toISOString().slice(0, 10)`. */
export function istDateInputValue(date: Date | string = new Date()) {
  return formatIst(date, { year: 'numeric', month: '2-digit', day: '2-digit' }, 'en-CA')
}

/** Next calendar day as YYYY-MM-DD in IST. Google all-day events use an exclusive end date. */
export function istNextDateInputValue(date: Date | string) {
  const key = istDateInputValue(date)
  const [year, month, day] = key.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day + 1)).toISOString().slice(0, 10)
}

export function isSameIstDay(a: Date | string, b: Date | string) {
  return istDateInputValue(a) === istDateInputValue(b)
}

export function formatIstLeaveRange(start: Date | string, end: Date | string) {
  if (isSameIstDay(start, end)) return formatIstDate(start)
  return `${formatIstDate(start)} – ${formatIstDate(end)}`
}

export function istHour(date = new Date()) {
  const hour = new Intl.DateTimeFormat('en-GB', {
    timeZone: IST_TIMEZONE,
    hour: 'numeric',
    hourCycle: 'h23',
  })
    .formatToParts(date)
    .find(p => p.type === 'hour')?.value
  return Number(hour)
}

/** Calendar year and month (1–12) in IST. */
export function istYearAndMonth(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: IST_TIMEZONE,
    year: 'numeric',
    month: 'numeric',
  }).formatToParts(date)
  return {
    year: Number(parts.find(p => p.type === 'year')?.value),
    month: Number(parts.find(p => p.type === 'month')?.value),
  }
}

export function isIstWeekend(date: Date | string = new Date()) {
  const weekday = formatIst(date, { weekday: 'short' }, 'en-US')
  return weekday === 'Sat' || weekday === 'Sun'
}
