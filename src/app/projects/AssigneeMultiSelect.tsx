'use client'

import { useEffect, useId, useRef, useState } from 'react'

type Member = { id: string; name: string; role?: string }

export default function AssigneeMultiSelect({
  members,
  selectedIds,
  name = 'developerIds',
  defaultOpen = false,
}: {
  members: Member[]
  selectedIds: string[]
  name?: string
  defaultOpen?: boolean
}) {
  const [ids, setIds] = useState(selectedIds)
  const [open, setOpen] = useState(defaultOpen)
  const rootRef = useRef<HTMLDivElement>(null)
  const listId = useId()

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [])

  function toggle(id: string) {
    setIds(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]))
  }

  const selected = members.filter(m => ids.includes(m.id))
  const summary =
    selected.length === 0
      ? 'Select people…'
      : selected.length <= 2
        ? selected.map(m => m.name).join(', ')
        : `${selected[0].name}, ${selected[1].name} +${selected.length - 2}`

  return (
    <div ref={rootRef} className="relative">
      {ids.map(id => (
        <input key={id} type="hidden" name={name} value={id} />
      ))}
      <button
        type="button"
        className="input flex items-center gap-2 text-left bg-white"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={listId}
        onClick={() => setOpen(v => !v)}
      >
        <span className={`flex-1 truncate ${selected.length === 0 ? 'text-gray-400' : 'text-gray-900'}`}>
          {summary}
        </span>
        <svg
          className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
            clipRule="evenodd"
          />
        </svg>
      </button>
      {open ? (
        <ul
          id={listId}
          role="listbox"
          aria-multiselectable="true"
          className="absolute z-20 mt-1 w-full max-h-56 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg py-1"
        >
          {members.map(m => {
            const checked = ids.includes(m.id)
            return (
              <li key={m.id} role="option" aria-selected={checked}>
                <button
                  type="button"
                  className={`flex w-full items-center gap-2.5 px-3 py-2 text-sm text-left ${
                    checked ? 'bg-slate-50' : 'hover:bg-gray-50'
                  }`}
                  onClick={() => toggle(m.id)}
                >
                  <span
                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                      checked ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-300 bg-white'
                    }`}
                    aria-hidden="true"
                  >
                    {checked ? (
                      <svg className="h-3 w-3" viewBox="0 0 12 12" fill="none">
                        <path d="M2.5 6.2L4.7 8.4L9.5 3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    ) : null}
                  </span>
                  <span className="text-gray-900">{m.name}</span>
                  {m.role ? <span className="text-xs text-gray-400">{m.role}</span> : null}
                </button>
              </li>
            )
          })}
        </ul>
      ) : null}
      {ids.length === 0 ? (
        <p className="mt-1 text-xs text-amber-700">Select at least one person.</p>
      ) : (
        <p className="mt-1 text-xs text-gray-500">{ids.length} selected</p>
      )}
    </div>
  )
}
