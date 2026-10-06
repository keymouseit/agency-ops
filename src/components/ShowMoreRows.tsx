'use client'

import { useState, type ReactNode } from 'react'

/** <tbody> that shows the first `initial` rows with a "Show all" toggle row. */
export default function ShowMoreRows({
  rows,
  initial,
  colSpan,
  noun = 'rows',
  className = 'divide-y divide-gray-50',
  toggleClassName = 'pt-2',
}: {
  rows: ReactNode[]
  initial: number
  colSpan: number
  noun?: string
  className?: string
  /** Classes for the toggle row's cell (e.g. padding when the table is edge-to-edge in a card). */
  toggleClassName?: string
}) {
  const [open, setOpen] = useState(false)
  const shown = open ? rows : rows.slice(0, initial)
  return (
    <tbody className={className}>
      {shown}
      {rows.length > initial && (
        <tr>
          <td colSpan={colSpan} className={toggleClassName}>
            <button
              type="button"
              onClick={() => setOpen(o => !o)}
              className="text-xs text-gray-500 hover:text-gray-900"
            >
              {open ? 'Show fewer ↑' : `Show all ${rows.length} ${noun} ↓`}
            </button>
          </td>
        </tr>
      )}
    </tbody>
  )
}
