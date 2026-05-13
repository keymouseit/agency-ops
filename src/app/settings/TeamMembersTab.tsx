'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Member = {
  id: string
  name: string
  email: string
  role: string
  active: boolean
  createdAt: Date
}

export default function TeamMembersTab({ members: initialMembers }: { members: Member[] }) {
  const router = useRouter()
  const [members, setMembers] = useState(initialMembers)
  const [searchQuery, setSearchQuery] = useState('')
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingMember, setEditingMember] = useState<Member | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    role: 'Dev',
    password: '',
    active: true,
  })

  const filteredMembers = members.filter(m =>
    m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.role.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const activeCount = members.filter(m => m.active).length
  const inactiveCount = members.filter(m => !m.active).length

  function openAddForm() {
    setFormData({ name: '', email: '', role: 'Dev', password: '', active: true })
    setEditingMember(null)
    setShowAddForm(true)
    setError('')
  }

  function openEditForm(member: Member) {
    setFormData({
      name: member.name,
      email: member.email,
      role: member.role,
      password: '', // Don't show password
      active: member.active,
    })
    setEditingMember(member)
    setShowAddForm(true)
    setError('')
  }

  function closeForm() {
    setShowAddForm(false)
    setEditingMember(null)
    setFormData({ name: '', email: '', role: 'Dev', password: '', active: true })
    setError('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const url = editingMember ? `/api/team/${editingMember.id}` : '/api/team'
      const method = editingMember ? 'PATCH' : 'POST'

      const body: any = {
        name: formData.name,
        email: formData.email,
        role: formData.role,
        active: formData.active,
      }

      // Only include password for new members or if changed
      if (!editingMember && formData.password) {
        body.password = formData.password
      } else if (editingMember && formData.password) {
        body.password = formData.password
      }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to save member')
      }

      closeForm()
      router.refresh()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

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
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Team Members</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Manage team member accounts, roles, and access
          </p>
        </div>
        <button onClick={openAddForm} className="btn-primary text-sm">
          + Add Member
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="card p-4">
          <div className="text-xs text-gray-400 uppercase tracking-wide mb-1">Total Members</div>
          <div className="text-2xl font-semibold text-gray-900">{members.length}</div>
        </div>
        <div className="card p-4">
          <div className="text-xs text-gray-400 uppercase tracking-wide mb-1">Active</div>
          <div className="text-2xl font-semibold text-green-600">{activeCount}</div>
        </div>
        <div className="card p-4">
          <div className="text-xs text-gray-400 uppercase tracking-wide mb-1">Inactive</div>
          <div className="text-2xl font-semibold text-gray-400">{inactiveCount}</div>
        </div>
      </div>

      {/* Search */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="Search by name, email, or role..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="input w-full max-w-md"
        />
      </div>

      {/* Members Table */}
      <div className="card overflow-hidden">
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
                  <div className="font-medium text-gray-900">{member.name}</div>
                </td>
                <td className="px-3 py-3 text-gray-600">{member.email}</td>
                <td className="px-3 py-3">
                  <span className={`badge text-xs ${
                    member.role === 'Founder' ? 'bg-purple-100 text-purple-800' :
                    member.role === 'Manager' ? 'bg-indigo-100 text-indigo-800' :
                    member.role === 'BD' ? 'bg-blue-100 text-blue-800' :
                    member.role === 'Dev' ? 'bg-green-100 text-green-800' :
                    member.role === 'QA' ? 'bg-teal-100 text-teal-800' :
                    'bg-amber-100 text-amber-800'
                  }`}>
                    {member.role}
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
                  <div className="flex items-center justify-center gap-2">
                    <button
                      onClick={() => openEditForm(member)}
                      className="text-xs text-blue-600 hover:text-blue-800 hover:underline"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => toggleActive(member)}
                      className={`text-xs hover:underline ${
                        member.active ? 'text-red-600 hover:text-red-800' : 'text-green-600 hover:text-green-800'
                      }`}
                      disabled={loading}
                    >
                      {member.active ? 'Deactivate' : 'Activate'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filteredMembers.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center py-12 text-gray-400 text-sm">
                  No members found matching "{searchQuery}"
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Add/Edit Form Modal */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">
              {editingMember ? 'Edit Team Member' : 'Add Team Member'}
            </h3>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="label">Name *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  className="input w-full"
                  placeholder="John Doe"
                />
              </div>

              <div>
                <label className="label">Email *</label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={e => setFormData({ ...formData, email: e.target.value })}
                  className="input w-full"
                  placeholder="john@example.com"
                />
              </div>

              <div>
                <label className="label">Role *</label>
                <select
                  value={formData.role}
                  onChange={e => setFormData({ ...formData, role: e.target.value })}
                  className="input w-full"
                >
                  <option value="BD">BD</option>
                  <option value="Dev">Dev</option>
                  <option value="QA">QA</option>
                  <option value="Both">Both</option>
                  <option value="Manager">Manager</option>
                  <option value="Founder">Founder</option>
                </select>
              </div>

              <div>
                <label className="label">
                  Password {!editingMember && '*'}
                  {editingMember && <span className="text-xs text-gray-500 font-normal ml-1">(leave blank to keep unchanged)</span>}
                </label>
                <input
                  type="password"
                  required={!editingMember}
                  value={formData.password}
                  onChange={e => setFormData({ ...formData, password: e.target.value })}
                  className="input w-full"
                  placeholder={editingMember ? 'Enter new password...' : 'Enter password...'}
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="active"
                  checked={formData.active}
                  onChange={e => setFormData({ ...formData, active: e.target.checked })}
                />
                <label htmlFor="active" className="text-sm text-gray-700 cursor-pointer">
                  Active (member can log in)
                </label>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary flex-1"
                >
                  {loading ? 'Saving...' : editingMember ? 'Update Member' : 'Add Member'}
                </button>
                <button
                  type="button"
                  onClick={closeForm}
                  className="btn-secondary flex-1"
                  disabled={loading}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Team Activity Log */}
      <div className="mt-8">
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Team Activity Log</h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Track all team member changes including additions, updates, and status changes
              </p>
            </div>
            <a
              href="/settings/audit-log?entityType=TeamMember"
              className="text-xs text-blue-600 hover:text-blue-800 hover:underline"
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
    </div>
  )
}
