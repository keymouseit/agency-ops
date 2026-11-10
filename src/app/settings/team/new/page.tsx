import Link from 'next/link'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { assignableRoleOptions, canEditTeam } from '@/lib/team-permissions'
import MemberForm from '../MemberForm'

export const dynamic = 'force-dynamic'

export default async function NewTeamMemberPage() {
  const session = await auth()
  const userRole = session?.user?.role
  // Same rule as POST /api/team: Founder / Manager / HR
  if (!canEditTeam(userRole)) redirect('/')

  const roleOptions = assignableRoleOptions(userRole)
  const defaultRole = roleOptions.some(o => o.value === 'Dev') ? 'Dev' : roleOptions[0]?.value ?? ''

  return (
    <div className="w-full space-y-4">
      <div>
        <Link href="/settings" prefetch={false} className="text-xs text-gray-400 hover:text-gray-700">
          ← Team Members
        </Link>
      </div>
      <div>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Add employee</h1>
        <p className="text-sm text-gray-500 mt-0.5">Create a team member profile and login</p>
      </div>
      <MemberForm
        mode="create"
        backHref="/settings"
        roleOptions={roleOptions}
        initialValues={{
          name: '',
          email: '',
          designation: '',
          role: defaultRole,
          active: true,
          attendanceExcluded: false,
          birthday: '',
          joiningDate: '',
        }}
      />
    </div>
  )
}
