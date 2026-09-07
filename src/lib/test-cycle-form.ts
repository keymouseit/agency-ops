import { deriveCycleResult, hasBlockedTestCases, hasFailedTestCases, hasFailingTestCases, isNonExecutableCycleResult, cycleSupportsBlockerNote } from '@/lib/qa'

export type ParsedTestCycleCase = {
  title: string
  status: string
  notes: string | null
  sortOrder: number
}

const VALID_CASE_STATUSES = ['pass', 'fail', 'blocked', 'skipped']

export function parseTestCycleCases(rawCases: unknown): ParsedTestCycleCase[] {
  if (!Array.isArray(rawCases)) return []
  return rawCases
    .filter((tc): tc is { title?: string; status?: string; notes?: string } => typeof tc === 'object' && tc !== null)
    .filter(tc => typeof tc.title === 'string' && tc.title.trim())
    .map((tc, i) => ({
      title: tc.title!.trim(),
      status: VALID_CASE_STATUSES.includes(tc.status ?? '') ? tc.status! : 'pass',
      notes: tc.notes?.trim() || null,
      sortOrder: i,
    }))
}

export function resolveCycleBlockerNote(
  result: string,
  manualBlocker: string,
  testCases: ParsedTestCycleCase[],
): string | null {
  if (!cycleSupportsBlockerNote(result)) return null

  const trimmed = manualBlocker.trim()
  if (trimmed) return trimmed

  if (result === 'fail' && hasFailedTestCases(testCases)) {
    return `Failed test cases: ${testCases
      .filter(tc => tc.status === 'fail')
      .map(tc => tc.title)
      .join(', ')}`
  }

  if (result === 'blocked' && hasBlockedTestCases(testCases)) {
    return `Blocked test cases: ${testCases
      .filter(tc => tc.status === 'blocked')
      .map(tc => tc.title)
      .join(', ')}`
  }

  return null
}

export function buildTestCycleFields(data: Record<string, unknown>, testCases: ParsedTestCycleCase[]) {
  const result = deriveCycleResult(String(data.result ?? 'pass'), testCases)
  const manualBlocker = typeof data.blockerNote === 'string' ? data.blockerNote : ''
  const blockerNote = resolveCycleBlockerNote(result, manualBlocker, testCases)

  return {
    result,
    blockerNote,
    cycleType: typeof data.cycleType === 'string' ? data.cycleType : 'pre_release',
    environment: typeof data.environment === 'string' ? data.environment : 'staging',
    conductedById: typeof data.conductedById === 'string' ? data.conductedById : '',
    testedAuth: data.testedAuth === true,
    testedCoreFlows: data.testedCoreFlows === true,
    testedEdgeCases: data.testedEdgeCases === true,
    testedMobile: data.testedMobile === true,
    testedCrossBrowser: data.testedCrossBrowser === true,
    testedPerformance: data.testedPerformance === true,
    testedIntegrations: data.testedIntegrations === true,
    testedDataIntegrity: data.testedDataIntegrity === true,
    summary: typeof data.summary === 'string' ? data.summary.trim() || null : null,
    fixedInCycle: typeof data.fixedInCycle === 'string' ? data.fixedInCycle.trim() || null : null,
  }
}

export function validateTestCyclePayload(
  fields: ReturnType<typeof buildTestCycleFields>,
  testCases: ParsedTestCycleCase[],
  options?: { requireBlockerOnFail?: boolean },
) {
  const errors: string[] = []
  if (!fields.conductedById) errors.push('Tested by is required')
  if (testCases.length === 0) errors.push('At least one test case with a name is required')
  if (options?.requireBlockerOnFail !== false) {
    if ((fields.result === 'fail' || fields.result === 'blocked' || fields.result === 'conditional') && !fields.blockerNote) {
      errors.push(
        fields.result === 'fail'
          ? 'Failure description is required'
          : fields.result === 'blocked'
          ? 'Blocker description is required'
          : 'Conditional issue description is required',
      )
    }
    if (isNonExecutableCycleResult(fields.result) && !fields.summary && !fields.blockerNote) {
      errors.push('Please add notes explaining why this cycle could not be fully executed')
    }
  }
  if (hasFailingTestCases(testCases) && fields.result === 'pass') {
    errors.push('Overall result cannot be Pass when test cases have failed or are blocked')
  }
  return errors
}
