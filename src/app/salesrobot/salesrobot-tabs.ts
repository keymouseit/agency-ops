export const SALESROBOT_TABS = [
  { id: 'analytics', label: 'Analytics' },
  { id: 'waiting', label: 'Waiting for us' },
] as const

export type SalesRobotTabId = (typeof SALESROBOT_TABS)[number]['id']

export function resolveSalesRobotTab(tab?: string | null): SalesRobotTabId {
  return tab === 'waiting' ? 'waiting' : 'analytics'
}
