'use client'

import { useEffect, useState } from 'react'
import {
  decimalHoursToParts,
  formatHoursAmount,
  parseHoursInput,
  partsToHoursInputString,
} from '@/lib/validation'

/** Show duration as H:MM (e.g. 1:30, 0:15). */
export function formatDurationHm(raw: unknown): string {
  const parts = decimalHoursToParts(raw)
  if (parts.hours === 0 && parts.minutes === 0) {
    const parsed = parseHoursInput(raw)
    if (!parsed.ok || parsed.value == null || parsed.value <= 0) return ''
  }
  return `${parts.hours}:${String(parts.minutes).padStart(2, '0')}`
}

/**
 * Single HH:MM duration field (e.g. 1:30).
 * Parent still stores decimal hours as a string for the API.
 */
export default function HoursMinutesFields({
  value,
  onChange,
  label = 'Duration',
  required = false,
  id,
  disabled = false,
}: {
  /** Decimal hours string, e.g. "1.5" or "" */
  value: string
  onChange: (decimalHoursString: string) => void
  label?: string
  required?: boolean
  id?: string
  disabled?: boolean
}) {
  const [text, setText] = useState(() => formatDurationHm(value))
  const [focused, setFocused] = useState(false)

  // Keep display in sync when parent value changes (e.g. edit existing plan)
  useEffect(() => {
    if (!focused) setText(formatDurationHm(value))
  }, [value, focused])

  function commit(raw: string) {
    const trimmed = raw.trim()
    if (!trimmed) {
      onChange('')
      setText('')
      return
    }

    // Prefer HH:MM; also allow decimals / 30m via shared parser
    const parsed = parseHoursInput(trimmed, { label: label.replace(/\s*\*$/, ''), minExclusive: 0 })
    if (!parsed.ok || parsed.value == null) {
      // Keep typed text so user can fix; don't wipe parent yet
      return
    }

    const asDecimal = formatHoursAmount(parsed.value)
    onChange(asDecimal)
    setText(formatDurationHm(asDecimal))
  }

  return (
    <div>
      <label className="label" htmlFor={id}>
        {label}
        {required ? ' *' : ''}
      </label>
      <div className="relative">
        <input
          id={id}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          disabled={disabled}
          required={required}
          value={text}
          placeholder="1:30"
          aria-describedby={id ? `${id}-hint` : undefined}
          onFocus={() => setFocused(true)}
          onChange={e => {
            const next = e.target.value
            setText(next)
            // Live-update parent when input looks valid so day load stays current
            const parsed = parseHoursInput(next.trim(), { minExclusive: 0 })
            if (parsed.ok && parsed.value != null) {
              onChange(formatHoursAmount(parsed.value))
            } else if (!next.trim()) {
              onChange('')
            }
          }}
          onBlur={() => {
            setFocused(false)
            commit(text)
          }}
          className="input tabular-nums tracking-wide"
        />
      </div>
      <p id={id ? `${id}-hint` : undefined} className="text-[11px] text-gray-400 mt-1">
        Use <span className="font-medium text-gray-500">H:MM</span> — e.g. 1:30 = 1h 30m · 0:15 = 15m
      </p>
    </div>
  )
}

// Keep export path used if something imported the old helper name
export { partsToHoursInputString }
