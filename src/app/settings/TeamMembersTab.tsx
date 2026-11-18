'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { canEditMember } from '@/lib/team-permissions'

type Member = {
  id: string
  name: string
  email: string
  role: string
  active: boolean
  createdAt: Date
  birthday?: Date | string | null
  designation?: string | null
  joiningDate?: Date | string | null
}

function roleBadgeClass(role: string) {
  if (role === 'Founder') return 'bg-purple-100 text-purple-800'
  if (role === 'Manager') return 'bg-indigo-100 text-indigo-800'
  if (role === 'BD') return 'bg-blue-100 text-blue-800'
  if (role === 'Dev') return 'bg-green-100 text-green-800'
  if (role === 'QA') return 'bg-teal-100 text-teal-800'
  if (role === 'HR') return 'bg-rose-100 text-rose-800'
  if (role === 'SocialMedia') return 'bg-pink-100 text-pink-800'
  return 'bg-amber-100 text-amber-800'
}

function roleLabel(role: string) {
  return role === 'SocialMedia' ? 'Social' : role
}

export default function TeamMembersTab({
  members: initialMembers,
  canManage = true,
  viewerRole,
}: {
  members: Member[]
  canManage?: boolean
  /** Logged-in user's role — HR cannot assign Founder/Manager or edit those members. */
  viewerRole?: string
}) {
  // When viewerRole is unknown, keep legacy behaviour (API still enforces).
  const canEditRow = (m: Member) => canManage && (!viewerRole || canEditMember(viewerRole, m.role))
  const canViewAuditLog = !viewerRole || viewerRole === 'Founder'
  const router = useRouter()
  // Read members straight from props so router.refresh() shows fresh data
  const members = initialMembers
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(false)

  const filteredMembers = members.filter(m =>
    m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.role.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (m.designation ?? '').toLowerCase().includes(searchQuery.toLowerCase())
  )

  const activeCount = members.filter(m => m.active).length
  const inactiveCount = members.filter(m => !m.active).length

  async function toggleActive(member: Member) {
    if (!confirm(`Are you sure you want to ${member.active ? 'deactivate' : 'activate'} ${member.name}?`)) {
      return
    }

    setLoading(true)
    try {
      const res = await fetch(`/api/team/${member.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !member.active }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to update member')
      }

      router.refresh()
    } catch (err: any) {
      alert(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-w-0 w-full max-w-full">
      {/* Header */}
      <div className="flex flex-col gap-3 mb-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-gray-900">Team Members</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Manage team member accounts, roles, and access
          </p>
        </div>
        {canManage && (
          <Link
            href="/settings/team/new"
            prefetch={false}
            className="btn-primary inline-flex items-center justify-center self-start shrink-0 whitespace-nowrap text-sm !px-3 !py-2"
          >
            + Add Member
          </Link>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-6">
        <div className="card p-3 sm:p-4 min-w-0">
          <div className="text-[10px] sm:text-xs text-gray-400 uppercase tracking-wide mb-1">Total</div>
          <div className="text-xl sm:text-2xl font-semibold text-gray-900">{members.length}</div>
        </div>
        <div className="card p-3 sm:p-4 min-w-0">
          <div className="text-[10px] sm:text-xs text-gray-400 uppercase tracking-wide mb-1">Active</div>
          <div className="text-xl sm:text-2xl font-semibold text-green-600">{activeCount}</div>
        </div>
        <div className="card p-3 sm:p-4 min-w-0">
          <div className="text-[10px] sm:text-xs text-gray-400 uppercase tracking-wide mb-1">Inactive</div>
          <div className="text-xl sm:text-2xl font-semibold text-gray-400">{inactiveCount}</div>
        </div>
      </div>

      {/* Search */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="Search by name, email, role..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="input w-full max-w-full sm:max-w-md"
        />
      </div>

      {/* Mobile / PWA cards */}
      <div className="card overflow-hidden md:hidden">
        {filteredMembers.length === 0 ? (
          <p className="text-center py-12 text-gray-400 text-sm px-4">
            No members found matching &quot;{searchQuery}&quot;
          </p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {filteredMembers.map(member => (
              <li
                key={member.id}
                className={`px-4 py-3.5 space-y-2 ${!member.active ? 'opacity-55' : ''}`}
              >
                <div className="min-w-0">
                  <Link
                    href={`/settings/team/${member.id}`}
                    className="font-semibold text-gray-900 hover:text-blue-600 break-words"
                  >
                    {member.name}
                  </Link>
                  {member.designation ? (
                    <p className="text-xs text-gray-500 mt-0.5 break-words">{member.designation}</p>
                  ) : null}
                  <p className="text-xs text-gray-500 mt-0.5 break-all">{member.email}</p>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className={`badge text-[10px] ${roleBadgeClass(member.role)}`}>
                    {roleLabel(member.role)}
                  </span>
                  <span
                    className={`badge text-[10px] ${
                      member.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {member.active ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-3 pt-0.5">
                  <Link
                    href={`/settings/team/${member.id}`}
                    className="text-xs font-medium text-gray-600 hover:text-gray-900"
                  >
                    View
                  </Link>
                  {canEditRow(member) && (
                    <>
                      <Link
                        href={`/settings/team/${member.id}/edit`}
                        prefetch={false}
                        className="text-xs font-medium text-blue-600 hover:text-blue-800"
                      >
                        Edit
                      </Link>
                      <button
                        type="button"
                        onClick={() => toggleActive(member)}
                        className={`text-xs font-medium ${
                          member.active
                            ? 'text-red-600 hover:text-red-800'
                            : 'text-green-600 hover:text-green-800'
                        }`}
                        disabled={loading}
                      >
                        {member.active ? 'Deactivate' : 'Activate'}
                      </button>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Desktop table */}
      <div className="card overflow-hidden hidden md:block">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr className="text-xs text-gray-400 uppercase tracking-wide">
                <th className="text-left px-4 py-3 font-medium">Name</th>
                <th className="text-left px-3 py-3 font-medium">Email</th>
                <th className="text-left px-3 py-3 font-medium">Role</th>
                <th className="text-center px-3 py-3 font-medium">Status</th>
                <th className="text-center px-3 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredMembers.map(member => (
                <tr key={member.id} className={`hover:bg-gray-50 ${!member.active ? 'opacity-50' : ''}`}>
                  <td className="px-4 py-3">
                    <Link
                      href={`/settings/team/${member.id}`}
                      className="font-medium text-gray-900 hover:text-blue-600 hover:underline"
                    >
                      {member.name}
                    </Link>
                    {member.designation && (
                      <div className="text-xs text-gray-500 mt-0.5">{member.designation}</div>
                    )}
                  </td>
                  <td className="px-3 py-3 text-gray-600">{member.email}</td>
                  <td className="px-3 py-3">
                    <span className={`badge text-xs ${roleBadgeClass(member.role)}`}>
                      {member.role === 'SocialMedia' ? 'Social Media' : member.role}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-center">
                    <span className={`badge text-xs ${
                      member.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {member.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-center">
                    <div className="flex items-center justify-center gap-2 flex-wrap">
                      <Link
                        href={`/settings/team/${member.id}`}
                        className="text-xs text-gray-600 hover:text-gray-900 hover:underline"
                      >
                        View
                      </Link>
                      {canEditRow(member) && (
                        <>
                          <Link
                            href={`/settings/team/${member.id}/edit`}
                            prefetch={false}
                            className="text-xs text-blue-600 hover:text-blue-800 hover:underline"
                          >
                            Edit
                          </Link>
                          <button
                            type="button"
                            onClick={() => toggleActive(member)}
                            className={`text-xs hover:underline ${
                              member.active
                                ? 'text-red-600 hover:text-red-800'
                                : 'text-green-600 hover:text-green-800'
                            }`}
                            disabled={loading}
                          >
                            {member.active ? 'Deactivate' : 'Activate'}
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filteredMembers.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center py-12 text-gray-400 text-sm">
                    No members found matching &quot;{searchQuery}&quot;
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Team Activity Log (audit log is Founder-only) */}
      {canViewAuditLog && (
      <div className="mt-8">
        <div className="card p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-gray-900">Team Activity Log</h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Track all team member changes including additions, updates, and status changes
              </p>
            </div>
            <a
              href="/settings/audit-log?entityType=TeamMember"
              className="text-xs text-blue-600 hover:text-blue-800 hover:underline shrink-0"
            >
              View full audit log →
            </a>
          </div>
          <p className="text-sm text-gray-500">
            All team management activities are tracked in the audit log for compliance and transparency.
            You can view detailed change history, including who made changes and when.
          </p>
        </div>
      </div>
      )}
    </div>
  )
}
