import { fmtDate } from '@/lib/utils'
import {
  describeDaysUntil,
  nextOccurrence,
  nextWorkAnniversary,
  yearsCompleted,
} from '@/lib/employee-dates'

export type ProfileDetailsMember = {
  name: string
  email: string
  role: string
  designation: string | null
  birthday: Date | null
  joiningDate: Date | null
}

function roleLabel(role: string) {
  return role === 'SocialMedia' ? 'Social Media' : role
}

function DetailItem({
  label,
  value,
  hint,
}: {
  label: string
  value: string | null | undefined
  hint?: React.ReactNode
}) {
  const isSet = !!value && value.trim().length > 0
  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50/50 px-4 py-3 min-w-0">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
      <p className={`text-sm font-medium mt-0.5 break-words ${isSet ? 'text-gray-900' : 'text-gray-400'}`}>
        {isSet ? value : 'Not set'}
      </p>
      {isSet && hint && <div className="text-xs text-gray-500 mt-1">{hint}</div>}
    </div>
  )
}

/**
 * Read-only "Profile details" card for the logged-in user's own account page.
 * Server component: date math uses the IST calendar day at request time.
 * All fields (including name and email) are managed by HR/Admin via /settings/team/[id]/edit;
 * employees cannot edit them here.
 */
export default function ProfileDetailsCard({ member }: { member: ProfileDetailsMember }) {
  const today = new Date()
  const { birthday, joiningDate } = member

  const nextBirthday = birthday ? nextOccurrence(birthday, today) : null
  const nextAnniversary = joiningDate ? nextWorkAnniversary(joiningDate, today) : null
  const tenureYears = joiningDate ? yearsCompleted(joiningDate, today) : null
  const joinedInFuture = !!joiningDate && joiningDate.getTime() > today.getTime()

  const birthdayHint = nextBirthday ? (
    nextBirthday.isToday ? (
      <span className="font-semibold text-pink-600">🎂 Today — Happy birthday!</span>
    ) : (
      <>
        Next birthday: {fmtDate(nextBirthday.date)} · {describeDaysUntil(nextBirthday.daysUntil)}
      </>
    )
  ) : null

  const joiningHint = joiningDate ? (
    <>
      <p>
        {joinedInFuture
          ? 'Starts soon'
          : tenureYears === 0
            ? 'Less than a year completed'
            : `${tenureYears} year${tenureYears === 1 ? '' : 's'} completed`}
      </p>
      {nextAnniversary && (
        <p className="mt-0.5 font-medium text-gray-600">
          {nextAnniversary.isToday ? (
            <span className="text-indigo-600">
              🎉 Today — {nextAnniversary.years} year{nextAnniversary.years === 1 ? '' : 's'} work anniversary!
            </span>
          ) : (
            <>
              Next work anniversary: {fmtDate(nextAnniversary.date)} ({nextAnniversary.years} year
              {nextAnniversary.years === 1 ? '' : 's'}) · {describeDaysUntil(nextAnniversary.daysUntil)}
            </>
          )}
        </p>
      )}
    </>
  ) : null

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/60">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white border border-gray-100 text-base shadow-sm">
            🪪
          </span>
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Profile details</h2>
            <p className="text-xs text-gray-500">Your employee details as recorded by Admin/HR</p>
          </div>
        </div>
      </div>

      <div className="p-5 space-y-4">
        <div className="grid sm:grid-cols-2 gap-4">
          <DetailItem label="Name" value={member.name} />
          <DetailItem label="Official email" value={member.email} />
          <DetailItem label="Designation" value={member.designation} />
          <DetailItem label="Role" value={roleLabel(member.role)} />
          <DetailItem
            label="Date of birth"
            value={birthday ? fmtDate(birthday) : null}
            hint={birthdayHint}
          />
          <DetailItem
            label="Joining date"
            value={joiningDate ? fmtDate(joiningDate) : null}
            hint={joiningHint}
          />
        </div>
        <p className="text-xs text-gray-500">
          These details are read-only. Contact HR or Admin to change your name, email, designation, date of
          birth or joining date.
        </p>
      </div>
    </div>
  )
}
