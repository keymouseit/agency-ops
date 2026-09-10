'use client'

import { useMemo, useState } from 'react'
import ProjectListCard, { type ProjectListCardProject } from './ProjectListCard'

type Section = {
  id: string
  title: string
  projects: ProjectListCardProject[]
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
  const q = query.trim().toLowerCase()

  const current = sections.find(section => section.id === tab) ?? sections[0]
  const visible = useMemo(() => {
    const projects = current?.projects ?? []
    if (!q) return projects
    return projects.filter(project => {
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
  }, [current, q])

  return (
    <div>
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 mb-5">
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
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M10.5 18a7.5 7.5 0 100-15 7.5 7.5 0 000 15z" />
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

      {visible.length === 0 ? (
        <div className="rounded-2xl border border-gray-200 bg-white py-16 text-center shadow-sm">
          <p className="text-sm font-medium text-gray-700">
            {q ? 'No matching projects' : `No ${current?.title.toLowerCase() ?? 'projects'} yet`}
          </p>
          <p className="text-sm text-gray-400 mt-1">
            {q ? 'Try a different name, client, or teammate.' : 'Projects in this status will show up here.'}
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
