export type TaskTypeOption = { value: string; label: string }
export type TaskTypeGroup = { label: string; types: TaskTypeOption[] }

export const DAILY_TASK_TYPE_GROUPS: TaskTypeGroup[] = [
  {
    label: 'Development',
    types: [
      { value: 'feature', label: 'Feature' },
      { value: 'bug', label: 'Bug fix' },
      { value: 'backend', label: 'Backend' },
      { value: 'review', label: 'Code review' },
      { value: 'research', label: 'Research' },
    ],
  },
  {
    label: 'BD / Sales',
    types: [
      { value: 'bd_prospecting', label: 'Prospecting' },
      { value: 'bd_outreach', label: 'Outreach & campaigns' },
      { value: 'bd_client_meeting', label: 'Client meeting / MOM' },
      { value: 'bd_proposal', label: 'Proposal writing' },
      { value: 'bd_follow_up', label: 'Follow-up' },
      { value: 'bd_pipeline', label: 'Pipeline admin' },
      { value: 'bd_estimation', label: 'Estimation' },
    ],
  },
  {
    label: 'QA',
    types: [
      { value: 'qa_testing', label: 'Test execution' },
      { value: 'qa_regression', label: 'Regression testing' },
      { value: 'qa_bug_report', label: 'Bug reporting' },
      { value: 'qa_test_cases', label: 'Test case writing' },
      { value: 'qa_signoff', label: 'Sign-off review' },
    ],
  },
  {
    label: 'HR',
    types: [
      { value: 'hr_operations', label: 'HR Operations' },
      { value: 'hr_talent_acquisition', label: 'Talent Acquisition' },
    ],
  },
  {
    label: 'Social media',
    types: [
      { value: 'social_content', label: 'Content creation' },
      { value: 'social_campaign', label: 'Campaign work' },
      { value: 'social_engagement', label: 'Engagement' },
    ],
  },
  {
    label: 'Management',
    types: [
      { value: 'mgmt_planning', label: 'Team planning' },
      { value: 'mgmt_1on1', label: '1:1s' },
      { value: 'mgmt_reviews', label: 'Reviews & scores' },
    ],
  },
  {
    label: 'Leadership',
    types: [
      { value: 'founder_strategy', label: 'Strategy' },
      { value: 'founder_ops', label: 'Business operations' },
    ],
  },
  {
    label: 'General',
    types: [
      { value: 'meeting', label: 'Meeting' },
      { value: 'admin', label: 'Admin' },
      { value: 'rnd', label: 'Research and development' },
      { value: 'discussion', label: 'Discussion' },
    ],
  },
]

export const ROLE_TASK_GROUP_LABELS: Record<string, string[]> = {
  Dev: ['Development', 'General'],
  BD: ['BD / Sales', 'General'],
  QA: ['QA', 'General'],
  HR: ['HR', 'General'],
  SocialMedia: ['Social media', 'General'],
  Manager: ['Management', 'General'],
  Founder: DAILY_TASK_TYPE_GROUPS.map(group => group.label),
  Both: ['Development', 'BD / Sales', 'General'],
}

export const DAILY_TASK_TYPES = DAILY_TASK_TYPE_GROUPS.flatMap(group => group.types)
export type DailyTaskType = string

export function dailyTaskTypeGroupsForRole(role: string, includeType?: string) {
  const allowed = ROLE_TASK_GROUP_LABELS[role] ?? ROLE_TASK_GROUP_LABELS.Dev
  const groups = DAILY_TASK_TYPE_GROUPS.filter(group => allowed.includes(group.label))
  if (!includeType) return groups
  const extraGroup = DAILY_TASK_TYPE_GROUPS.find(
    group => group.types.some(type => type.value === includeType) && !allowed.includes(group.label),
  )
  return extraGroup ? [...groups, extraGroup] : groups
}

export function groupsForRoleFromMap(
  map: Record<string, TaskTypeGroup[]>,
  role: string,
  includeType?: string,
) {
  const groups = map[role] ?? map.Dev ?? dailyTaskTypeGroupsForRole(role)
  if (!includeType) return groups
  if (groups.some(group => group.types.some(type => type.value === includeType))) return groups
  for (const list of Object.values(map)) {
    const extra = list.find(group => group.types.some(type => type.value === includeType))
    if (extra) return [...groups, extra]
  }
  return groups
}

export function defaultDailyTaskType(role: string): DailyTaskType {
  return dailyTaskTypeGroupsForRole(role)[0]?.types[0]?.value ?? 'feature'
}

export function slugFromTaskTypeLabel(label: string) {
  return label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
}
