'use client'

import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

export type SimpleSelectOption = { value: string; label: string }

type MenuPos = { top: number; left: number; width: number; maxHeight: number; openUp: boolean }

/**
 * Custom single-select (button + listbox) — avoids native <select> so
 * Android/Samsung form assist (Prev / Next) does not appear on dropdowns.
 * Menu is portaled to document.body so it is not clipped by modal overflow.
 */
export default function SimpleSelect({
  value,
  onChange,
  options,
  placeholder = 'Select…',
  disabled = false,
  required = false,
  name,
  className = '',
  'aria-label': ariaLabel,
}: {
  value: string
  onChange: (value: string) => void
  options: SimpleSelectOption[]
  placeholder?: string
  disabled?: boolean
  required?: boolean
  name?: string
  /** Extra classes merged onto the trigger button (after `.input`). */
  className?: string
  'aria-label'?: string
}) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<MenuPos | null>(null)
  const [mounted, setMounted] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const listId = useId()
  const selected = options.find(o => o.value === value)

  useEffect(() => {
    setMounted(true)
  }, [])

  function updatePos() {
    const el = btnRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const gap = 4
    const spaceBelow = window.innerHeight - r.bottom - gap - 8
    const spaceAbove = r.top - gap - 8
    const preferDown = spaceBelow >= 160 || spaceBelow >= spaceAbove
    const maxHeight = Math.max(120, Math.min(224, preferDown ? spaceBelow : spaceAbove))
    setPos({
      top: preferDown ? r.bottom + gap : r.top - gap,
      left: Math.max(8, Math.min(r.left, window.innerWidth - r.width - 8)),
      width: r.width,
      maxHeight,
      openUp: !preferDown,
    })
  }

  useLayoutEffect(() => {
    if (!open) {
      setPos(null)
      return
    }
    updatePos()
    function onReposition() {
      updatePos()
    }
    window.addEventListener('resize', onReposition)
    window.addEventListener('scroll', onReposition, true)
    return () => {
      window.removeEventListener('resize', onReposition)
      window.removeEventListener('scroll', onReposition, true)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    function onDoc(e: MouseEvent) {
      const t = e.target as Node
      if (rootRef.current?.contains(t) || listRef.current?.contains(t)) return
      setOpen(false)
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
  }, [open])

  const menu =
    open && mounted && pos
      ? createPortal(
          <ul
            ref={listRef}
            id={listId}
            role="listbox"
            className="fixed z-[300] overflow-y-auto rounded-lg border border-gray-200 bg-white py-1 shadow-xl"
            style={{
              top: pos.openUp ? undefined : pos.top,
              bottom: pos.openUp ? window.innerHeight - pos.top : undefined,
              left: pos.left,
              width: pos.width,
              maxHeight: pos.maxHeight,
            }}
          >
            {options.map(opt => {
              const active = opt.value === value
              return (
                <li key={opt.value} role="option" aria-selected={active}>
                  <button
                    type="button"
                    className={`flex w-full px-3 py-2.5 text-left text-base sm:text-sm sm:py-1.5 ${
                      active ? 'bg-blue-600 text-white' : 'text-gray-900 hover:bg-gray-50'
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
          </ul>,
          document.body,
        )
      : null

  return (
    <div ref={rootRef} className="relative min-w-0">
      {name ? <input type="hidden" name={name} value={value} required={required} /> : null}
      <button
        ref={btnRef}
        type="button"
        disabled={disabled}
        className={`input flex items-center gap-2 text-left bg-white disabled:bg-gray-50 disabled:text-gray-400 ${className}`}
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
      {menu}
    </div>
  )
}
