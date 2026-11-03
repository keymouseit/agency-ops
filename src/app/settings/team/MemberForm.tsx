'use client'
import { useState, type ReactNode } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { DESIGNATION_MAX_LENGTH } from '@/lib/team-permissions'

export type MemberFormValues = {
  name: string
  email: string
  designation: string
  role: string
  active: boolean
  attendanceExcluded: boolean
  birthday: string // YYYY-MM-DD or ''
  joiningDate: string // YYYY-MM-DD or ''
}

type FieldKey = keyof MemberFormValues | 'password'
type FieldErrors = Partial<Record<FieldKey, string>>

/** Map the API's single error string onto the field it is about (falls back to the banner). */
function fieldForApiError(message: string): FieldKey | null {
  const m = message.toLowerCase()
  if (m.startsWith('birthday')) return 'birthday'
  if (m.startsWith('joining date')) return 'joiningDate'
  if (m.includes('designation')) return 'designation'
  if (m.includes('email')) return 'email'
  if (m.includes('role')) return 'role'
  if (m.includes('password')) return 'password'
  return null
}

function Section({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: ReactNode
}) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="px-4 sm:px-5 py-3.5 border-b border-gray-100">
        <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
        <p className="text-xs text-gray-500 mt-0.5">{description}</p>
      </div>
      <div className="p-4 sm:p-5 grid grid-cols-1 md:grid-cols-2 gap-4">{children}</div>
    </section>
  )
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return <p className="mt-1 text-xs text-red-600">{message}</p>
}

export default function MemberForm({
  mode,
  memberId,
  initialValues,
  roleOptions,
  backHref,
}: {
  mode: 'create' | 'edit'
  memberId?: string
  initialValues: MemberFormValues
  /** Already filtered server-side with canAssignRole for the viewer. */
  roleOptions: { value: string; label: string }[]
  backHref: string
}) {
  const router = useRouter()
  const [values, setValues] = useState<MemberFormValues>(initialValues)
  const [password, setPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})

  const isEdit = mode === 'edit'

  function set<K extends keyof MemberFormValues>(key: K, value: MemberFormValues[K]) {
    setValues(v => ({ ...v, [key]: value }))
    if (fieldErrors[key]) setFieldErrors(f => ({ ...f, [key]: undefined }))
  }

  function validate(): FieldErrors {
    const errs: FieldErrors = {}
    if (!values.name.trim()) errs.name = 'Full name is required'
    if (!values.email.trim()) errs.email = 'Official email is required'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) errs.email = 'Enter a valid email'
    if (!values.role) errs.role = 'Role is required'
    if (!isEdit && !password) errs.password = 'Password is required for a new member'
    if (values.designation.trim().length > DESIGNATION_MAX_LENGTH) {
      errs.designation = `At most ${DESIGNATION_MAX_LENGTH} characters`
    }
    return errs
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    const errs = validate()
    setFieldErrors(errs)
    if (Object.keys(errs).length > 0) return

    setSaving(true)
    try {
      const body: Record<string, unknown> = {
        name: values.name.trim(),
        email: values.email.trim(),
        designation: values.designation.trim() || null,
        role: values.role,
        active: values.active,
        attendanceExcluded: values.attendanceExcluded,
        birthday: values.birthday || null,
        joiningDate: values.joiningDate || null,
      }
      if (password) body.password = password

      const res = await fetch(isEdit ? `/api/team/${memberId}` : '/api/team', {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json().catch(() => ({}))

      if (!res.ok) {
        const message: string = json.error || 'Failed to save member'
        const field = fieldForApiError(message)
        if (field) setFieldErrors({ [field]: message })
        else setError(message)
        return
      }

      if (json.warning) alert(json.warning)
      const id: string | undefined = json.member?.id ?? memberId
      router.push(id ? `/settings/team/${id}` : '/settings')
      router.refresh()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save member')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">{error}</div>
      )}

      <Section title="Basic info" description="Name, official email, and job title">
        <div>
          <label className="label" htmlFor="name">Full name *</label>
          <input
            id="name"
            type="text"
            value={values.name}
            onChange={e => set('name', e.target.value)}
            className="input"
            placeholder="John Doe"
            autoComplete="off"
          />
          <FieldError message={fieldErrors.name} />
        </div>
        <div>
          <label className="label" htmlFor="email">Official email *</label>
          <input
            id="email"
            type="email"
            value={values.email}
            onChange={e => set('email', e.target.value)}
            className="input"
            placeholder="john@company.com"
            autoComplete="off"
          />
          <FieldError message={fieldErrors.email} />
          <p className="mt-1 text-xs text-gray-400">Used to sign in</p>
        </div>
        <div className="md:col-span-2">
          <label className="label" htmlFor="designation">Designation</label>
          <input
            id="designation"
            type="text"
            maxLength={DESIGNATION_MAX_LENGTH}
            value={values.designation}
            onChange={e => set('designation', e.target.value)}
            className="input"
            placeholder="e.g. Senior Software Engineer"
          />
          <FieldError message={fieldErrors.designation} />
          <p className="mt-1 text-xs text-gray-400">Job title shown on the profile (separate from the access role)</p>
        </div>
      </Section>

      <Section title="Access" description="What they can see and whether they can sign in">
        <div>
          <label className="label" htmlFor="role">Role *</label>
          <select
            id="role"
            value={values.role}
            onChange={e => set('role', e.target.value)}
            className="input"
          >
            {roleOptions.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <FieldError message={fieldErrors.role} />
          <p className="mt-1 text-xs text-gray-400">System access role (controls which pages they can use)</p>
        </div>
        <div>
          <label className="label" htmlFor="password">
            {isEdit ? 'Set new password' : 'Password *'}
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={e => {
              setPassword(e.target.value)
              if (fieldErrors.password) setFieldErrors(f => ({ ...f, password: undefined }))
            }}
            className="input"
            placeholder={isEdit ? 'Leave blank to keep current password' : 'Enter password'}
            autoComplete="new-password"
          />
          <FieldError message={fieldErrors.password} />
        </div>
        <div className="md:col-span-2 flex flex-col gap-3">
          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input
              type="checkbox"
              checked={values.active}
              onChange={e => set('active', e.target.checked)}
            />
            Active (member can log in)
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input
              type="checkbox"
              checked={values.attendanceExcluded}
              onChange={e => set('attendanceExcluded', e.target.checked)}
            />
            Exclude from attendance tracking
          </label>
        </div>
      </Section>

      <Section title="Dates" description="Used for birthday and work anniversary reminders">
        <div>
          <label className="label" htmlFor="birthday">Date of birth</label>
          <input
            id="birthday"
            type="date"
            value={values.birthday}
            onChange={e => set('birthday', e.target.value)}
            className="input"
          />
          <FieldError message={fieldErrors.birthday} />
        </div>
        <div>
          <label className="label" htmlFor="joiningDate">Joining date (work anniversary)</label>
          <input
            id="joiningDate"
            type="date"
            value={values.joiningDate}
            onChange={e => set('joiningDate', e.target.value)}
            className="input"
          />
          <FieldError message={fieldErrors.joiningDate} />
          <p className="mt-1 text-xs text-gray-400">If blank, the account creation date is shown instead</p>
        </div>
      </Section>

      <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
        <Link href={backHref} prefetch={false} className="btn-secondary">
          Cancel
        </Link>
        <button type="submit" disabled={saving} className="btn-primary disabled:opacity-60">
          {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Add employee'}
        </button>
      </div>
    </form>
  )
}
