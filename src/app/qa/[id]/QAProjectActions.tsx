'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'

type Member = { id: string; name: string; role: string }
type Project = { id: string; name: string; status: string }

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
  project, members, canSignOff, latestCycleId, issueMode = false,
}: {
  project: Project
  members: Member[]
  canSignOff: boolean
  latestCycleId?: string
  issueMode?: boolean
}) {
  const router = useRouter()
  const { data: session } = useSession()
  const [view, setView] = useState<'cycle' | 'signoff' | 'issue' | null>(
    issueMode ? 'issue' : null
  )
  const [loading, setLoading] = useState(false)
  const [cycleValidationError, setCycleValidationError] = useState('')

  // Test cycle form state
  const [cycleType, setCycleType] = useState('pre_release')
  const [environment, setEnvironment] = useState('staging')
  const [conductedById, setConductedById] = useState('')
  const [result, setResult] = useState<'pass' | 'fail' | 'conditional'>('pass')
  const [checklist, setChecklist] = useState<Record<string, boolean>>({})
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

  async function submitCycle(e: React.FormEvent) {
    e.preventDefault()

    // Validate required fields
    const errors: string[] = []
    if (!conductedById) errors.push('Tested by is required')
    if (!summary.trim()) errors.push('Test report summary is required')
    if ((result === 'fail' || result === 'conditional') && !blockerNote.trim()) {
      errors.push(result === 'fail' ? 'Blocker description is required' : 'Conditional issue description is required')
    }

    if (errors.length > 0) {
      setCycleValidationError(errors.join('. '))
      return
    }

    setCycleValidationError('')
    setLoading(true)
    await fetch(`/api/qa/${project.id}/cycle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cycleType, environment, conductedById, result,
        ...checklist, summary, blockerNote, fixedInCycle,
      }),
    })
    setLoading(false)
    setView(null)
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

  return (
    <div className="space-y-3">
      {/* Action buttons */}
      {!issueMode && (
        <div className="flex gap-2 flex-wrap">
          <button className="btn-primary text-xs" onClick={() => setView('cycle')}>
            + Log test cycle
          </button>
          {canSignOff && !view && (
            <button className="btn-secondary text-xs border-green-300 text-green-800 hover:bg-green-50" onClick={() => setView('signoff')}>
              ✓ Submit release sign-off
            </button>
          )}
          <button className="btn-secondary text-xs" onClick={() => setView('issue')}>
            + Post-delivery issue
          </button>
        </div>
      )}
      {issueMode && view === null && (
        <button className="btn-secondary text-xs" onClick={() => setView('issue')}>
          + Log post-delivery issue
        </button>
      )}

      {/* ── TEST CYCLE FORM ───────────────────────────────────────────── */}
      {view === 'cycle' && (
        <div className="card p-5 border-blue-100">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Log test cycle</h3>

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
              <div className="flex gap-2 mt-1">
                {([
                  { v: 'pass' as const,        label: '✓ Pass — clear to release',        cls: 'border-green-300 bg-green-50 text-green-800' },
                  { v: 'conditional' as const, label: '~ Conditional — minor issues',      cls: 'border-amber-300 bg-amber-50 text-amber-800' },
                  { v: 'fail' as const,        label: '⛔ Fail — release blocked',         cls: 'border-red-300 bg-red-50 text-red-800' },
                ] as const).map(r => (
                  <button key={r.v} type="button"
                    onClick={() => setResult(r.v)}
                    className={`flex-1 py-2.5 px-3 rounded-lg border-2 text-xs font-medium transition-all ${result === r.v ? r.cls : 'border-gray-200 text-gray-500'}`}>
                    {r.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="label">
                Test report summary *
                <span className="text-gray-400 font-normal ml-1">— what you tested, what passed, what's the state</span>
              </label>
              <textarea required rows={4} className="input" value={summary} onChange={e => setSummary(e.target.value)}
                placeholder="e.g. Tested all core flows on staging. Auth, booking, and dashboard all working correctly. Payment integration passing. One edge case on mobile Safari noted as conditional — client is aware. Regression against v1.2 features: all passing." />
            </div>

            {(result === 'fail' || result === 'conditional') && (
              <div>
                <label className={`label ${result === 'fail' ? 'text-red-600' : 'text-amber-700'}`}>
                  {result === 'fail' ? 'What is blocking release? *' : 'What is the conditional issue?'}
                </label>
                <textarea required={result === 'fail'} rows={2} className="input" value={blockerNote} onChange={e => setBlockerNote(e.target.value)}
                  placeholder={result === 'fail' ? 'Be specific — what exactly is broken and why it cannot go to client yet' : 'Describe the issue and why client can accept it as-is'} />
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
                className="btn-primary">{loading ? 'Saving...' : 'Save test cycle'}</button>
              <button type="button" className="btn-secondary" onClick={() => { setView(null); setCycleValidationError('') }}>Cancel</button>
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
              <button type="submit" disabled={loading || !signedOffById || (!allSigned && !exceptionsNotes)}
                className="btn-primary bg-green-700 hover:bg-green-800">
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
