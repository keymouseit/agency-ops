'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { softRefresh } from '@/lib/soft-refresh'
import type { ProjectEditField } from '@/lib/projects'
import AssigneeMultiSelect from '../AssigneeMultiSelect'

type Member = { id: string; name: string; role: string }
type WonLead = { id: string; clientName: string }

type Project = {
  id: string
  name: string
  leadId: string | null
  developerId: string
  assigneeIds?: string[]
  bdMemberId: string | null
  clientName: string | null
  contractValue: number | null
  currency: string
  estimatedHours: number | null
  actualHours: number | null
  techStack: string | null
  startDate: string | null
  estimatedEnd: string | null
}

function toDateInput(value: string | null): string {
  if (!value) return ''
  return value.slice(0, 10)
}

export default function EditProjectForm({
  project,
  members,
  wonLeads,
  editableFields,
}: {
  project: Project
  members: Member[]
  wonLeads: WonLead[]
  editableFields: ProjectEditField[]
}) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  const can = (field: ProjectEditField) => editableFields.includes(field)

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const fd = new FormData(e.currentTarget)
      const data: Record<string, string | null> = {}

      if (can('name')) data.name = (fd.get('name') as string)?.trim()
      if (can('leadId')) data.leadId = (fd.get('leadId') as string) || null
      if (can('developerId')) {
        const developerIds = fd.getAll('developerIds').filter((id): id is string => typeof id === 'string')
        if (!developerIds.length) {
          setError('Select at least one assigned person.')
          setLoading(false)
          return
        }
        data.developerId = developerIds[0]
        ;(data as Record<string, unknown>).developerIds = developerIds
      }
      if (can('bdMemberId')) data.bdMemberId = (fd.get('bdMemberId') as string) || null
      if (can('clientName')) data.clientName = (fd.get('clientName') as string)?.trim() || null
      if (can('contractValue')) data.contractValue = (fd.get('contractValue') as string) || ''
      if (can('currency')) data.currency = fd.get('currency') as string
      if (can('estimatedHours')) data.estimatedHours = (fd.get('estimatedHours') as string) || ''
      if (can('actualHours')) data.actualHours = (fd.get('actualHours') as string) || ''
      if (can('techStack')) data.techStack = (fd.get('techStack') as string)?.trim() || null
      if (can('startDate')) data.startDate = (fd.get('startDate') as string) || null
      if (can('estimatedEnd')) data.estimatedEnd = (fd.get('estimatedEnd') as string) || null

      if (can('estimatedHours') && data.estimatedHours) {
        const hours = parseFloat(data.estimatedHours)
        if (Number.isNaN(hours) || hours <= 0) {
          setError('Estimated hours must be greater than 0 when provided')
          setLoading(false)
          return
        }
      }

      if (can('actualHours') && data.actualHours) {
        const hours = parseFloat(data.actualHours)
        if (Number.isNaN(hours) || hours < 0) {
          setError('Actual hours cannot be negative')
          setLoading(false)
          return
        }
      }

      const res = await fetch(`/api/projects/${project.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: 'Failed to update project' }))
        throw new Error(errData.error || 'Failed to update project')
      }

      setLoading(false)
      setOpen(false)
      softRefresh(router)
    } catch (err) {
      setLoading(false)
      setError(err instanceof Error ? err.message : 'Failed to update project. Please try again.')
    }
  }

  return (
    <>
      <button
        type="button"
        className="inline-flex items-center rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
        onClick={() => {
          setError('')
          setOpen(true)
        }}
      >
        Edit project
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-semibold mb-4">Edit project</h2>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-start gap-2 text-red-800">
                  <span className="text-lg">⚠</span>
                  <div className="flex-1">
                    <div className="text-sm font-semibold">Failed to update project</div>
                    <div className="text-xs text-red-700 mt-0.5">{error}</div>
                  </div>
                  <button type="button" onClick={() => setError('')} className="text-red-400 hover:text-red-600">
                    ✕
                  </button>
                </div>
              </div>
            )}

            <form onSubmit={submit} className="space-y-3">
              {can('name') && (
                <div>
                  <label className="label">Project name *</label>
                  <input name="name" required className="input" defaultValue={project.name} />
                </div>
              )}

              {can('leadId') && wonLeads.length > 0 && (
                <div>
                  <label className="label">Link to won lead (optional)</label>
                  <select name="leadId" className="input" defaultValue={project.leadId || ''}>
                    <option value="">— Not linked —</option>
                    {wonLeads.map(l => (
                      <option key={l.id} value={l.id}>
                        {l.clientName}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {(can('developerId') || can('bdMemberId')) && (
                <div className="grid grid-cols-2 gap-3">
                  {can('developerId') && (
                    <div className={can('bdMemberId') ? '' : 'col-span-2'}>
                      <label className="label">Assigned people *</label>
                      <AssigneeMultiSelect
                        members={members}
                        selectedIds={
                          project.assigneeIds?.length ? project.assigneeIds : [project.developerId]
                        }
                      />
                    </div>
                  )}
                  {can('bdMemberId') && (
                    <div>
                      <label className="label">BD (client manager)</label>
                      <select name="bdMemberId" className="input" defaultValue={project.bdMemberId || ''}>
                        <option value="">No BD assigned</option>
                        {members
                          .filter(m => ['BD', 'Both', 'Founder'].includes(m.role))
                          .map(m => (
                            <option key={m.id} value={m.id}>
                              {m.name}
                            </option>
                          ))}
                      </select>
                    </div>
                  )}
                </div>
              )}

              {can('clientName') && (
                <div>
                  <label className="label">Client name</label>
                  <input
                    name="clientName"
                    className="input"
                    placeholder="Client company"
                    defaultValue={project.clientName || ''}
                  />
                </div>
              )}

              {(can('contractValue') || can('currency')) && (
                <div className="grid grid-cols-2 gap-3">
                  {can('contractValue') && (
                    <div>
                      <label className="label">Contract value</label>
                      <input
                        name="contractValue"
                        type="number"
                        className="input"
                        placeholder="0"
                        defaultValue={project.contractValue ?? ''}
                      />
                    </div>
                  )}
                  {can('currency') && (
                    <div>
                      <label className="label">Currency</label>
                      <select name="currency" className="input" defaultValue={project.currency}>
                        {['USD', 'AED', 'INR', 'GBP', 'EUR', 'AUD'].map(c => (
                          <option key={c}>{c}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              )}

              {(can('estimatedHours') || can('techStack')) && (
                <div className="grid grid-cols-2 gap-3">
                  {can('estimatedHours') && (
                    <div>
                      <label className="label">Estimated hours</label>
                      <input
                        name="estimatedHours"
                        type="number"
                        min="0"
                        step="1"
                        className="input"
                        placeholder="Optional"
                        defaultValue={project.estimatedHours ?? ''}
                      />
                    </div>
                  )}
                  {can('techStack') && (
                    <div>
                      <label className="label">Tech stack</label>
                      <input
                        name="techStack"
                        className="input"
                        placeholder="React, Node.js, ..."
                        defaultValue={project.techStack || ''}
                      />
                    </div>
                  )}
                </div>
              )}

              {can('actualHours') && (
                <div>
                  <label className="label">Actual hours</label>
                  <input
                    name="actualHours"
                    type="number"
                    min="0"
                    step="1"
                    className="input"
                    placeholder="Optional"
                    defaultValue={project.actualHours ?? ''}
                  />
                </div>
              )}

              {(can('startDate') || can('estimatedEnd')) && (
                <div className="grid grid-cols-2 gap-3">
                  {can('startDate') && (
                    <div>
                      <label className="label">Start date</label>
                      <input
                        name="startDate"
                        type="date"
                        className="input"
                        defaultValue={toDateInput(project.startDate)}
                      />
                    </div>
                  )}
                  {can('estimatedEnd') && (
                    <div>
                      <label className="label">Estimated end date</label>
                      <input
                        name="estimatedEnd"
                        type="date"
                        className="input"
                        defaultValue={toDateInput(project.estimatedEnd)}
                      />
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button type="submit" disabled={loading} className="btn-primary flex-1">
                  {loading ? 'Saving...' : 'Save changes'}
                </button>
                <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
