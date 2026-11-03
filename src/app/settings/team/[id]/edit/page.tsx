import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  assignableRoleOptions,
  canEditMember,
  canEditTeam,
  toDateInputValue,
} from '@/lib/team-permissions'
import MemberForm from '../../MemberForm'

export const dynamic = 'force-dynamic'

export default async function EditTeamMemberPage({ params }: { params: { id: string } }) {
  const session = await auth()
  const userRole = session?.user?.role
  // Same rules as PATCH /api/team/[id]
  if (!canEditTeam(userRole)) redirect('/')

  const member = await prisma.teamMember.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      active: true,
      attendanceExcluded: true,
      designation: true,
      birthday: true,
      joiningDate: true,
    },
  })
  if (!member) notFound()

  const detailHref = `/settings/team/${member.id}`
  // HR cannot edit Founder/Manager members → back to the read-only profile
  if (!canEditMember(userRole, member.role)) redirect(detailHref)

  const roleOptions = assignableRoleOptions(userRole)

  return (
    <div className="w-full space-y-4">
      <div>
        <Link href={detailHref} prefetch={false} className="text-xs text-gray-400 hover:text-gray-700">
          ← {member.name}
        </Link>
      </div>
      <div>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Edit profile</h1>
        <p className="text-sm text-gray-500 mt-0.5">{member.name} · {member.email}</p>
      </div>
      <MemberForm
        mode="edit"
        memberId={member.id}
        backHref={detailHref}
        roleOptions={roleOptions}
        initialValues={{
          name: member.name,
          email: member.email,
          designation: member.designation ?? '',
          role: member.role,
          active: member.active,
          attendanceExcluded: member.attendanceExcluded,
          birthday: toDateInputValue(member.birthday),
          joiningDate: toDateInputValue(member.joiningDate),
        }}
      />
    </div>
  )
}
