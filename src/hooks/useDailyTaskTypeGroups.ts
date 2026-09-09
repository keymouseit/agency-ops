'use client'

import { useEffect, useState } from 'react'
import { groupsForRoleFromMap, type TaskTypeGroup } from '@/lib/daily-task-type-defaults'

export function useDailyTaskTypeCatalog() {
  const [map, setMap] = useState<Record<string, TaskTypeGroup[]> | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/daily/task-types')
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        if (cancelled || !data?.groupsByRole) return
        setMap(data.groupsByRole)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  return map
}

export function taskTypeGroupsForRole(
  catalog: Record<string, TaskTypeGroup[]> | null,
  role: string,
  includeType?: string,
) {
  if (!catalog) return null
  return groupsForRoleFromMap(catalog, role, includeType)
}
