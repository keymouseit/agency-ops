import { prisma } from '@/lib/prisma'
import { ROLES } from '@/lib/utils'
import {
  DAILY_TASK_TYPE_GROUPS,
  ROLE_TASK_GROUP_LABELS,
  groupsForRoleFromMap,
  slugFromTaskTypeLabel,
  type TaskTypeGroup,
} from '@/lib/daily-task-type-defaults'

export type DailyTaskTypeRecord = {
  value: string
  label: string
  groupLabel: string
  roles: string[]
}

function toGroupsByRole(types: DailyTaskTypeRecord[]): Record<string, TaskTypeGroup[]> {
  const map: Record<string, TaskTypeGroup[]> = {}
  for (const role of ROLES) {
    const forRole = types.filter(type => type.roles.includes(role))
    const groups = new Map<string, TaskTypeGroup>()
    for (const type of forRole) {
      const group = groups.get(type.groupLabel) ?? { label: type.groupLabel, types: [] }
      group.types.push({ value: type.value, label: type.label })
      groups.set(type.groupLabel, group)
    }
    map[role] = [...groups.values()]
  }
  return map
}

export async function ensureDailyTaskTypeDefaults() {
  const count = await prisma.dailyTaskTypeOption.count()
  if (count > 0) return

  let sortOrder = 0
  const creates = DAILY_TASK_TYPE_GROUPS.flatMap(group => {
    const roles = ROLES.filter(role => (ROLE_TASK_GROUP_LABELS[role] ?? []).includes(group.label))
    return group.types.map(type =>
      prisma.dailyTaskTypeOption.create({
        data: {
          value: type.value,
          label: type.label,
          groupLabel: group.label,
          sortOrder: sortOrder++,
          roles: { create: roles.map(role => ({ role })) },
        },
      }),
    )
  })
  await prisma.$transaction(creates)
}

export async function listDailyTaskTypes(): Promise<DailyTaskTypeRecord[]> {
  try {
    await ensureDailyTaskTypeDefaults()
    const rows = await prisma.dailyTaskTypeOption.findMany({
      include: { roles: { select: { role: true } } },
      orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }],
    })
    return rows.map(row => ({
      value: row.value,
      label: row.label,
      groupLabel: row.groupLabel,
      roles: row.roles.map(item => item.role),
    }))
  } catch (error) {
    console.error('Failed to list daily task types:', error)
    return DAILY_TASK_TYPE_GROUPS.flatMap(group =>
      group.types.map(type => ({
        value: type.value,
        label: type.label,
        groupLabel: group.label,
        roles: ROLES.filter(role => (ROLE_TASK_GROUP_LABELS[role] ?? []).includes(group.label)),
      })),
    )
  }
}

export async function getDailyTaskTypeCatalog() {
  const types = await listDailyTaskTypes()
  return {
    types,
    groupsByRole: toGroupsByRole(types),
    groupLabels: [...new Set(types.map(type => type.groupLabel))],
  }
}

export async function addDailyTaskTypeToRole(input: {
  role: string
  label: string
  groupLabel: string
  value?: string
}) {
  if (!ROLES.includes(input.role as (typeof ROLES)[number])) {
    throw Object.assign(new Error('Unknown role'), { status: 400 })
  }
  const label = input.label.trim()
  const groupLabel = input.groupLabel.trim()
  if (!label || !groupLabel) {
    throw Object.assign(new Error('Label and group are required'), { status: 400 })
  }
  const value = (input.value?.trim() || slugFromTaskTypeLabel(label)).toLowerCase()
  if (!value) {
    throw Object.assign(new Error('Could not create a type key from that label'), { status: 400 })
  }

  const existing = await prisma.dailyTaskTypeOption.findUnique({
    where: { value },
    include: { roles: { select: { role: true } } },
  })

  if (existing) {
    if (!existing.roles.some(item => item.role === input.role)) {
      await prisma.dailyTaskTypeRoleAccess.create({
        data: { typeId: existing.id, role: input.role },
      })
    }
  } else {
    const maxSort = await prisma.dailyTaskTypeOption.aggregate({ _max: { sortOrder: true } })
    await prisma.dailyTaskTypeOption.create({
      data: {
        value,
        label,
        groupLabel,
        sortOrder: (maxSort._max.sortOrder ?? 0) + 1,
        roles: { create: { role: input.role } },
      },
    })
  }

  return getDailyTaskTypeCatalog()
}

export async function removeDailyTaskTypeFromRole(value: string, role: string) {
  const existing = await prisma.dailyTaskTypeOption.findUnique({
    where: { value },
    include: { roles: true },
  })
  if (!existing) return getDailyTaskTypeCatalog()

  await prisma.dailyTaskTypeRoleAccess.deleteMany({
    where: { typeId: existing.id, role },
  })

  const remaining = await prisma.dailyTaskTypeRoleAccess.count({ where: { typeId: existing.id } })
  if (remaining === 0) {
    await prisma.dailyTaskTypeOption.delete({ where: { id: existing.id } })
  }

  return getDailyTaskTypeCatalog()
}

export { groupsForRoleFromMap }
