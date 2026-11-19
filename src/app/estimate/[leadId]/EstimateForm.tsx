'use client'
import { useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { fmtCurrency } from '@/lib/utils'
import SimpleSelect from '@/components/SimpleSelect'

type Member = { id: string; name: string; role: string }
type Lead = { id: string; clientName: string; description: string | null; budget: number | null; currency: string; source: string; owner: { name: string } }
type Line = { id?: string; phase: string; feature: string; description: string | null; estimatedHours: number; complexityLevel: string; riskFlag: boolean; riskNote: string | null; assumptions: string | null; sortOrder: number; actualHours?: number | null; variancePct?: number | null }
type ExistingRecord = { id: string; status: string; assignee: { id: string; name: string }; requester: { name: string }; record: { id: string; totalHoursRaw: number; totalHoursFinal: number; bufferPct: number; ratePerHour: number | null; totalPriceFinal: number | null; overallRisk: string; assumptions: string | null; exclusions: string | null; devConfirmedAt: string | null; bdApprovedAt: string | null; bdRevisionNote: string | null; lines: Line[] } | null } | null

const PHASES = ['discovery','design','frontend','backend','mobile','qa','devops','integration','other']

const emptyLine = (order: number): Line => ({
  phase: 'frontend', feature: '', description: '', estimatedHours: 0,
  complexityLevel: 'medium', riskFlag: false, riskNote: '', assumptions: '', sortOrder: order,
})

export default function EstimateForm({ lead, members, existingRequest }: { lead: Lead; members: Member[]; existingRequest: ExistingRecord }) {
  const router = useRouter()
  const { data: session } = useSession()
  const hasRecord = !!existingRequest?.record
  const existing = existingRequest?.record

  const [step, setStep] = useState<'request'|'estimate'|'review'>(
    existing?.devConfirmedAt ? 'review' :
    existingRequest ? 'estimate' :
    'request'
  )
  const [requestLoading, setRequestLoading] = useState(false)
  const [saveLoading, setSaveLoading] = useState(false)
  const [submitAttempted, setSubmitAttempted] = useState(false)

  // Request form
  const [assignedTo, setAssignedTo] = useState(existingRequest?.assignee?.id ?? '')
  const [requestedBy, setRequestedBy] = useState('')
  const [requestNotes, setRequestNotes] = useState('')
  const [dueBy, setDueBy] = useState('')

  // Estimation form
  const [estimatedById, setEstimatedById] = useState(existingRequest?.assignee?.id ?? '')
  const [lines, setLines] = useState<Line[]>(existing?.lines?.length ? existing.lines : [emptyLine(0)])
  const [bufferPct, setBufferPct] = useState(existing?.bufferPct ?? 20)
  const [ratePerHour, setRatePerHour] = useState<number>(existing?.ratePerHour ?? 25)
  const [overallRisk, setOverallRisk] = useState(existing?.overallRisk ?? 'medium')
  const [assumptions, setAssumptions] = useState(existing?.assumptions ?? '')
  const [exclusions, setExclusions] = useState(existing?.exclusions ?? '')

  // Set initial step based on role once session loads
  useEffect(() => {
    const userRole = session?.user?.role
    const isBD = userRole && ['BD', 'Founder', 'Both'].includes(userRole)
    const isDev = userRole && ['Dev', 'Founder', 'Both'].includes(userRole)

    if (existing?.devConfirmedAt) {
      setStep('review')
    } else if (existingRequest && isDev && !isBD) {
      // Pure developers go to estimate tab
      setStep('estimate')
    } else if (existingRequest) {
      // BD users (or users with both roles) view the request tab
      setStep('request')
    } else if (isDev && !isBD) {
      // Pure developers without a request see estimate tab with "no request yet" message
      setStep('estimate')
    } else {
      setStep('request')
    }
  }, [session?.user?.role, existingRequest, existing?.devConfirmedAt])

  // Auto-fill requestedBy with current user (BD)
  useEffect(() => {
    if (session?.user?.id && !existingRequest) {
      const currentUser = members.find(m => m.id === session.user.id)
      if (currentUser && ['BD', 'Both', 'Founder'].includes(currentUser.role)) {
        setRequestedBy(session.user.id)
      }
    }
  }, [session, members, existingRequest])

  // Auto-fill estimatedById with current user (Dev) or assignedTo
  useEffect(() => {
    if (session?.user?.id && !estimatedById) {
      const currentUser = members.find(m => m.id === session.user.id)
      // If current user is a developer, auto-select them
      if (currentUser && ['Dev', 'Both', 'Founder'].includes(currentUser.role)) {
        setEstimatedById(session.user.id)
      }
      // Or if they were assigned to this estimation
      else if (existingRequest?.assignee?.id === session.user.id) {
        setEstimatedById(session.user.id)
      }
    }
  }, [session, members, existingRequest, estimatedById])

  // Totals
  const rawHours = lines.reduce((s, l) => s + (Number(l.estimatedHours) || 0), 0)
  const bufferedHours = Math.ceil(rawHours * (1 + bufferPct / 100))
  const totalPrice = bufferedHours * ratePerHour
  const riskLines = lines.filter(l => l.riskFlag)

  const updateLine = useCallback((i: number, field: keyof Line, val: unknown) => {
    setLines(prev => prev.map((l, idx) => idx === i ? { ...l, [field]: val } : l))
  }, [])

  const addLine = () => setLines(prev => [...prev, emptyLine(prev.length)])
  const removeLine = (i: number) => setLines(prev => prev.filter((_, idx) => idx !== i))

  async function submitRequest(e: React.FormEvent) {
    e.preventDefault()
    setRequestLoading(true)
    const response = await fetch('/api/estimate/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ leadId: lead.id, requestedBy, assignedTo, notes: requestNotes, dueBy }),
    })
    setRequestLoading(false)
    if (response.ok) {
      router.refresh()
      // Stay on request tab to show confirmation message
    }
  }

  async function saveEstimate(confirmNow: boolean) {
    if (confirmNow && rawHours === 0) {
      setSubmitAttempted(true)
      return
    }
    setSaveLoading(true)
    setSubmitAttempted(false)
    const requestId = existingRequest?.id
    await fetch('/api/estimate/record', {
      method: existingRequest?.record ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        requestId,
        leadId: lead.id,
        estimatedById,
        lines,
        bufferPct,
        ratePerHour,
        overallRisk,
        assumptions,
        exclusions,
        confirm: confirmNow,
      }),
    })
    setSaveLoading(false)
    if (confirmNow) {
      router.refresh()
      setStep('review')
    } else {
      // Redirect to estimates page after saving draft
      router.push('/estimate')
    }
  }

  const devMembers = members.filter(m => ['Dev','Both','Founder','QA'].includes(m.role))
  const bdMembers = members.filter(m => ['BD','Both','Founder'].includes(m.role))

  const statusColors: Record<string, string> = {
    pending: 'bg-gray-100 text-gray-600', in_progress: 'bg-blue-100 text-blue-800',
    submitted: 'bg-amber-100 text-amber-800', revision: 'bg-red-100 text-red-700',
    confirmed: 'bg-purple-100 text-purple-800', approved: 'bg-green-100 text-green-800',
  }

  return (
    <div className="w-full mx-auto min-w-0">
      <div className="text-xs text-gray-400 mb-2">← <a href={`/pipeline/${lead.id}`} className="hover:text-gray-700">Pipeline / {lead.clientName}</a></div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between mb-6">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-semibold text-gray-900 break-words">Estimation — {lead.clientName}</h1>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-sm text-gray-500">
            <span>{lead.source}</span>
            {lead.budget && session?.user?.role && ['BD', 'Founder', 'Both'].includes(session.user.role) && (
              <span>Client budget: {fmtCurrency(lead.budget, lead.currency)}</span>
            )}
            <span>BD owner: {lead.owner.name}</span>
          </div>
          {lead.description && <p className="text-sm text-gray-600 mt-2 max-w-2xl">{lead.description}</p>}
        </div>
        {existingRequest && (
          <span className={`badge shrink-0 self-start ${statusColors[existingRequest.status] ?? 'bg-gray-100 text-gray-600'}`}>
            {existingRequest.status.replace('_',' ')}
          </span>
        )}
      </div>

      {/* BD revision note */}
      {existingRequest?.record?.bdRevisionNote && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl">
          <div className="text-sm font-semibold text-red-800 mb-1">BD requested revision:</div>
          <p className="text-sm text-red-700">{existingRequest.record.bdRevisionNote}</p>
        </div>
      )}

      {/* Step tabs */}
      <div className="flex gap-1 mb-6 overflow-x-auto scrollbar-hide -mx-1 px-1">
        {[['request','BD Request'],['estimate','Dev Estimate'],['review','Review & Confirm']].map(([s,l]) => {
          const userRole = session?.user?.role
          const isBD = userRole && ['BD', 'Founder', 'Both'].includes(userRole)
          const isDev = userRole && ['Dev', 'Founder', 'Both'].includes(userRole)

          // Hide BD Request tab from pure developers
          if (s === 'request' && !isBD) return null

          // Hide Dev Estimate tab from BD users completely
          if (s === 'estimate' && !isDev) return null

          // Hide Dev Estimate tab from developers after they confirm (until BD sends back for revision)
          if (s === 'estimate' && isDev && !isBD && existing?.devConfirmedAt) return null

          return (
            <button key={s} type="button" onClick={() => setStep(s as 'request'|'estimate'|'review')}
              className={`px-3 sm:px-4 py-2 text-sm rounded-lg transition-colors whitespace-nowrap shrink-0 ${step === s ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
              {l}
            </button>
          )
        })}
      </div>

      {/* ── STEP 1: BD REQUEST ──────────────────────────────────────────────── */}
      {step === 'request' && (
        <div className="card p-4 sm:p-6 min-w-0">
          <h2 className="text-sm font-semibold text-gray-900 mb-1">Request estimation from developer</h2>
          <p className="text-xs text-gray-400 mb-4">BD fills this out when a lead needs a quote. This formally assigns the estimation to a developer.</p>

          {existingRequest ? (
            <div className="space-y-3 text-sm">
              <div className="space-y-2 text-sm">
                <div className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-x-3 items-baseline">
                  <span className="text-xs text-gray-500 font-medium">Requested by</span>
                  <p className="font-medium text-gray-900 break-words">{existingRequest.requester.name}</p>
                </div>
                <div className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-x-3 items-baseline">
                  <span className="text-xs text-gray-500 font-medium">Assigned to</span>
                  <p className="font-medium text-gray-900 break-words">{existingRequest.assignee.name}</p>
                </div>
                <div className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-x-3 items-center">
                  <span className="text-xs text-gray-500 font-medium">Status</span>
                  <span className={`badge text-xs w-fit ${statusColors[existingRequest.status]}`}>
                    {existingRequest.status.replace('_', ' ')}
                  </span>
                </div>
              </div>
              {session?.user?.role && ['Dev', 'Both', 'Founder'].includes(session.user.role) && (
                <div className="flex gap-2 mt-4">
                  <button type="button" className="btn-primary text-sm" onClick={() => setStep('estimate')}>
                    {existing ? 'Edit estimate →' : 'Start estimate →'}
                  </button>
                </div>
              )}
              {session?.user?.role === 'BD' && (
                <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
                  ✓ Estimation request sent to {existingRequest.assignee.name}. You&apos;ll be notified when they submit their estimate.
                </div>
              )}
            </div>
          ) : (
            <form onSubmit={submitRequest} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="min-w-0">
                  <label className="label">Requested by (BD)</label>
                  <input
                    type="text"
                    className="input bg-gray-50"
                    value={bdMembers.find(m => m.id === requestedBy)?.name || session?.user?.name || ''}
                    disabled
                    readOnly
                  />
                </div>
                <div className="min-w-0">
                  <label className="label">Assign estimation to (Developer) *</label>
                  <SimpleSelect
                    required
                    aria-label="Assign estimation to"
                    placeholder="Select…"
                    value={assignedTo}
                    onChange={setAssignedTo}
                    options={devMembers.map(m => ({ value: m.id, label: m.name }))}
                  />
                </div>
              </div>
              <div className="min-w-0">
                <label className="label">Due by</label>
                <input
                  type="datetime-local"
                  className="input date-input min-w-0"
                  value={dueBy}
                  onChange={e => setDueBy(e.target.value)}
                />
              </div>
              <div className="min-w-0">
                <label className="label">Scope notes for the developer</label>
                <textarea rows={4} className="input" value={requestNotes} onChange={e => setRequestNotes(e.target.value)}
                  placeholder="What has the client asked for? Any specific requirements, constraints, or tech preferences they mentioned? What is definitely included vs possibly out of scope?" />
              </div>
              <button type="submit" disabled={requestLoading || !requestedBy || !assignedTo} className="btn-primary">
                {requestLoading ? 'Sending...' : 'Send estimation request →'}
              </button>
            </form>
          )}
        </div>
      )}

      {/* ── STEP 2: DEV ESTIMATE ────────────────────────────────────────────── */}
      {step === 'estimate' && !existingRequest && session?.user?.role === 'Dev' && (
        <div className="card p-8 text-center">
          <div className="text-gray-400 mb-2">📋</div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No estimation request yet</h3>
          <p className="text-sm text-gray-500">Ask your BD team to create an estimation request for this lead first.</p>
        </div>
      )}
      {step === 'estimate' && (existingRequest || session?.user?.role !== 'Dev') && (
        <div className="space-y-4 min-w-0">
          {/* Header controls */}
          <div className="card p-4 min-w-0">
            <div className={`grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 ${session?.user?.role && ['BD', 'Founder', 'Both'].includes(session.user.role) ? 'lg:grid-cols-4' : 'lg:grid-cols-3'}`}>
              <div className="min-w-0">
                <label className="label">Estimated by (Developer)</label>
                <input
                  type="text"
                  className="input bg-gray-50"
                  value={devMembers.find(m => m.id === estimatedById)?.name || session?.user?.name || ''}
                  disabled
                  readOnly
                />
              </div>
              <div className="min-w-0">
                <label className="label">Buffer % (risk padding)</label>
                <input type="number" min="0" max="100" className="input" value={bufferPct}
                  onChange={e => setBufferPct(Number(e.target.value))} />
              </div>
              {session?.user?.role && ['BD', 'Founder', 'Both'].includes(session.user.role) && (
                <div className="min-w-0">
                  <label className="label">Rate / hour (USD)</label>
                  <input type="number" min="1" className="input" value={ratePerHour}
                    onChange={e => setRatePerHour(Number(e.target.value))} />
                </div>
              )}
              <div className="min-w-0">
                <label className="label">Overall risk</label>
                <SimpleSelect
                  aria-label="Overall risk"
                  value={overallRisk}
                  onChange={setOverallRisk}
                  options={['low', 'medium', 'high'].map(r => ({ value: r, label: r }))}
                />
              </div>
            </div>
          </div>

          {/* Live totals bar */}
          <div className={`card p-4 ${session?.user?.role && ['BD', 'Founder', 'Both'].includes(session.user.role) && totalPrice > (lead.budget ?? Infinity) ? 'bg-red-50 border-red-200' : 'bg-blue-50 border-blue-200'}`}>
            <div className="grid grid-cols-2 sm:flex sm:flex-wrap sm:items-center gap-3 sm:gap-6">
              <div>
                <div className="text-xs text-gray-500 uppercase tracking-wide">Raw hours</div>
                <div className="text-xl sm:text-2xl font-bold text-gray-900">{rawHours}h</div>
              </div>
              <div>
                <div className="text-xs text-gray-500 uppercase tracking-wide">{bufferPct}% buffer</div>
                <div className="text-xl sm:text-2xl font-bold text-gray-900">{bufferedHours}h total</div>
              </div>
              {session?.user?.role && ['BD', 'Founder', 'Both'].includes(session.user.role) && (
                <>
                  <div>
                    <div className="text-xs text-gray-500 uppercase tracking-wide">Rate</div>
                    <div className="text-xl sm:text-2xl font-bold text-gray-900">${ratePerHour}/h</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 uppercase tracking-wide">Total quote</div>
                    <div className={`text-xl sm:text-2xl font-bold ${totalPrice > (lead.budget ?? Infinity) ? 'text-red-600' : 'text-green-700'}`}>
                      ${totalPrice.toLocaleString()}
                    </div>
                    {lead.budget && totalPrice > lead.budget && (
                      <div className="text-xs text-red-600">⚠ ${(totalPrice - lead.budget).toLocaleString()} over client budget</div>
                    )}
                  </div>
                </>
              )}
              {riskLines.length > 0 && (
                <div className="col-span-2 sm:ml-auto sm:self-center">
                  <span className="badge bg-amber-100 text-amber-800">{riskLines.length} risk flag{riskLines.length > 1 ? 's' : ''}</span>
                </div>
              )}
            </div>
          </div>

          {/* Line items — stacked cards on mobile, grid on desktop */}
          <div className="space-y-3 lg:hidden">
            {lines.map((line, i) => (
              <div key={i} className={`card p-3 space-y-2 min-w-0 ${line.riskFlag ? 'border-amber-200 bg-amber-50/40' : ''}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-gray-500">Line {i + 1}</span>
                  {lines.length > 1 && (
                    <button type="button" onClick={() => removeLine(i)} className="text-xs text-red-500">Remove</button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="min-w-0">
                    <label className="text-xs text-gray-500 mb-1 block">Phase</label>
                    <SimpleSelect
                      aria-label={`Phase for line ${i + 1}`}
                      value={line.phase}
                      onChange={v => updateLine(i, 'phase', v)}
                      options={PHASES.map(p => ({ value: p, label: p }))}
                    />
                  </div>
                  <div className="min-w-0">
                    <label className="text-xs text-gray-500 mb-1 block">Hours</label>
                    <input type="number" min="0" step="0.5" className="input font-semibold"
                      value={line.estimatedHours || ''} placeholder="0"
                      onChange={e => updateLine(i, 'estimatedHours', parseFloat(e.target.value) || 0)} />
                  </div>
                </div>
                <div className="min-w-0">
                  <label className="text-xs text-gray-500 mb-1 block">Feature / Task</label>
                  <input className="input" value={line.feature} placeholder="e.g. User login & auth"
                    onChange={e => updateLine(i, 'feature', e.target.value)} />
                </div>
                <div className="min-w-0">
                  <label className="text-xs text-gray-500 mb-1 block">Description</label>
                  <input className="input" value={line.description || ''} placeholder="What's included"
                    onChange={e => updateLine(i, 'description', e.target.value)} />
                </div>
                <div className="min-w-0">
                  <label className="text-xs text-gray-500 mb-1 block">Complexity</label>
                  <SimpleSelect
                    aria-label={`Complexity for line ${i + 1}`}
                    value={line.complexityLevel}
                    onChange={v => updateLine(i, 'complexityLevel', v)}
                    options={[
                      { value: 'simple', label: 'Simple' },
                      { value: 'medium', label: 'Medium' },
                      { value: 'complex', label: 'Complex' },
                    ]}
                  />
                </div>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input type="checkbox" checked={line.riskFlag} onChange={e => updateLine(i, 'riskFlag', e.target.checked)} />
                  <span className="text-xs text-amber-700">Risk flag</span>
                </label>
                {line.riskFlag && (
                  <input className="input" value={line.riskNote || ''} placeholder="Why risky?"
                    onChange={e => updateLine(i, 'riskNote', e.target.value)} />
                )}
                <input className="input" value={line.assumptions || ''} placeholder="Assumptions"
                  onChange={e => updateLine(i, 'assumptions', e.target.value)} />
              </div>
            ))}
            <button type="button" onClick={addLine} className="text-sm text-blue-600 hover:text-blue-800 font-medium">
              + Add feature / phase
            </button>
          </div>

          <div className="card overflow-hidden hidden lg:block">
            <div className="overflow-x-auto">
              <div className="min-w-[1100px]">
                <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 grid grid-cols-12 gap-3 text-xs text-gray-400 uppercase tracking-wide font-medium">
                  <div className="col-span-2">Phase</div>
                  <div className="col-span-2">Feature / Task</div>
                  <div className="col-span-2">Description</div>
                  <div className="col-span-1 text-center">Hours</div>
                  <div className="col-span-2 text-center">Complexity</div>
                  <div className="col-span-2">Assumptions / Risks</div>
                  <div className="col-span-1" />
                </div>

                <div className="divide-y divide-gray-50">
                  {lines.map((line, i) => (
                    <div key={i} className={`px-4 py-3 grid grid-cols-12 gap-3 items-start ${line.riskFlag ? 'bg-amber-50' : ''}`}>
                      <div className="col-span-2 min-w-0">
                        <SimpleSelect
                          aria-label={`Phase for line ${i + 1}`}
                          value={line.phase}
                          onChange={v => updateLine(i, 'phase', v)}
                          options={PHASES.map(p => ({ value: p, label: p }))}
                        />
                      </div>
                      <div className="col-span-2">
                        <input className="input text-sm py-1.5" value={line.feature} placeholder="e.g. User login & auth"
                          onChange={e => updateLine(i, 'feature', e.target.value)} />
                      </div>
                      <div className="col-span-2">
                        <input className="input text-sm py-1.5" value={line.description || ''} placeholder="What's included"
                          onChange={e => updateLine(i, 'description', e.target.value)} />
                      </div>
                      <div className="col-span-1">
                        <input type="number" min="0" step="0.5" className="input text-sm py-1.5 text-center font-semibold"
                          value={line.estimatedHours || ''} placeholder="0"
                          onChange={e => updateLine(i, 'estimatedHours', parseFloat(e.target.value) || 0)} />
                      </div>
                      <div className="col-span-2 min-w-0">
                        <SimpleSelect
                          aria-label={`Complexity for line ${i + 1}`}
                          value={line.complexityLevel}
                          onChange={v => updateLine(i, 'complexityLevel', v)}
                          options={[
                            { value: 'simple', label: 'Simple' },
                            { value: 'medium', label: 'Medium' },
                            { value: 'complex', label: 'Complex' },
                          ]}
                        />
                      </div>
                      <div className="col-span-2 space-y-1">
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input type="checkbox" checked={line.riskFlag} onChange={e => updateLine(i, 'riskFlag', e.target.checked)} />
                          <span className="text-xs text-amber-700">Risk flag</span>
                        </label>
                        {line.riskFlag && (
                          <input className="input text-sm py-1" value={line.riskNote || ''} placeholder="Why risky?"
                            onChange={e => updateLine(i, 'riskNote', e.target.value)} />
                        )}
                        <input className="input text-sm py-1" value={line.assumptions || ''} placeholder="Assumptions"
                          onChange={e => updateLine(i, 'assumptions', e.target.value)} />
                      </div>
                      <div className="col-span-1 flex items-center justify-center">
                        {lines.length > 1 && (
                          <button type="button" onClick={() => removeLine(i)} className="text-gray-300 hover:text-red-400 text-lg leading-none">×</button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="px-4 py-3 border-t border-gray-50">
                  <button type="button" onClick={addLine} className="text-sm text-blue-600 hover:text-blue-800 font-medium">
                    + Add feature / phase
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Global assumptions & exclusions */}
          <div className="card p-4 space-y-3">
            <div>
              <label className="label">Key assumptions (what must be true for this estimate to hold)</label>
              <textarea rows={3} className="input" value={assumptions} onChange={e => setAssumptions(e.target.value)}
                placeholder="e.g. Client provides all content and assets by week 2. Design approved before development starts. No third-party API changes during build." />
            </div>
            <div>
              <label className="label">Explicit exclusions (what is NOT in this estimate)</label>
              <textarea rows={2} className="input" value={exclusions} onChange={e => setExclusions(e.target.value)}
                placeholder="e.g. Hosting setup, SEO, mobile app (web only), payment gateway fees, future maintenance." />
            </div>
          </div>

          {/* Validation banner */}
          {submitAttempted && rawHours === 0 && (
            <div className="card p-4 bg-red-50 border-red-200">
              <div className="flex items-center gap-2 text-red-800">
                <span className="text-lg">⚠</span>
                <div>
                  <div className="text-sm font-semibold">Cannot submit estimate with 0 hours</div>
                  <div className="text-xs text-red-700 mt-0.5">
                    Please add estimated hours for at least one feature before confirming.
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-3">
            <button type="button" onClick={() => saveEstimate(false)} disabled={saveLoading || !estimatedById}
              className="btn-secondary">
              {saveLoading ? 'Saving...' : 'Save draft'}
            </button>
            <button type="button" onClick={() => saveEstimate(true)} disabled={saveLoading || !estimatedById}
              className="btn-primary">
              {saveLoading ? 'Confirming...' : 'Confirm & submit to BD →'}
            </button>
          </div>

          <p className="text-xs text-gray-400">
            By clicking "Confirm & submit", you are signing off on these numbers. Your name will be recorded as the estimator. You can still revise if BD sends it back.
          </p>
        </div>
      )}

      {/* ── STEP 3: REVIEW ─────────────────────────────────────────────────── */}
      {step === 'review' && existing && (
        <EstimationReview record={existing} estimateId={existing.id} budget={lead.budget} currency={lead.currency} />
      )}
      {step === 'review' && !existing && (
        <div className="card p-8 text-center text-gray-400">Developer hasn't submitted an estimate yet.</div>
      )}
    </div>
  )
}

// ─── Inline review component ──────────────────────────────────────────────────
function EstimationReview({ record, estimateId, budget, currency }: {
  record: { id: string; totalHoursRaw: number; totalHoursFinal: number; bufferPct: number; ratePerHour: number | null; totalPriceFinal: number | null; overallRisk: string; assumptions: string | null; exclusions: string | null; devConfirmedAt: string | null; bdApprovedAt: string | null; bdRevisionNote: string | null; lines: Line[] }
  estimateId: string; budget: number | null; currency: string
}) {
  const router = useRouter()
  const { data: session } = useSession()
  const [approving, setApproving] = useState(false)
  const [revisionNote, setRevisionNote] = useState('')
  const [showRevision, setShowRevision] = useState(false)
  const [loading, setLoading] = useState(false)

  // Check if user has BD permissions
  const isBD = session?.user?.role && ['BD', 'Both', 'Founder'].includes(session.user.role)

  async function approve() {
    setLoading(true)
    await fetch(`/api/estimate/${estimateId}/approve`, { method: 'POST', credentials: 'include' })
    setLoading(false)
    router.refresh()
  }

  async function sendRevision() {
    setLoading(true)
    await fetch(`/api/estimate/${estimateId}/revision`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ note: revisionNote }),
    })
    setLoading(false)
    setShowRevision(false)
    router.refresh()
  }

  const phaseGroups = record.lines.reduce((acc, l) => {
    if (!acc[l.phase]) acc[l.phase] = []
    acc[l.phase].push(l)
    return acc
  }, {} as Record<string, Line[]>)

  const totalActual = record.lines.filter(l => l.actualHours).reduce((s, l) => s + (l.actualHours ?? 0), 0)
  const showActualCols = totalActual > 0

  return (
    <div className="space-y-3 sm:space-y-4 min-w-0">
      {/* Summary */}
      <div className={`grid gap-2 sm:gap-3 grid-cols-2 ${isBD ? 'lg:grid-cols-4' : ''}`}>
        {[
          { label: 'Raw estimate', value: `${record.totalHoursRaw}h`, show: true },
          { label: `+${record.bufferPct}% buffer`, value: `${record.totalHoursFinal}h`, show: true },
          { label: 'Rate', value: `$${record.ratePerHour}/h`, show: isBD },
          { label: 'Quoted price', value: `$${record.totalPriceFinal?.toLocaleString() ?? '—'}`, highlight: budget && record.totalPriceFinal && record.totalPriceFinal > budget, show: isBD },
        ].filter(k => k.show).map(k => (
          <div key={k.label} className={`card p-3 min-w-0 ${k.highlight ? 'bg-red-50' : ''}`}>
            <div className="text-[10px] sm:text-xs text-gray-400 uppercase tracking-wide mb-0.5 leading-snug">{k.label}</div>
            <div className={`text-lg sm:text-xl font-bold tabular-nums break-words ${k.highlight ? 'text-red-600' : 'text-gray-900'}`}>{k.value}</div>
            {k.highlight && <div className="text-xs text-red-500">Over client budget</div>}
          </div>
        ))}
      </div>

      {/* Confirmed/approved status */}
      <div className="space-y-2">
        <div className="flex flex-wrap gap-2 text-sm">
          <div className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium ${record.devConfirmedAt ? 'bg-green-50 text-green-800' : 'bg-gray-50 text-gray-400'}`}>
            {record.devConfirmedAt ? '✓ Dev confirmed' : '○ Awaiting dev'}
          </div>
          <div className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium ${record.bdApprovedAt ? 'bg-green-50 text-green-800' : 'bg-gray-50 text-gray-400'}`}>
            {record.bdApprovedAt ? '✓ BD approved' : '○ Awaiting BD'}
          </div>
        </div>
        {!isBD && record.devConfirmedAt && !record.bdApprovedAt && (
          <p className="text-xs text-gray-500 leading-snug">
            Locked while BD reviews. You can edit again if they request changes.
          </p>
        )}
      </div>

      {/* Lines by phase */}
      {Object.entries(phaseGroups).map(([phase, lines]) => {
        const phaseHours = lines.reduce((s, l) => s + l.estimatedHours, 0)
        return (
          <div key={phase} className="card overflow-hidden min-w-0">
            <div className="px-3 sm:px-4 py-2.5 bg-gray-50 border-b border-gray-100 flex justify-between items-center gap-2">
              <span className="text-sm font-semibold text-gray-700 capitalize">{phase}</span>
              <span className="text-sm text-gray-500 shrink-0 tabular-nums">{phaseHours}h</span>
            </div>

            {/* Mobile cards */}
            <div className="divide-y divide-gray-100 lg:hidden">
              {lines.map((l, i) => {
                const variance = l.actualHours ? Math.round(((l.actualHours - l.estimatedHours) / l.estimatedHours) * 100) : null
                return (
                  <div key={i} className={`px-3 py-3 space-y-1.5 ${l.riskFlag ? 'bg-amber-50/60' : ''}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-medium text-gray-900 text-sm break-words">
                          {l.riskFlag && <span className="text-amber-500 mr-1">⚠</span>}
                          {l.feature || 'Untitled'}
                        </div>
                        {l.description ? (
                          <p className="text-xs text-gray-500 mt-0.5 break-words">{l.description}</p>
                        ) : null}
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="text-sm font-semibold text-gray-900 tabular-nums">{l.estimatedHours}h</div>
                        <div className={`text-[11px] capitalize ${l.complexityLevel === 'complex' ? 'text-red-600' : l.complexityLevel === 'simple' ? 'text-green-700' : 'text-gray-400'}`}>
                          {l.complexityLevel}
                        </div>
                      </div>
                    </div>
                    {showActualCols && (
                      <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                        <div>
                          <span className="text-gray-400">Actual </span>
                          <span className={`font-medium ${l.actualHours ? variance && variance > 30 ? 'text-red-600' : 'text-green-700' : 'text-gray-300'}`}>
                            {l.actualHours ? `${l.actualHours}h` : '—'}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-400">Var. </span>
                          <span className={`font-semibold ${variance == null ? 'text-gray-300' : variance > 30 ? 'text-red-600' : variance > 0 ? 'text-amber-700' : 'text-green-700'}`}>
                            {variance != null ? `${variance > 0 ? '+' : ''}${variance}%` : '—'}
                          </span>
                        </div>
                      </div>
                    )}
                    {(l.riskNote || l.assumptions) && (
                      <div className="text-xs text-gray-500 space-y-0.5">
                        {l.riskNote && <div className="text-amber-700">⚠ {l.riskNote}</div>}
                        {l.assumptions && <div>{l.assumptions}</div>}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Desktop table */}
            <div className="overflow-x-auto hidden lg:block">
              <table className="w-full text-sm min-w-[520px]">
                <thead>
                  <tr className="text-xs text-gray-400 uppercase tracking-wide border-b border-gray-50">
                    <th className="text-left px-4 py-2 font-medium">Feature</th>
                    <th className="text-left px-4 py-2 font-medium">Description</th>
                    <th className="text-center px-3 py-2 font-medium">Est.</th>
                    {showActualCols && (
                      <>
                        <th className="text-center px-3 py-2 font-medium">Actual</th>
                        <th className="text-center px-3 py-2 font-medium">Variance</th>
                      </>
                    )}
                    <th className="text-left px-3 py-2 font-medium">Complexity</th>
                    <th className="text-left px-3 py-2 font-medium">Risks / Assumptions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {lines.map((l, i) => {
                    const variance = l.actualHours ? Math.round(((l.actualHours - l.estimatedHours) / l.estimatedHours) * 100) : null
                    return (
                      <tr key={i} className={l.riskFlag ? 'bg-amber-50' : ''}>
                        <td className="px-4 py-2 font-medium text-gray-800">
                          {l.riskFlag && <span className="text-amber-500 mr-1">⚠</span>}
                          {l.feature}
                        </td>
                        <td className="px-4 py-2 text-gray-500 text-xs">{l.description || '—'}</td>
                        <td className="px-3 py-2 text-center font-medium tabular-nums">{l.estimatedHours}h</td>
                        {showActualCols && (
                          <>
                            <td className={`px-3 py-2 text-center font-medium ${l.actualHours ? variance && variance > 30 ? 'text-red-600' : 'text-green-700' : 'text-gray-300'}`}>
                              {l.actualHours ? `${l.actualHours}h` : '—'}
                            </td>
                            <td className={`px-3 py-2 text-center text-xs font-semibold ${variance == null ? 'text-gray-300' : variance > 30 ? 'text-red-600' : variance > 0 ? 'text-amber-700' : 'text-green-700'}`}>
                              {variance != null ? `${variance > 0 ? '+' : ''}${variance}%` : '—'}
                            </td>
                          </>
                        )}
                        <td className={`px-3 py-2 text-xs capitalize ${l.complexityLevel === 'complex' ? 'text-red-600' : l.complexityLevel === 'simple' ? 'text-green-700' : 'text-gray-500'}`}>
                          {l.complexityLevel}
                        </td>
                        <td className="px-3 py-2 text-xs text-gray-400 max-w-xs">
                          {l.riskNote && <div className="text-amber-700">⚠ {l.riskNote}</div>}
                          {l.assumptions && <div>{l.assumptions}</div>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )
      })}

      {/* Assumptions & Exclusions */}
      {(record.assumptions || record.exclusions) && (
        <div className="card p-3 sm:p-4 space-y-2 text-sm">
          {record.assumptions && (
            <div className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-x-3 items-baseline">
              <span className="text-xs text-gray-500 font-medium">Assumptions</span>
              <p className="text-gray-800 break-words">{record.assumptions}</p>
            </div>
          )}
          {record.exclusions && (
            <div className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-x-3 items-baseline">
              <span className="text-xs text-gray-500 font-medium">Exclusions</span>
              <p className="text-gray-800 break-words">{record.exclusions}</p>
            </div>
          )}
        </div>
      )}

      {/* Actual vs estimated summary (post-delivery) */}
      {showActualCols && (
        <div className={`card p-4 ${totalActual > record.totalHoursFinal ? 'bg-red-50 border-red-100' : 'bg-green-50 border-green-100'}`}>
          <div className="text-sm font-semibold mb-2">Post-delivery accuracy</div>
          <div className="grid grid-cols-1 sm:flex sm:gap-8 gap-2 text-sm">
            <div><span className="text-gray-500">Estimated:</span> <strong>{record.totalHoursFinal}h</strong></div>
            <div><span className="text-gray-500">Actual:</span> <strong className={totalActual > record.totalHoursFinal ? 'text-red-600' : 'text-green-700'}>{totalActual}h</strong></div>
            <div><span className="text-gray-500">Accuracy:</span> <strong className={totalActual > record.totalHoursFinal * 1.2 ? 'text-red-600' : 'text-green-700'}>
              {Math.round((totalActual / record.totalHoursFinal) * 100)}%
            </strong></div>
          </div>
        </div>
      )}

      {/* BD actions - Only visible to BD/Founder/Both */}
      {!record.bdApprovedAt && isBD && (
        <div className="card p-4 min-w-0">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">BD review actions</h3>
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
            <button type="button" onClick={approve} disabled={loading || !record.devConfirmedAt} className="btn-primary">
              {loading ? '...' : '✓ Approve — ready to quote'}
            </button>
            <button type="button" onClick={() => setShowRevision(true)} className="btn-secondary text-xs">
              Send back for revision
            </button>
          </div>
          {!record.devConfirmedAt && <p className="text-xs text-amber-600 mt-2">Waiting for developer to confirm the estimate first.</p>}
          {showRevision && (
            <div className="mt-3 space-y-2">
              <textarea rows={3} className="input text-sm" value={revisionNote} onChange={e => setRevisionNote(e.target.value)}
                placeholder="What needs to change? Be specific — the developer will see this." />
              <div className="flex flex-col-reverse sm:flex-row gap-2">
                <button type="button" onClick={() => setShowRevision(false)} className="btn-secondary text-xs">Cancel</button>
                <button type="button" onClick={sendRevision} disabled={loading || !revisionNote} className="btn-primary text-xs">Send revision request</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
