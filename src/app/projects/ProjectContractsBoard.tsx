'use client'

import { useMemo, useState } from 'react'
import { istDateInputValue } from '@/lib/ist'
import { PROJECT_STATUS_LABELS } from '@/lib/utils'
import ProjectListCard, { type ProjectListCardProject } from './ProjectListCard'

type Section = {
  id: string
  title: string
  projects: ProjectListCardProject[]
}

const ACTIVE_PHASES = ['scoping', 'active', 'qa'] as const
type ActivePhase = (typeof ACTIVE_PHASES)[number]

function isPastEndDate(project: ProjectListCardProject, todayKey: string) {
  if (!project.estimatedEnd) return false
  if (['delivered', 'cancelled'].includes(project.status)) return false
  return istDateInputValue(project.estimatedEnd) < todayKey
}

function isOverEstimate(project: ProjectListCardProject) {
  const est = project.estimatedHours
  const logged = project.actualHours
  return est != null && est > 0 && logged != null && logged > est
}

function hasOverdueMilestones(project: ProjectListCardProject, todayKey: string) {
  const list = project.milestones
  if (!list?.length) return false
  return list.some(
    m => m.dueDate && istDateInputValue(m.dueDate) < todayKey && m.status !== 'done',
  )
}

function projectPeople(project: ProjectListCardProject): string[] {
  const names = [
    project.developer.name,
    ...(project.assignees ?? []).map(a => a.member.name),
  ]
  return [...new Set(names.filter(Boolean))]
}

function FilterChip({
  label,
  active,
  onClick,
  tone = 'slate',
  count,
}: {
  label: string
  active: boolean
  onClick: () => void
  tone?: 'slate' | 'amber' | 'red' | 'sky' | 'green' | 'violet'
  count?: number
}) {
  const idle =
    'bg-white text-gray-700 ring-1 ring-gray-200 hover:bg-slate-50 hover:ring-gray-300'
  const on: Record<string, string> = {
    slate: 'bg-slate-900 text-white ring-1 ring-slate-900',
    amber: 'bg-amber-50 text-amber-900 ring-1 ring-amber-300',
    red: 'bg-red-50 text-red-800 ring-1 ring-red-300',
    sky: 'bg-sky-50 text-sky-900 ring-1 ring-sky-300',
    green: 'bg-emerald-50 text-emerald-900 ring-1 ring-emerald-300',
    violet: 'bg-violet-50 text-violet-900 ring-1 ring-violet-300',
  }
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
        active ? on[tone] : idle
      }`}
    >
      {label}
      {typeof count === 'number' ? (
        <span
          className={`tabular-nums font-bold ${
            active && tone === 'slate' ? 'text-white/80' : 'opacity-70'
          }`}
        >
          {count}
        </span>
      ) : null}
    </button>
  )
}

function RemovableChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 text-slate-800 ring-1 ring-slate-200 pl-2.5 pr-1 py-1 text-xs font-semibold">
      {label}
      <button
        type="button"
        onClick={onRemove}
        className="rounded-full p-0.5 hover:bg-slate-200 text-slate-500 hover:text-slate-800"
        aria-label={`Remove ${label}`}
      >
        <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
          <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
        </svg>
      </button>
    </span>
  )
}

export default function ProjectContractsBoard({
  sections,
  companyName,
}: {
  sections: Section[]
  companyName: string
}) {
  const [query, setQuery] = useState('')
  const [tab, setTab] = useState(sections[0]?.id ?? 'active')
  const [phases, setPhases] = useState<Set<ActivePhase>>(() => new Set())
  const [pastEndOnly, setPastEndOnly] = useState(false)
  const [overEstimateOnly, setOverEstimateOnly] = useState(false)
  const [overdueMsOnly, setOverdueMsOnly] = useState(false)
  const [employee, setEmployee] = useState('')
  const [personQuery, setPersonQuery] = useState('')
  const [personOpen, setPersonOpen] = useState(false)

  const q = query.trim().toLowerCase()
  const todayKey = useMemo(() => istDateInputValue(new Date()), [])

  const current = sections.find(section => section.id === tab) ?? sections[0]
  const showPhaseFilter = (current?.id ?? tab) === 'active'
  const pool = current?.projects ?? []

  const counts = useMemo(() => {
    const phaseCounts: Record<ActivePhase, number> = { scoping: 0, active: 0, qa: 0 }
    let past = 0
    let overEst = 0
    let overdueMs = 0
    for (const p of pool) {
      if ((ACTIVE_PHASES as readonly string[]).includes(p.status)) {
        phaseCounts[p.status as ActivePhase] += 1
      }
      if (isPastEndDate(p, todayKey)) past += 1
      if (isOverEstimate(p)) overEst += 1
      if (hasOverdueMilestones(p, todayKey)) overdueMs += 1
    }
    return { phaseCounts, past, overEst, overdueMs }
  }, [pool, todayKey])

  const employeeOptions = useMemo(() => {
    const set = new Set<string>()
    for (const project of pool) {
      for (const name of projectPeople(project)) set.add(name)
    }
    return [...set].sort((a, b) => a.localeCompare(b))
  }, [pool])

  const filteredPeople = useMemo(() => {
    const pq = personQuery.trim().toLowerCase()
    if (!pq) return employeeOptions
    return employeeOptions.filter(n => n.toLowerCase().includes(pq))
  }, [employeeOptions, personQuery])

  function togglePhase(p: ActivePhase) {
    setPhases(prev => {
      const next = new Set(prev)
      if (next.has(p)) next.delete(p)
      else next.add(p)
      return next
    })
  }

  const visible = useMemo(() => {
    let projects = pool

    if (showPhaseFilter && phases.size > 0) {
      projects = projects.filter(p => phases.has(p.status as ActivePhase))
    }
    if (pastEndOnly) projects = projects.filter(p => isPastEndDate(p, todayKey))
    if (overEstimateOnly) projects = projects.filter(p => isOverEstimate(p))
    if (overdueMsOnly) projects = projects.filter(p => hasOverdueMilestones(p, todayKey))
    if (employee) projects = projects.filter(p => projectPeople(p).includes(employee))

    if (q) {
      projects = projects.filter(project => {
        const haystack = [
          project.name,
          project.clientName,
          project.developer.name,
          project.bdMember?.name,
          ...(project.assignees ?? []).map(a => a.member.name),
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        return haystack.includes(q)
      })
    }

    return projects
  }, [
    pool,
    showPhaseFilter,
    phases,
    pastEndOnly,
    overEstimateOnly,
    overdueMsOnly,
    employee,
    q,
    todayKey,
  ])

  const activeRemovables: { key: string; label: string; clear: () => void }[] = []
  if (showPhaseFilter) {
    for (const p of ACTIVE_PHASES) {
      if (phases.has(p)) {
        activeRemovables.push({
          key: `phase-${p}`,
          label: PROJECT_STATUS_LABELS[p] ?? p,
          clear: () => togglePhase(p),
        })
      }
    }
  }
  if (pastEndOnly) {
    activeRemovables.push({
      key: 'past',
      label: 'Past end date',
      clear: () => setPastEndOnly(false),
    })
  }
  if (overEstimateOnly) {
    activeRemovables.push({
      key: 'est',
      label: 'Over estimate',
      clear: () => setOverEstimateOnly(false),
    })
  }
  if (overdueMsOnly) {
    activeRemovables.push({
      key: 'ms',
      label: 'Overdue milestones',
      clear: () => setOverdueMsOnly(false),
    })
  }
  if (employee) {
    activeRemovables.push({
      key: 'person',
      label: employee,
      clear: () => {
        setEmployee('')
        setPersonQuery('')
      },
    })
  }

  const filtersActive = activeRemovables.length > 0

  function clearAllFilters() {
    setPhases(new Set())
    setPastEndOnly(false)
    setOverEstimateOnly(false)
    setOverdueMsOnly(false)
    setEmployee('')
    setPersonQuery('')
  }

  return (
    <div>
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 mb-4">
        <div className="flex flex-wrap gap-1 border-b border-gray-200">
          {sections.map(section => {
            const active = section.id === (current?.id ?? tab)
            return (
              <button
                key={section.id}
                type="button"
                onClick={() => {
                  setTab(section.id)
                  setQuery('')
                  setPhases(new Set())
                }}
                className={`px-3 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                  active
                    ? 'border-gray-900 text-gray-900'
                    : 'border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300'
                }`}
              >
                {section.title}
                <span className={`ml-2 text-xs tabular-nums ${active ? 'text-gray-700' : 'text-gray-400'}`}>
                  {section.projects.length}
                </span>
              </button>
            )
          })}
        </div>
        <div className="relative w-full lg:w-72 shrink-0">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-4.35-4.35M10.5 18a7.5 7.5 0 100-15 7.5 7.5 0 000 15z"
              />
            </svg>
          </span>
          <input
            type="search"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={`Search ${current?.title.toLowerCase() ?? 'projects'}`}
            className="w-full rounded-full border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm text-gray-800 placeholder:text-gray-400 focus:border-gray-400 focus:outline-none"
          />
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm mb-5 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          {showPhaseFilter && (
            <>
              <FilterChip
                label="Scoping"
                tone="sky"
                active={phases.has('scoping')}
                count={counts.phaseCounts.scoping}
                onClick={() => togglePhase('scoping')}
              />
              <FilterChip
                label="Active"
                tone="green"
                active={phases.has('active')}
                count={counts.phaseCounts.active}
                onClick={() => togglePhase('active')}
              />
              <FilterChip
                label="QA"
                tone="violet"
                active={phases.has('qa')}
                count={counts.phaseCounts.qa}
                onClick={() => togglePhase('qa')}
              />
              <span className="hidden sm:inline w-px h-5 bg-gray-200 mx-0.5" aria-hidden />
            </>
          )}
          <FilterChip
            label="Past end date"
            tone="red"
            active={pastEndOnly}
            count={counts.past}
            onClick={() => setPastEndOnly(v => !v)}
          />
          <FilterChip
            label="Over estimate"
            tone="amber"
            active={overEstimateOnly}
            count={counts.overEst}
            onClick={() => setOverEstimateOnly(v => !v)}
          />
          <FilterChip
            label="Overdue milestones"
            tone="red"
            active={overdueMsOnly}
            count={counts.overdueMs}
            onClick={() => setOverdueMsOnly(v => !v)}
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[12rem] flex-1 max-w-xs">
            <label className="sr-only" htmlFor="project-person-filter">
              Filter by person
            </label>
            <input
              id="project-person-filter"
              type="text"
              role="combobox"
              aria-expanded={personOpen}
              aria-autocomplete="list"
              value={personOpen || !employee ? personQuery : employee}
              placeholder="Filter by person…"
              onFocus={() => {
                setPersonOpen(true)
                setPersonQuery(employee ? '' : personQuery)
              }}
              onChange={e => {
                setPersonQuery(e.target.value)
                setPersonOpen(true)
                if (employee) setEmployee('')
              }}
              onBlur={() => {
                // Delay so option click registers
                window.setTimeout(() => setPersonOpen(false), 150)
              }}
              className="w-full rounded-full border border-gray-200 bg-slate-50/80 py-2 px-3.5 text-sm text-gray-800 placeholder:text-gray-400 focus:border-gray-400 focus:bg-white focus:outline-none"
            />
            {personOpen && filteredPeople.length > 0 && (
              <ul
                role="listbox"
                className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-xl border border-gray-200 bg-white py-1 shadow-lg"
              >
                {filteredPeople.map(name => (
                  <li key={name} role="option" aria-selected={employee === name}>
                    <button
                      type="button"
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-50 ${
                        employee === name ? 'font-semibold text-gray-900 bg-slate-50' : 'text-gray-700'
                      }`}
                      onMouseDown={e => e.preventDefault()}
                      onClick={() => {
                        setEmployee(name)
                        setPersonQuery('')
                        setPersonOpen(false)
                      }}
                    >
                      {name}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <span className="text-xs text-gray-500 tabular-nums ml-auto shrink-0">
            <span className="font-semibold text-gray-800">{visible.length}</span> shown
            {filtersActive || q ? (
              <span className="text-gray-400"> of {pool.length}</span>
            ) : null}
          </span>
        </div>

        {filtersActive && (
          <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-gray-100">
            <span className="text-[10px] font-bold uppercase tracking-wide text-gray-400 mr-1">
              Active
            </span>
            {activeRemovables.map(f => (
              <RemovableChip key={f.key} label={f.label} onRemove={f.clear} />
            ))}
            <button
              type="button"
              className="ml-1 text-xs font-semibold text-blue-600 hover:underline"
              onClick={clearAllFilters}
            >
              Clear all
            </button>
          </div>
        )}
      </div>

      {visible.length === 0 ? (
        <div className="rounded-2xl border border-gray-200 bg-white py-16 text-center shadow-sm">
          <p className="text-sm font-medium text-gray-700">
            {q || filtersActive ? 'No matching projects' : `No ${current?.title.toLowerCase() ?? 'projects'} yet`}
          </p>
          <p className="text-sm text-gray-400 mt-1">
            {q || filtersActive
              ? 'Try clearing filters or a different search.'
              : 'Projects in this status will show up here.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map(project => (
            <ProjectListCard key={project.id} project={project} companyName={companyName} />
          ))}
        </div>
      )}
    </div>
  )
}
