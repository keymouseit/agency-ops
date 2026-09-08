import type { KeyboardEvent } from 'react'

/**
 * Ensure Enter always inserts a newline in multiline fields
 * (and never submits a parent <form>).
 */
export function insertNewlineOnEnter(
  e: KeyboardEvent<HTMLTextAreaElement>,
  onChange: (next: string) => void,
) {
  if (e.key !== 'Enter' || e.nativeEvent.isComposing) return

  e.preventDefault()
  e.stopPropagation()

  const el = e.currentTarget
  const start = el.selectionStart ?? el.value.length
  const end = el.selectionEnd ?? el.value.length
  const next = `${el.value.slice(0, start)}\n${el.value.slice(end)}`
  onChange(next)

  const cursor = start + 1
  requestAnimationFrame(() => {
    el.focus()
    el.setSelectionRange(cursor, cursor)
  })
}
