'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { TEST_CYCLE_CASE_STATUSES, TEST_CYCLE_CASE_STATUS_CONFIG, deriveCycleResult, hasFailingTestCases, CYCLE_RESULT_OPTIONS, CYCLE_NON_EXECUTABLE_RESULT_OPTIONS, isNonExecutableCycleResult, cycleSupportsBlockerNote, type SelectableCycleResult } from '@/lib/qa'
import { createClientId } from '@/lib/utils'

type Member = { id: string; name: string; role: string }
type Project = { id: string; name: string; status: string }
type Milestone = { id: string; title: string; status: string; dueDate: Date }
type CycleTestCaseRow = { id: string; title: string; status: string; notes: string }

export type EditableTestCycle = {
  id: string
  cycleType: string
  environment: string
  result: string
  conductedById: string
  summary: string | null
  blockerNote: string | null
  fixedInCycle: string | null
  testedAuth: boolean
  testedCoreFlows: boolean
  testedEdgeCases: boolean
  testedMobile: boolean
  testedCrossBrowser: boolean
  testedPerformance: boolean
  testedIntegrations: boolean
  testedDataIntegrity: boolean
  cases: Array<{ title: string; status: string; notes: string | null }>
}

function newCycleTestCaseRow(): CycleTestCaseRow {
  return { id: createClientId(), title: '', status: 'pass', notes: '' }
}

const CYCLE_TYPES = [
  { value: 'sanity',       label: 'Sanity check', desc: 'Quick smoke test — does the core still work after changes?' },
  { value: 'regression',   label: 'Regression test', desc: 'Full test of existing features — did anything break?' },
  { value: 'pre_release',  label: 'Pre-release test', desc: 'Full test cycle before a planned release to client' },
  { value: 'uat_prep',     label: 'UAT preparation', desc: 'Testing before handing to client for their own testing' },
]

const CHECKLIST_ITEMS = [
  { key: 'testedAuth',          label: 'Authentication & permissions' },
  { key: 'testedCoreFlows',     label: 'Core user flows (happy paths)' },
  { key: 'testedEdgeCases',     label: 'Edge cases & error states' },
  { key: 'testedMobile',        label: 'Mobile / responsive' },
  { key: 'testedCrossBrowser',  label: 'Cross-browser' },
  { key: 'testedPerformance',   label: 'Performance' },
  { key: 'testedIntegrations',  label: '3rd party integrations' },
  { key: 'testedDataIntegrity', label: 'Data integrity & persistence' },
]

const SIGNOFF_ITEMS = [
  { key: 'sanityPassed',       label: 'Sanity test passed' },
  { key: 'regressionPassed',   label: 'Regression test passed' },
  { key: 'noBlockersOpen',     label: 'No open blockers' },
  { key: 'stagingMatchesLive', label: 'Staging environment matches live' },
  { key: 'clientUATDone',      label: 'Client UAT completed (or waived)' },
  { key: 'knownIssuesAgreed',  label: 'Known conditional issues agreed with client' },
]

export default function QAProjectActions({
  project, members, canSignOff, latestCycleId, issueMode = false, hasSignOff = false, milestones = [],
  editingCycle = null,
  onCancelEdit,
}: {
  project: Project
  members: Member[]
  canSignOff: boolean
  latestCycleId?: string
  issueMode?: boolean
  hasSignOff?: boolean
  milestones?: Milestone[]
  editingCycle?: EditableTestCycle | null
  onCancelEdit?: () => void
}) {
  const router = useRouter()
  const { data: session } = useSession()
  const [view, setView] = useState<'cycle' | 'signoff' | 'issue' | null>(null)
  const [loading, setLoading] = useState(false)
  const [cycleValidationError, setCycleValidationError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  // Test cycle form state
  const [cycleType, setCycleType] = useState('pre_release')
  const [environment, setEnvironment] = useState('staging')
  const [conductedById, setConductedById] = useState('')
  const [result, setResult] = useState<SelectableCycleResult>('pass')
  const [checklist, setChecklist] = useState<Record<string, boolean>>({})
  const [cycleTestCases, setCycleTestCases] = useState<CycleTestCaseRow[]>([newCycleTestCaseRow()])
  const [summary, setSummary] = useState('')
  const [blockerNote, setBlockerNote] = useState('')
  const [fixedInCycle, setFixedInCycle] = useState('')

  // Sign-off form state
  const [signoffChecklist, setSignoffChecklist] = useState<Record<string, boolean>>({})
  const [signedOffById, setSignedOffById] = useState('')
  const [qualityScore, setQualityScore] = useState<number | null>(null)
  const [releaseNotes, setReleaseNotes] = useState('')
  const [exceptionsNotes, setExceptionsNotes] = useState('')

  // Post-delivery issue form state
  const [issueDesc, setIssueDesc] = useState('')
  const [issueSeverity, setIssueSeverity] = useState('medium')
  const [issueReportedBy, setIssueReportedBy] = useState('')
  const [issueInScope, setIssueInScope] = useState<boolean | null>(null)
  const [issueRootCause, setIssueRootCause] = useState('')

  // Milestone acknowledgment
  const [milestoneAck, setMilestoneAck] = useState(false)

  const qaMembers = members.filter(m => ['QA', 'Both', 'Founder'].includes(m.role))

  // Auto-assign logged-in user as conductedBy for test cycle
  useEffect(() => {
    if (session?.user?.id && !conductedById) {
      const currentUser = members.find(m => m.id === session.user.id)
      if (currentUser && ['QA', 'Both', 'Founder'].includes(currentUser.role)) {
        setConductedById(session.user.id)
      }
    }
  }, [session, members, conductedById])

  // Auto-assign logged-in user as signedOffBy for sign-off
  useEffect(() => {
    if (session?.user?.id && !signedOffById) {
      const currentUser = members.find(m => m.id === session.user.id)
      if (currentUser && ['QA', 'Both', 'Founder'].includes(currentUser.role)) {
        setSignedOffById(session.user.id)
      }
    }
  }, [session, members, signedOffById])

  useEffect(() => {
    if (!cycleSupportsBlockerNote(result)) {
      setBlockerNote('')
    }
  }, [result])

  useEffect(() => {
    if (!editingCycle) return
    setView('cycle')
    setCycleType(editingCycle.cycleType)
    setEnvironment(editingCycle.environment)
    setConductedById(editingCycle.conductedById)
    const validResults: SelectableCycleResult[] = [
      'pass', 'fail', 'conditional', 'not_applicable', 'out_of_scope', 'deferred', 'environment_issue',
    ]
    setResult(validResults.includes(editingCycle.result as SelectableCycleResult) ? editingCycle.result as SelectableCycleResult : 'pass')
    setChecklist({
      testedAuth: editingCycle.testedAuth,
      testedCoreFlows: editingCycle.testedCoreFlows,
      testedEdgeCases: editingCycle.testedEdgeCases,
      testedMobile: editingCycle.testedMobile,
      testedCrossBrowser: editingCycle.testedCrossBrowser,
      testedPerformance: editingCycle.testedPerformance,
      testedIntegrations: editingCycle.testedIntegrations,
      testedDataIntegrity: editingCycle.testedDataIntegrity,
    })
    setCycleTestCases(
      editingCycle.cases.length > 0
        ? editingCycle.cases.map(tc => ({
            id: createClientId(),
            title: tc.title,
            status: tc.status,
            notes: tc.notes ?? '',
          }))
        : [newCycleTestCaseRow()]
    )
    setSummary(editingCycle.summary ?? '')
    setBlockerNote(editingCycle.blockerNote ?? '')
    setFixedInCycle(editingCycle.fixedInCycle ?? '')
    setCycleValidationError('')
    setFieldErrors({})
  }, [editingCycle])

  function openNewCycleForm() {
    setCycleType('pre_release')
    setEnvironment('staging')
    setResult('pass')
    setChecklist({})
    setCycleTestCases([newCycleTestCaseRow()])
    setSummary('')
    setBlockerNote('')
    setFixedInCycle('')
    setCycleValidationError('')
    setFieldErrors({})
    setView('cycle')
  }

  function resetCycleForm() {
    setView(null)
    setCycleTestCases([newCycleTestCaseRow()])
    setSummary('')
    setBlockerNote('')
    setFixedInCycle('')
    setCycleValidationError('')
    setFieldErrors({})
    onCancelEdit?.()
  }

  async function submitCycle(e: React.FormEvent) {
    e.preventDefault()

    // Validate required fields
    const errors: string[] = []
    const newFieldErrors: Record<string, string> = {}

    if (!conductedById) {
      errors.push('Tested by is required')
      newFieldErrors.conductedById = 'Please select who conducted this test'
    }
    const namedCases = cycleTestCases.filter(tc => tc.title.trim())
    if (namedCases.length === 0) {
      errors.push('At least one test case name is required')
      newFieldErrors.testCases = 'Add at least one test case with a name'
    }
    if ((result === 'fail' || result === 'conditional') && !blockerNote.trim()) {
      const msg = result === 'fail' ? 'Blocker description is required' : 'Conditional issue description is required'
      errors.push(msg)
      newFieldErrors.blockerNote = msg
    }
    if (isNonExecutableCycleResult(result) && !summary.trim() && !blockerNote.trim()) {
      const msg = 'Please add notes explaining why this cycle could not be fully executed'
      errors.push(msg)
      newFieldErrors.summary = msg
    }
    if (hasFailingTestCases(namedCases) && result === 'pass') {
      errors.push('Overall result cannot be Pass when test cases have failed or are blocked')
      newFieldErrors.result = 'Change overall result to Fail, or update failing test cases'
    }

    if (errors.length > 0) {
      setCycleValidationError(errors.join('. '))
      setFieldErrors(newFieldErrors)
      return
    }

    setCycleValidationError('')
    setFieldErrors({})
    setLoading(true)
    const effectiveResult = deriveCycleResult(result, namedCases)
    const payload = {
      cycleType, environment, conductedById, result: effectiveResult,
      ...checklist, summary, fixedInCycle,
      blockerNote: cycleSupportsBlockerNote(effectiveResult) ? blockerNote : '',
      testCases: namedCases.map(({ title, status, notes }) => ({ title, status, notes })),
    }
    const url = editingCycle
      ? `/api/qa/${project.id}/cycle/${editingCycle.id}`
      : `/api/qa/${project.id}/cycle`
    const res = await fetch(url, {
      method: editingCycle ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      const err = await res.json()
      alert(err.error ?? 'Failed to save test cycle')
      setLoading(false)
      return
    }
    setLoading(false)
    resetCycleForm()
    router.refresh()
  }

  async function submitSignOff(e: React.FormEvent) {
    e.preventDefault()
    if (!latestCycleId) return
    setLoading(true)
    const res = await fetch(`/api/qa/${project.id}/signoff`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cycleId: latestCycleId, signedOffById, qualityScore,
        releaseNotes, exceptionsNotes, ...signoffChecklist,
      }),
    })
    if (!res.ok) {
      const err = await res.json()
      alert(err.error ?? 'Sign-off failed')
      setLoading(false)
      return
    }
    setLoading(false)
    setView(null)
    router.refresh()
  }

  async function submitIssue(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    await fetch(`/api/qa/${project.id}/issue`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        description: issueDesc, severity: issueSeverity,
        reportedBy: issueReportedBy, wasInScope: issueInScope,
        rootCause: issueRootCause,
      }),
    })
    setLoading(false)
    setView(null)
    router.refresh()
  }

  const allSigned = SIGNOFF_ITEMS.every(i => signoffChecklist[i.key])

  // Milestone validation
  const totalMilestones = milestones.length
  const approvedMilestones = milestones.filter(m => m.status === 'done').length
  const hasPendingMilestones = totalMilestones > 0 && approvedMilestones < totalMilestones
  const pendingMilestoneCount = totalMilestones - approvedMilestones

  return (
    <div className="space-y-3">
      {/* Action buttons */}
      {!issueMode && (
        <div className="flex gap-2 flex-wrap">
          {!editingCycle && (
            <button className="btn-primary text-xs" onClick={openNewCycleForm}>
              + Log test cycle
            </button>
          )}
          {canSignOff && !view && (
            <button className="btn-secondary text-xs border-green-300 text-green-800 hover:bg-green-50" onClick={() => setView('signoff')}>
              ✓ Submit release sign-off
            </button>
          )}
          {hasSignOff && (
            <button className="btn-secondary text-xs" onClick={() => setView('issue')}>
              Post-delivery issue
            </button>
          )}
        </div>
      )}
      {issueMode && view === null && (
        <button className="btn-secondary text-xs" onClick={() => setView('issue')}>
          Post-delivery issue
        </button>
      )}

      {/* ── TEST CYCLE FORM ───────────────────────────────────────────── */}
      {view === 'cycle' && (
        <div className="card p-5 border-blue-100">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">
            {editingCycle ? 'Edit test cycle' : 'Log test cycle'}
          </h3>

          {cycleValidationError && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-start gap-2 text-red-800">
                <span className="text-lg leading-none">⚠</span>
                <div className="flex-1">
                  <div className="text-sm font-semibold">Required fields missing</div>
                  <div className="text-xs text-red-700 mt-0.5">{cycleValidationError}</div>
                </div>
              </div>
            </div>
          )}

          <form onSubmit={submitCycle} className="space-y-4">
            {/* Cycle type */}
            <div>
              <label className="label">Type of test *</label>
              <div className="grid grid-cols-2 gap-2 mt-1">
                {CYCLE_TYPES.map(t => (
                  <button key={t.value} type="button"
                    onClick={() => setCycleType(t.value)}
                    className={`p-3 rounded-xl border-2 text-left transition-all ${cycleType === t.value ? 'border-gray-900 bg-gray-50' : 'border-gray-100 hover:border-gray-300'}`}>
                    <div className="text-sm font-medium text-gray-900">{t.label}</div>
                    <div className="text-xs text-gray-400 mt-0.5">{t.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="label">Environment</label>
              <select className="input" value={environment} onChange={e => setEnvironment(e.target.value)}>
                {['local','staging','production'].map(e => <option key={e}>{e}</option>)}
              </select>
            </div>

            {/* What was tested */}
            <div>
              <label className="label">What was tested in this cycle?</label>
              <div className="grid grid-cols-2 gap-2 mt-1">
                {CHECKLIST_ITEMS.map(item => (
                  <label key={item.key} className="flex items-center gap-2 cursor-pointer text-sm">
                    <input type="checkbox" checked={!!checklist[item.key]}
                      onChange={e => setChecklist(prev => ({ ...prev, [item.key]: e.target.checked }))} />
                    <span className="text-gray-700">{item.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Result */}
            <div>
              <label className="label">Overall result *</label>
              {hasFailingTestCases(cycleTestCases.filter(tc => tc.title.trim())) && result === 'pass' && (
                <div className="mb-2 p-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
                  One or more test cases failed or are blocked — overall result must be Fail or Conditional.
                </div>
              )}
              {fieldErrors.result && (
                <div className="mb-2 text-xs text-red-600">{fieldErrors.result}</div>
              )}
              <div className="flex gap-2 mt-1">
                {CYCLE_RESULT_OPTIONS.map(r => (
                  <button key={r.value} type="button"
                    onClick={() => setResult(r.value)}
                    className={`flex-1 py-2.5 px-3 rounded-lg border-2 text-xs font-medium transition-all ${result === r.value ? r.cls : 'border-gray-200 text-gray-500'}`}>
                    {r.label}
                  </button>
                ))}
              </div>
              <div className="mt-3">
                <div className="text-xs text-gray-500 mb-2">Could not execute — select if testing was not possible</div>
                <div className="grid grid-cols-2 gap-2">
                  {CYCLE_NON_EXECUTABLE_RESULT_OPTIONS.map(r => (
                    <button key={r.value} type="button"
                      onClick={() => setResult(r.value)}
                      className={`py-2 px-3 rounded-lg border-2 text-xs font-medium transition-all text-left ${result === r.value ? r.cls : 'border-gray-200 text-gray-500'}`}>
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Test cases */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="label mb-0">Test cases *</label>
                <button
                  type="button"
                  className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                  onClick={() => setCycleTestCases(prev => [...prev, newCycleTestCaseRow()])}
                >
                  + Add test case
                </button>
              </div>
              {fieldErrors.testCases && (
                <div className="text-xs text-red-600 mb-2 flex items-center gap-1">
                  <span>⚠</span>
                  <span>{fieldErrors.testCases}</span>
                </div>
              )}
              <div className="space-y-2">
                {cycleTestCases.map((tc, index) => (
                  <div key={tc.id} className="p-3 rounded-xl border border-gray-100 bg-gray-50/50 space-y-2">
                    <div className="flex items-start gap-2">
                      <div className="flex-1">
                        <label className="text-xs text-gray-500 mb-1 block">Test case name</label>
                        <input
                          className="input text-sm"
                          value={tc.title}
                          onChange={e => {
                            setCycleTestCases(prev => prev.map(row =>
                              row.id === tc.id ? { ...row, title: e.target.value } : row
                            ))
                            if (fieldErrors.testCases) {
                              setFieldErrors(prev => ({ ...prev, testCases: '' }))
                            }
                          }}
                          placeholder="e.g. User login with valid credentials"
                        />
                      </div>
                      <div className="w-28 shrink-0">
                        <label className="text-xs text-gray-500 mb-1 block">Result</label>
                        <select
                          className="input text-sm"
                          value={tc.status}
                          onChange={e => setCycleTestCases(prev => prev.map(row =>
                            row.id === tc.id ? { ...row, status: e.target.value } : row
                          ))}
                        >
                          {TEST_CYCLE_CASE_STATUSES.map(s => (
                            <option key={s} value={s}>
                              {TEST_CYCLE_CASE_STATUS_CONFIG[s]?.label ?? s}
                            </option>
                          ))}
                        </select>
                      </div>
                      {cycleTestCases.length > 1 && (
                        <button
                          type="button"
                          className="mt-5 text-gray-400 hover:text-red-600 text-sm px-1"
                          onClick={() => setCycleTestCases(prev => prev.filter(row => row.id !== tc.id))}
                          title="Remove test case"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">Notes</label>
                      <input
                        className="input text-sm"
                        value={tc.notes}
                        onChange={e => setCycleTestCases(prev => prev.map(row =>
                          row.id === tc.id ? { ...row, notes: e.target.value } : row
                        ))}
                        placeholder={index === 0 ? 'Optional — steps tested, browser, edge cases…' : 'Optional notes'}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <label className="label">
                Overall notes
                <span className="text-gray-400 font-normal ml-1">— optional summary for the whole cycle</span>
              </label>
              <textarea
                rows={3}
                className="input"
                value={summary}
                onChange={e => setSummary(e.target.value)}
                placeholder="e.g. Full regression on staging. All core flows verified. One minor UI issue on mobile Safari noted as conditional."
              />
            </div>

            {(result === 'fail' || result === 'conditional') && (
              <div>
                <label className={`label ${result === 'fail' ? 'text-red-600' : 'text-amber-700'}`}>
                  {result === 'fail' ? 'What is blocking release? *' : 'What is the conditional issue? *'}
                </label>
                <textarea
                  rows={2}
                  className={`input ${fieldErrors.blockerNote ? 'border-red-300 bg-red-50' : ''}`}
                  value={blockerNote}
                  onChange={e => {
                    setBlockerNote(e.target.value)
                    if (fieldErrors.blockerNote) {
                      setFieldErrors(prev => ({ ...prev, blockerNote: '' }))
                    }
                  }}
                  placeholder={result === 'fail' ? 'Be specific — what exactly is broken and why it cannot go to client yet' : 'Describe the issue and why client can accept it as-is'}
                />
                {fieldErrors.blockerNote && (
                  <div className="text-xs text-red-600 mt-1 flex items-center gap-1">
                    <span>⚠</span>
                    <span>{fieldErrors.blockerNote}</span>
                  </div>
                )}
              </div>
            )}

            {project.status !== 'qa' || (
              <div>
                <label className="label">What did dev fix since the last cycle?</label>
                <textarea rows={2} className="input" value={fixedInCycle} onChange={e => setFixedInCycle(e.target.value)}
                  placeholder="e.g. Fixed the mobile Safari payment issue from last cycle. Fixed the null state on empty dashboard." />
              </div>
            )}

            <div className="flex gap-2">
              <button type="submit" disabled={loading}
                className="btn-primary">{loading ? 'Saving...' : editingCycle ? 'Save changes' : 'Save test cycle'}</button>
              <button type="button" className="btn-secondary" onClick={resetCycleForm}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* ── SIGN-OFF FORM ─────────────────────────────────────────────── */}
      {view === 'signoff' && (
        <div className="card p-5 bg-green-50 border-green-100">
          <h3 className="text-sm font-semibold text-gray-900 mb-1">Release sign-off</h3>
          <p className="text-xs text-gray-500 mb-4">
            This is the formal gate. Once signed off, the project can be marked as delivered.
            You are putting your name on this.
          </p>

          {/* Milestone warning */}
          {hasPendingMilestones && (
            <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex items-start gap-2 text-amber-800">
                <span className="text-lg leading-none">⚠</span>
                <div className="flex-1">
                  <div className="text-sm font-semibold">
                    {pendingMilestoneCount} milestone{pendingMilestoneCount !== 1 ? 's' : ''} not QA-approved
                  </div>
                  <div className="text-xs text-amber-700 mt-1">
                    Only {approvedMilestones} of {totalMilestones} milestones have been marked as complete by QA.
                    Signing off now means releasing with untested/unverified work.
                  </div>
                </div>
              </div>
            </div>
          )}

          <form onSubmit={submitSignOff} className="space-y-4">
            <div>
              <label className="label">Pre-release checklist</label>
              <div className="space-y-2 mt-1">
                {SIGNOFF_ITEMS.map(item => (
                  <label key={item.key} className="flex items-center gap-3 p-2.5 rounded-lg bg-white border border-gray-100 cursor-pointer">
                    <input type="checkbox" checked={!!signoffChecklist[item.key]}
                      onChange={e => setSignoffChecklist(prev => ({ ...prev, [item.key]: e.target.checked }))} />
                    <span className="text-sm text-gray-800">{item.label}</span>
                    {signoffChecklist[item.key] && <span className="text-green-600 ml-auto text-xs">✓</span>}
                  </label>
                ))}
              </div>
              {!allSigned && (
                <p className="text-xs text-amber-600 mt-2">
                  Not all items ticked? Note the exceptions below — you can still sign off with exceptions acknowledged.
                </p>
              )}
            </div>

            {!allSigned && (
              <div>
                <label className="label">Exception notes (required if any item unticked)</label>
                <textarea rows={2} className="input" value={exceptionsNotes} onChange={e => setExceptionsNotes(e.target.value)}
                  placeholder="Why is this item not met? What is the agreed workaround?" />
              </div>
            )}

            {/* Milestone acknowledgment if pending */}
            {hasPendingMilestones && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={milestoneAck}
                    onChange={e => setMilestoneAck(e.target.checked)}
                    className="mt-1"
                  />
                  <span className="text-sm text-amber-900">
                    I acknowledge that {pendingMilestoneCount} milestone{pendingMilestoneCount !== 1 ? 's are' : ' is'} still pending QA approval,
                    and I am signing off on this release with incomplete milestone verification.
                  </span>
                </label>
              </div>
            )}

            <div>
              <label className="label">Quality score for this release (1 = poor, 10 = excellent)</label>
              <div className="flex gap-2 mt-1">
                {[1,2,3,4,5,6,7,8,9,10].map(n => (
                  <button key={n} type="button" onClick={() => setQualityScore(n)}
                    className={`flex-1 py-2 text-xs font-semibold rounded transition-all ${
                      qualityScore === n
                        ? n >= 8 ? 'bg-green-500 text-white' : n >= 6 ? 'bg-amber-400 text-white' : 'bg-red-400 text-white'
                        : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                    }`}>{n}</button>
                ))}
              </div>
            </div>

            <div>
              <label className="label">Release notes <span className="text-gray-400 font-normal">(summary to share with team)</span></label>
              <textarea rows={2} className="input" value={releaseNotes} onChange={e => setReleaseNotes(e.target.value)}
                placeholder="e.g. All core flows tested and passing. Payment integration verified on staging. Two minor UI tweaks shipped since last cycle." />
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={
                  loading ||
                  !signedOffById ||
                  (!allSigned && !exceptionsNotes) ||
                  (hasPendingMilestones && !milestoneAck)
                }
                className="btn-primary bg-green-700 hover:bg-green-800 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Submitting...' : '✓ Sign off — ready to deliver'}
              </button>
              <button type="button" className="btn-secondary" onClick={() => setView(null)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* ── POST-DELIVERY ISSUE FORM ──────────────────────────────────── */}
      {view === 'issue' && (
        <div className="card p-5 border-red-100">
          <h3 className="text-sm font-semibold text-gray-900 mb-1">Log post-delivery issue</h3>
          <p className="text-xs text-gray-500 mb-4">
            Something the client reported after we delivered. Not a bug tracker — log what we missed.
          </p>
          <form onSubmit={submitIssue} className="space-y-4">
            <div>
              <label className="label">What did the client report? *</label>
              <textarea required rows={3} className="input" value={issueDesc} onChange={e => setIssueDesc(e.target.value)}
                placeholder="Describe exactly what the client said or found. Be specific." />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Severity</label>
                <select className="input" value={issueSeverity} onChange={e => setIssueSeverity(e.target.value)}>
                  {['low','medium','high','critical'].map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Reported by (client name / channel)</label>
                <input className="input" value={issueReportedBy} onChange={e => setIssueReportedBy(e.target.value)}
                  placeholder="e.g. John via WhatsApp" />
              </div>
            </div>
            <div>
              <label className="label">Was this something QA should have caught?</label>
              <div className="flex gap-2 mt-1">
                {[
                  { v: true,  label: 'Yes — QA miss' },
                  { v: false, label: 'No — out of scope / new requirement' },
                ].map(o => (
                  <button key={String(o.v)} type="button"
                    onClick={() => setIssueInScope(o.v)}
                    className={`flex-1 py-2 px-3 rounded-lg border-2 text-sm transition-all ${
                      issueInScope === o.v ? (o.v ? 'border-red-400 bg-red-50 text-red-800' : 'border-gray-400 bg-gray-50 text-gray-800') : 'border-gray-200 text-gray-500'
                    }`}>{o.label}</button>
                ))}
              </div>
            </div>
            {issueInScope === true && (
              <div>
                <label className="label text-red-600">Why did QA miss this?</label>
                <textarea rows={2} className="input border-red-200" value={issueRootCause} onChange={e => setIssueRootCause(e.target.value)}
                  placeholder="Honest assessment — was it not in the test plan? Tested on wrong environment? Edge case not considered?" />
              </div>
            )}
            <div className="flex gap-2">
              <button type="submit" disabled={loading || !issueDesc}
                className="btn-primary">{loading ? 'Logging...' : 'Log issue'}</button>
              <button type="button" className="btn-secondary" onClick={() => setView(null)}>Cancel</button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
