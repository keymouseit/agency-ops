/**
 * Who may manage team member profiles (Settings → Team members, /api/team).
 *
 * - Founder / Manager: full management (any role, passwords, all members).
 * - HR: may create members and edit name, email, designation, birthday,
 *   joining date, active status, role and password — but only for members whose
 *   role is NOT Founder/Manager, and may never assign the Founder/Manager role.
 */
export const TEAM_EDITOR_ROLES = ['Founder', 'Manager', 'HR']
export const PRIVILEGED_ROLES = ['Founder', 'Manager']

export function isPrivilegedRole(role: string | null | undefined): boolean {
  return !!role && PRIVILEGED_ROLES.includes(role)
}

export function canEditTeam(actorRole: string | null | undefined): boolean {
  return !!actorRole && TEAM_EDITOR_ROLES.includes(actorRole)
}

/** Whether `actorRole` may assign `targetRole` to a member. */
export function canAssignRole(actorRole: string | null | undefined, targetRole: string): boolean {
  if (!canEditTeam(actorRole)) return false
  if (actorRole === 'HR') return !isPrivilegedRole(targetRole)
  return true
}

/** Whether `actorRole` may edit an existing member who currently has `memberRole`. */
export function canEditMember(actorRole: string | null | undefined, memberRole: string): boolean {
  if (!canEditTeam(actorRole)) return false
  if (actorRole === 'HR') return !isPrivilegedRole(memberRole)
  return true
}

export const DESIGNATION_MAX_LENGTH = 100

/**
 * Parse an optional date field from a JSON body.
 * undefined → undefined (field not sent), '' / null → null (clear), valid date → Date.
 * Returns { error } for anything unparseable.
 */
export function parseOptionalDate(
  value: unknown,
): { value: Date | null | undefined } | { error: string } {
  if (value === undefined) return { value: undefined }
  if (value === null || value === '') return { value: null }
  if (typeof value !== 'string' && !(value instanceof Date)) return { error: 'Invalid date' }
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return { error: 'Invalid date' }
  const year = d.getUTCFullYear()
  if (year < 1900 || year > 2100) return { error: 'Date is out of range' }
  return { value: d }
}

/** Parse an optional designation: undefined → undefined, ''/null/whitespace → null, else trimmed string. */
export function parseOptionalDesignation(
  value: unknown,
): { value: string | null | undefined } | { error: string } {
  if (value === undefined) return { value: undefined }
  if (value === null) return { value: null }
  if (typeof value !== 'string') return { error: 'Designation must be text' }
  const trimmed = value.trim()
  if (!trimmed) return { value: null }
  if (trimmed.length > DESIGNATION_MAX_LENGTH) {
    return { error: `Designation must be at most ${DESIGNATION_MAX_LENGTH} characters` }
  }
  return { value: trimmed }
}

/** All system access roles, in the order shown in role pickers. */
export const ROLE_OPTIONS: { value: string; label: string }[] = [
  { value: 'BD', label: 'BD' },
  { value: 'Dev', label: 'Dev' },
  { value: 'QA', label: 'QA' },
  { value: 'Both', label: 'Both' },
  { value: 'HR', label: 'HR' },
  { value: 'SocialMedia', label: 'Social Media' },
  { value: 'Manager', label: 'Manager' },
  { value: 'Founder', label: 'Founder' },
]

/** Role options `actorRole` may assign (HR never sees Founder/Manager). */
export function assignableRoleOptions(actorRole: string | null | undefined) {
  return ROLE_OPTIONS.filter(o => canAssignRole(actorRole, o.value))
}

/** YYYY-MM-DD for a date input (dates are stored as UTC midnight of the chosen day). */
export function toDateInputValue(v: Date | string | null | undefined): string {
  if (!v) return ''
  const d = typeof v === 'string' ? new Date(v) : v
  if (Number.isNaN(d.getTime())) return ''
  return d.toISOString().slice(0, 10)
}
