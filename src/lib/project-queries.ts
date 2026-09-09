import { prisma } from '@/lib/prisma'
import { serializeMilestoneBug } from '@/lib/milestone-bugs'

export const projectDetailInclude = {
  developer: true,
  bdMember: true,
  assignees: { include: { member: { select: { id: true, name: true } } } },
  lead: { select: { id: true, clientName: true, source: true } },
  milestones: { orderBy: { dueDate: 'asc' as const } },
  scopeChanges: { include: { approvedBy: true }, orderBy: { createdAt: 'desc' as const } },
  checkIns: { include: { submittedBy: true }, orderBy: { weekOf: 'desc' as const }, take: 8 },
  postMortem: true,
  releaseSignOff: { include: { signedOffBy: true } },
  testCycles: {
    orderBy: { startedAt: 'desc' as const },
    include: { conductedBy: true, signOff: { include: { signedOffBy: true } } },
  },
  postDeliveryIssues: { orderBy: { reportedAt: 'desc' as const } },
} as const

export const qaProjectInclude = {
  developer: true,
  milestones: { orderBy: { dueDate: 'asc' as const } },
  testCycles: {
    orderBy: { startedAt: 'desc' as const },
    include: { conductedBy: true, signOff: { include: { signedOffBy: true } } },
  },
  releaseSignOff: { include: { signedOffBy: true } },
  postDeliveryIssues: { orderBy: { reportedAt: 'desc' as const } },
} as const

type MilestoneTestCaseRow = Awaited<ReturnType<typeof fetchMilestoneTestCasesForProject>>[number]
type MilestoneBugRow = Awaited<ReturnType<typeof fetchMilestoneBugsForProject>>[number]
type TestCycleCaseRow = Awaited<ReturnType<typeof fetchTestCycleCasesForProject>>[number]

export async function fetchMilestoneTestCasesForProject(projectId: string) {
  return prisma.milestoneTestCase.findMany({
    where: { milestone: { projectId } },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    include: { testedBy: { select: { name: true } } },
  })
}

export async function fetchMilestoneBugsForProject(projectId: string) {
  return prisma.milestoneBug.findMany({
    where: { milestone: { projectId } },
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    include: { reportedBy: { select: { name: true } } },
  })
}

export async function fetchTestCycleCasesForProject(projectId: string) {
  return prisma.testCycleCase.findMany({
    where: { testCycle: { projectId } },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    include: {
      devFixedBy: { select: { name: true } },
      qaRetestedBy: { select: { name: true } },
    },
  })
}

function groupByTestCycleId<T extends { testCycleId: string }>(rows: T[]) {
  const map = new Map<string, T[]>()
  for (const row of rows) {
    const list = map.get(row.testCycleId) ?? []
    list.push(row)
    map.set(row.testCycleId, list)
  }
  return map
}

export function attachCasesToTestCycles<T extends { id: string }>(
  cycles: T[],
  cases: TestCycleCaseRow[],
) {
  const byCycle = groupByTestCycleId(cases)
  return cycles.map(c => ({
    ...c,
    cases: (byCycle.get(c.id) ?? []).map(serializeTestCycleCase),
  }))
}

function groupByMilestoneId<T extends { milestoneId: string }>(rows: T[]) {
  const map = new Map<string, T[]>()
  for (const row of rows) {
    const list = map.get(row.milestoneId) ?? []
    list.push(row)
    map.set(row.milestoneId, list)
  }
  return map
}

export function attachTestingDataToMilestones<T extends { id: string }>(
  milestones: T[],
  testCases: MilestoneTestCaseRow[],
  bugs: MilestoneBugRow[],
) {
  const testCasesByMilestone = groupByMilestoneId(testCases)
  const bugsByMilestone = groupByMilestoneId(bugs)
  return milestones.map(m => ({
    ...m,
    testCases: testCasesByMilestone.get(m.id) ?? [],
    bugs: bugsByMilestone.get(m.id) ?? [],
  }))
}

export function attachTestCasesToMilestones<
  T extends { id: string },
>(milestones: T[], testCases: MilestoneTestCaseRow[]) {
  const byMilestone = groupByMilestoneId(testCases)
  return milestones.map(m => ({
    ...m,
    testCases: byMilestone.get(m.id) ?? [],
  }))
}

export async function fetchProjectForDetailPage(projectId: string) {
  const [project, testCases, bugs, cycleCases] = await Promise.all([
    prisma.project.findUnique({
      where: { id: projectId },
      include: projectDetailInclude,
    }),
    fetchMilestoneTestCasesForProject(projectId),
    fetchMilestoneBugsForProject(projectId),
    fetchTestCycleCasesForProject(projectId),
  ])

  if (!project) return null

  return {
    ...project,
    milestones: attachTestingDataToMilestones(project.milestones, testCases, bugs),
    testCycles: attachCasesToTestCycles(project.testCycles, cycleCases),
  }
}

export async function fetchProjectForQAPage(projectId: string) {
  const [project, testCases, bugs, cycleCases] = await Promise.all([
    prisma.project.findUnique({
      where: { id: projectId },
      include: qaProjectInclude,
    }),
    fetchMilestoneTestCasesForProject(projectId),
    fetchMilestoneBugsForProject(projectId),
    fetchTestCycleCasesForProject(projectId),
  ])

  if (!project) return null

  return {
    ...project,
    milestones: attachTestingDataToMilestones(project.milestones, testCases, bugs),
    testCycles: attachCasesToTestCycles(project.testCycles, cycleCases),
  }
}

export function serializeMilestoneTestCase(tc: MilestoneTestCaseRow) {
  return {
    id: tc.id,
    title: tc.title,
    status: tc.status,
    notes: tc.notes,
    testedAt: tc.testedAt?.toISOString() ?? null,
    testedBy: tc.testedBy ? { name: tc.testedBy.name } : null,
  }
}

export function serializeTestCycleCase(tc: TestCycleCaseRow) {
  return {
    id: tc.id,
    title: tc.title,
    status: tc.status,
    notes: tc.notes,
    devFixedAt: tc.devFixedAt?.toISOString() ?? null,
    devFixNotes: tc.devFixNotes,
    devFixedBy: tc.devFixedBy ? { name: tc.devFixedBy.name } : null,
    qaRetestedAt: tc.qaRetestedAt?.toISOString() ?? null,
    qaRetestNotes: tc.qaRetestNotes,
    qaRetestedBy: tc.qaRetestedBy ? { name: tc.qaRetestedBy.name } : null,
  }
}

export { serializeMilestoneBug }
