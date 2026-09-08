/** Official staff numbers — used to order employees on leave pages. */
const EMPLOYEE_NO_BY_FIRST_NAME: Record<string, number> = {
  manjinder: 111,
  gaurav: 114,
  vikas: 180,
  sushant: 199,
  reema: 204,
  gurleen: 206,
  vikram: 219,
  deepanshu: 230,
  khushi: 232,
  anshuman: 233,
  harshil: 235,
  shruti: 236,
}

/** Two people share the first name Vishal. */
const VISHAL_NO_BY_LAST_NAME: Record<string, number> = {
  sharma: 116,
  ghangale: 231,
  g: 231,
}

export function employeeStaffNo(name: string): number | null {
  const parts = name.trim().toLowerCase().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return null

  const first = parts[0]
  const last = parts[parts.length - 1]

  if (first === 'vishal') {
    if (last === 'g' || last.startsWith('ghangale')) return 231
    if (last === 'sharma') return 116
    return VISHAL_NO_BY_LAST_NAME[last] ?? null
  }

  return EMPLOYEE_NO_BY_FIRST_NAME[first] ?? null
}

export function compareByEmployeeNo(aName: string, bName: string) {
  const a = employeeStaffNo(aName)
  const b = employeeStaffNo(bName)
  if (a != null && b != null && a !== b) return a - b
  if (a != null && b == null) return -1
  if (a == null && b != null) return 1
  return aName.localeCompare(bName, undefined, { sensitivity: 'base' })
}

export function sortByEmployeeNo<T extends { name: string }>(members: T[]): T[] {
  return [...members].sort((a, b) => compareByEmployeeNo(a.name, b.name))
}
