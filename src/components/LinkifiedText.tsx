'use client'

import type { ReactNode } from 'react'

/** Match http(s) URLs; trailing punctuation is stripped when linking. */
const URL_RE = /https?:\/\/[^\s<>"'\)\]]+/gi

function stripTrailingPunct(raw: string): { href: string; trailing: string } {
  const m = raw.match(/^(.*?)([.,;:!?)\]}'"]*)$/)
  if (!m) return { href: raw, trailing: '' }
  return { href: m[1], trailing: m[2] }
}

/** e.g. docs.google.com/document/… */
export function shortenUrl(href: string): string {
  try {
    const u = new URL(href)
    const segs = u.pathname.split('/').filter(Boolean)
    if (segs.length === 0) return u.hostname
    if (segs.length === 1) {
      const seg = segs[0].length > 28 ? `${segs[0].slice(0, 26)}…` : segs[0]
      return `${u.hostname}/${seg}`
    }
    return `${u.hostname}/${segs[0]}/…`
  } catch {
    return href.length > 36 ? `${href.slice(0, 34)}…` : href
  }
}

/**
 * Render plain text with http(s) URLs turned into short external links.
 * No dependency — regex only.
 */
export default function LinkifiedText({
  text,
  className,
}: {
  text: string
  className?: string
}) {
  if (!text) return null

  const parts: ReactNode[] = []
  let last = 0
  let key = 0
  const re = new RegExp(URL_RE.source, 'gi')
  let match: RegExpExecArray | null

  while ((match = re.exec(text)) !== null) {
    if (match.index > last) {
      parts.push(text.slice(last, match.index))
    }
    const { href, trailing } = stripTrailingPunct(match[0])
    if (href) {
      parts.push(
        <a
          key={`u-${key++}`}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          title={href}
          className="text-blue-600 hover:underline break-all"
          onClick={e => e.stopPropagation()}
        >
          {shortenUrl(href)}
        </a>,
      )
    }
    if (trailing) parts.push(trailing)
    last = match.index + match[0].length
  }

  if (last < text.length) parts.push(text.slice(last))

  return (
    <span className={`whitespace-normal break-words [overflow-wrap:anywhere] ${className ?? ''}`}>
      {parts.length > 0 ? parts : text}
    </span>
  )
}
