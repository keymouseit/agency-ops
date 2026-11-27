'use client'

import { useEffect, useId, useState } from 'react'
import { useRouter } from 'next/navigation'
import { fmtDate } from '@/lib/utils'
import {
  BUG_SEVERITIES,
  BUG_SEVERITY_CONFIG,
  BUG_STATUSES,
  BUG_STATUS_CONFIG,
  SerializedBug,
} from '@/lib/milestone-qa'

function bugAttachmentLinks(bug: SerializedBug) {
  if (bug.attachmentUrls && bug.attachmentUrls.length > 0) return bug.attachmentUrls
  return bug.attachmentUrl ? [bug.attachmentUrl] : []
}

/** Log / manage bugs nested under a single test case. */
export default function MilestoneBugEditor({
  milestoneId,
  testCaseId,
  testCaseDisplayId,
  milestoneStatus,
  bugs: initialBugs,
}: {
  milestoneId: string
  testCaseId: string
  testCaseDisplayId?: string | null
  milestoneStatus: string
  bugs: SerializedBug[]
}) {
  const router = useRouter()
  const titleId = useId()
  const [bugs, setBugs] = useState(initialBugs)
  const [loading, setLoading] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [stepsToReproduce, setStepsToReproduce] = useState('')
  const [severity, setSeverity] = useState('medium')
  const [attachmentLinks, setAttachmentLinks] = useState<string[]>([''])
  const [adding, setAdding] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)

  const canChangeStatus = ['testing', 'done', 'ready_for_qa', 'in_progress'].includes(milestoneStatus)
  const canLogBugs = milestoneStatus === 'testing' || milestoneStatus === 'in_progress'

  useEffect(() => {
    if (!modalOpen) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !adding) closeModal()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [modalOpen, adding])

  function resetForm() {
    setTitle('')
    setDescription('')
    setStepsToReproduce('')
    setSeverity('medium')
    setAttachmentLinks([''])
  }

  function updateAttachmentLink(index: number, value: string) {
    setAttachmentLinks(prev => prev.map((link, i) => (i === index ? value : link)))
  }

  function addAttachmentLink() {
    setAttachmentLinks(prev => [...prev, ''])
  }

  function removeAttachmentLink(index: number) {
    setAttachmentLinks(prev => {
      const next = prev.filter((_, i) => i !== index)
      return next.length > 0 ? next : ['']
    })
  }

  function closeModal() {
    if (adding) return
    setModalOpen(false)
    resetForm()
  }

  if (!canChangeStatus && bugs.length === 0) return null

  async function logBug(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    setAdding(true)
    try {
      const res = await fetch(`/api/projects/milestones/${milestoneId}/bugs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          description,
          stepsToReproduce,
          severity,
          testCaseId,
          attachmentUrls: attachmentLinks.filter(l => Boolean(l.trim())),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || `Failed to log bug (${res.status})`)
      setBugs(prev => [data, ...prev])
      setModalOpen(false)
      resetForm()
      router.refresh()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to log bug')
    } finally {
      setAdding(false)
    }
  }

  async function updateBug(bugId: string, updates: Record<string, string>) {
    setLoading(bugId)
    try {
      const res = await fetch(`/api/projects/milestones/${milestoneId}/bugs/${bugId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || `Failed to update bug (${res.status})`)
      setBugs(prev => prev.map(b => (b.id === bugId ? data : b)))
      router.refresh()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update bug')
    } finally {
      setLoading(null)
    }
  }

  async function deleteBug(bugId: string) {
    if (!confirm('Delete this bug?')) return
    setLoading(bugId)
    try {
      const res = await fetch(`/api/projects/milestones/${milestoneId}/bugs/${bugId}`, {
        method: 'DELETE',
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || `Failed to delete bug (${res.status})`)
      setBugs(prev => prev.filter(b => b.id !== bugId))
      router.refresh()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete bug')
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="mt-3 pt-3 border-t border-gray-100">
      <div className="flex items-center justify-between gap-2 mb-2">
        <h5 className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
          Bugs{bugs.length > 0 ? ` (${bugs.length})` : ''}
          {testCaseDisplayId ? (
            <span className="ml-1 font-normal text-gray-400 normal-case">under {testCaseDisplayId}</span>
          ) : null}
        </h5>
        {canLogBugs && (
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="inline-flex items-center gap-1 rounded-md border border-teal-200 bg-teal-50 px-2 py-1 text-xs font-medium text-teal-800 hover:bg-teal-100"
          >
            <span aria-hidden>+</span> Log bug
          </button>
        )}
      </div>

      {bugs.length === 0 && canLogBugs && (
        <p className="text-xs text-gray-400 mb-1">No bugs yet — open the form to log one against this case.</p>
      )}

      {bugs.length > 0 && (
        <div className="space-y-2 border-l-2 border-red-200 pl-2.5">
          {bugs.map(bug => {
            const statusCfg = BUG_STATUS_CONFIG[bug.status] ?? BUG_STATUS_CONFIG.open
            const severityCfg = BUG_SEVERITY_CONFIG[bug.severity] ?? BUG_SEVERITY_CONFIG.medium

            return (
              <div
                key={bug.id}
                className="rounded-lg border border-red-200 bg-red-50/70 p-2.5 shadow-sm"
              >
                <div className="flex items-start gap-2">
                  {canLogBugs && (
                    <button
                      type="button"
                      onClick={() => deleteBug(bug.id)}
                      disabled={loading === bug.id}
                      aria-label="Delete bug"
                      title="Delete bug"
                      className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-red-300 bg-white text-red-600 hover:bg-red-100 disabled:opacity-50"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
                    </button>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      {bug.displayId && (
                        <span className="font-mono text-[10px] font-semibold text-red-800 bg-red-100 border border-red-200 px-1.5 py-0.5 rounded-md">
                          {bug.displayId}
                        </span>
                      )}
                      {canChangeStatus ? (
                        <div className="relative inline-flex items-center">
                          <select
                            value={bug.severity}
                            onChange={e => updateBug(bug.id, { severity: e.target.value })}
                            disabled={loading === bug.id}
                            style={{ paddingRight: '1.5rem' }}
                            className={`inline-flex items-center text-xs font-semibold rounded-full border border-black/10 py-0.5 pl-2.5 cursor-pointer appearance-none focus:outline-none focus:ring-1 focus:ring-gray-400 ${severityCfg.cls}`}
                            aria-label={`Priority for ${bug.title}`}
                            title="Click to change priority"
                          >
                            {BUG_SEVERITIES.map(s => (
                              <option key={s} value={s} className="bg-white text-gray-900 font-normal">
                                {BUG_SEVERITY_CONFIG[s].label}
                              </option>
                            ))}
                          </select>
                          <svg
                            className="pointer-events-none absolute right-1.5 h-3 w-3 opacity-60"
                            viewBox="0 0 20 20"
                            fill="currentColor"
                            aria-hidden="true"
                          >
                            <path
                              fillRule="evenodd"
                              d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                              clipRule="evenodd"
                            />
                          </svg>
                        </div>
                      ) : (
                        <span className={`badge text-xs ${severityCfg.cls}`}>{severityCfg.label}</span>
                      )}
                      <span className="text-sm font-semibold text-gray-900">{bug.title}</span>
                    </div>
                    {bug.stepsToReproduce && (
                      <p className="text-xs text-gray-600 mt-1 whitespace-pre-wrap">
                        <span className="font-medium text-gray-700">Steps: </span>
                        {bug.stepsToReproduce}
                      </p>
                    )}
                    {bug.description && (
                      <p className="text-xs text-gray-600 mt-1 whitespace-pre-wrap">{bug.description}</p>
                    )}
                    {(() => {
                      const links = bugAttachmentLinks(bug)
                      if (links.length === 0) return null
                      return (
                        <div className="mt-1 space-y-0.5">
                          {links.map((url, i) => (
                            <a
                              key={`${bug.id}-link-${i}`}
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 text-xs text-teal-700 hover:underline break-all"
                            >
                              <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                              </svg>
                              {links.length > 1 ? `Link ${i + 1}` : 'Attachment link'}
                            </a>
                          ))}
                        </div>
                      )
                    })()}
                    <p className="text-xs text-gray-400 mt-1">
                      {bug.reportedBy.name} · {fmtDate(bug.reportedAt)}
                    </p>
                  </div>
                  {canChangeStatus ? (
                    loading === bug.id ? (
                      <div className="inline-flex items-center gap-1.5 text-xs text-gray-500 px-1.5 py-1" role="status">
                        <span className="inline-block h-3 w-3 rounded-full border-2 border-gray-300 border-t-gray-600 animate-spin" />
                        Saving…
                      </div>
                    ) : (
                      <select
                        value={bug.status}
                        onChange={e => updateBug(bug.id, { status: e.target.value })}
                        className="text-xs rounded-md border border-gray-200 bg-white text-gray-800 px-2 py-1.5 shadow-sm"
                        aria-label={`Status for ${bug.title}`}
                      >
                        {BUG_STATUSES.map(s => (
                          <option key={s} value={s}>{BUG_STATUS_CONFIG[s].label}</option>
                        ))}
                      </select>
                    )
                  ) : (
                    <span className={`badge text-xs ${statusCfg.cls}`}>{statusCfg.label}</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40"
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          onClick={e => {
            if (e.target === e.currentTarget && !adding) closeModal()
          }}
        >
          <div className="w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl bg-white shadow-2xl max-h-[92vh] flex flex-col overflow-hidden">
            <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-5 py-4 shrink-0">
              <div>
                <h3 id={titleId} className="text-lg font-semibold text-gray-900">Log bug</h3>
                <p className="text-sm text-gray-500 mt-1">
                  {testCaseDisplayId ? (
                    <>
                      Linked to{' '}
                      <span className="font-mono font-semibold text-teal-800">{testCaseDisplayId}</span>
                    </>
                  ) : (
                    'Linked to this test case'
                  )}
                </p>
              </div>
              <button
                type="button"
                onClick={closeModal}
                disabled={adding}
                className="text-gray-400 hover:text-gray-700 text-xl leading-none disabled:opacity-50"
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <form onSubmit={logBug} className="flex flex-col min-h-0 flex-1">
              <div className="p-5 space-y-4 overflow-y-auto min-h-0">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Bug title <span className="text-red-500">*</span>
                  </label>
                  <input
                    className="input text-base w-full"
                    placeholder="e.g. Login button unresponsive on mobile"
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    autoFocus
                    required
                    disabled={adding}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Steps to reproduce
                  </label>
                  <textarea
                    className="input text-base w-full !min-h-0 h-20 resize-y"
                    rows={2}
                    placeholder="1. Open page…&#10;2. Tap Login…&#10;3. Observe…"
                    value={stepsToReproduce}
                    onChange={e => setStepsToReproduce(e.target.value)}
                    disabled={adding}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Description
                  </label>
                  <textarea
                    className="input text-base w-full !min-h-0 h-20 resize-y"
                    rows={2}
                    placeholder="Expected vs actual behavior"
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    disabled={adding}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Priority</label>
                  <select
                    className="input text-base w-full"
                    value={severity}
                    onChange={e => setSeverity(e.target.value)}
                    disabled={adding}
                  >
                    {BUG_SEVERITIES.map(s => (
                      <option key={s} value={s}>{BUG_SEVERITY_CONFIG[s].label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <label className="block text-sm font-medium text-gray-700">
                      Attachment links
                    </label>
                    <button
                      type="button"
                      onClick={addAttachmentLink}
                      disabled={adding}
                      className="text-sm font-medium text-teal-700 hover:text-teal-900"
                    >
                      + Add link
                    </button>
                  </div>
                  <div className="space-y-2">
                    {attachmentLinks.map((link, index) => (
                      <div key={`attachment-${index}`} className="flex gap-2">
                        <input
                          type="url"
                          className="input text-base w-full"
                          placeholder="https://loom.com/... or Drive / Figma link"
                          value={link}
                          onChange={e => updateAttachmentLink(index, e.target.value)}
                          disabled={adding}
                        />
                        {attachmentLinks.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeAttachmentLink(index)}
                            disabled={adding}
                            className="btn-secondary text-sm shrink-0 px-2.5"
                            aria-label={`Remove link ${index + 1}`}
                          >
                            ×
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  <p className="text-sm text-gray-500 mt-1.5">
                    Paste links only — nothing is uploaded.
                  </p>
                </div>
              </div>

              <div className="flex gap-2 justify-end border-t border-gray-100 px-5 py-4 shrink-0 bg-gray-50/80">
                <button
                  type="button"
                  className="btn-secondary text-sm"
                  onClick={closeModal}
                  disabled={adding}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={adding || !title.trim()}
                  className="btn-primary text-sm"
                >
                  {adding ? 'Logging…' : 'Log bug'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
