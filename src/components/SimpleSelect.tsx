'use client'

import { useEffect, useId, useRef, useState } from 'react'

export type SimpleSelectOption = { value: string; label: string }

/**
 * Compact single-select sized like `.input`, with a capped scrollable menu
 * so long lists stay within modals (native <select> menus cannot be sized).
 */
export default function SimpleSelect({
  value,
  onChange,
  options,
  placeholder = 'Select…',
  disabled = false,
  required = false,
  name,
  'aria-label': ariaLabel,
}: {
  value: string
  onChange: (value: string) => void
  options: SimpleSelectOption[]
  placeholder?: string
  disabled?: boolean
  required?: boolean
  name?: string
  'aria-label'?: string
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const listId = useId()
  const selected = options.find(o => o.value === value)

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

  return (
    <div ref={rootRef} className="relative">
      {name ? <input type="hidden" name={name} value={value} required={required} /> : null}
      <button
        type="button"
        disabled={disabled}
        className="input flex items-center gap-2 text-left bg-white disabled:bg-gray-50 disabled:text-gray-400"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={listId}
        aria-label={ariaLabel}
        onClick={() => setOpen(v => !v)}
      >
        <span className={`flex-1 truncate ${selected ? 'text-gray-900' : 'text-gray-400'}`}>
          {selected?.label ?? placeholder}
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
          className="absolute left-0 right-0 z-30 mt-1 max-h-48 overflow-y-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
        >
          {options.map(opt => {
            const active = opt.value === value
            return (
              <li key={opt.value} role="option" aria-selected={active}>
                <button
                  type="button"
                  className={`flex w-full px-3 py-1.5 text-left text-sm ${
                    active
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-900 hover:bg-gray-50'
                  }`}
                  onClick={() => {
                    onChange(opt.value)
                    setOpen(false)
                  }}
                >
                  {opt.label}
                </button>
              </li>
            )
          })}
        </ul>
      ) : null}
    </div>
  )
}
