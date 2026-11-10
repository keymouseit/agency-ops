'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'

/**
 * An employee's name that links to their detail page when the viewer may open it;
 * otherwise plain text. Decide `canLink` with canViewMemberDetail() from
 * '@/lib/team-permissions'. Clicks don't bubble to clickable parent cards/rows.
 */
export default function MemberNameLink({
  memberId,
  name,
  canLink,
  className = '',
  children,
  title,
}: {
  memberId: string | null | undefined
  name: string
  canLink: boolean
  className?: string
  /** Optional custom content (defaults to `name`). */
  children?: ReactNode
  title?: string
}) {
  const content = children ?? name
  if (!canLink || !memberId) {
    return <span className={className} title={title}>{content}</span>
  }
  return (
    <Link
      href={`/settings/team/${memberId}`}
      className={`${className} cursor-pointer hover:text-blue-700 hover:underline underline-offset-2 decoration-blue-300 transition-colors`}
      title={title ?? `Open ${name}'s profile`}
      onClick={e => e.stopPropagation()}
      onKeyDown={e => e.stopPropagation()}
    >
      {content}
    </Link>
  )
}
