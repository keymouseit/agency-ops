export type ManualBdActivityRow = {
  id: string
  personName: string
  channel: 'LinkedIn' | 'Email' | 'WhatsApp'
  newOutreach: number
  followUps: number
  replies: number
  meetingsBooked: number
}

export function parseManualBdActivityJson(raw: string | null | undefined): ManualBdActivityRow[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.map((row: Partial<ManualBdActivityRow>) => ({
      id: String(row.id || Math.random().toString(36).slice(2)),
      personName: String(row.personName || 'Unknown'),
      channel: (row.channel === 'Email' || row.channel === 'WhatsApp' ? row.channel : 'LinkedIn') as ManualBdActivityRow['channel'],
      newOutreach: Math.max(0, Number(row.newOutreach) || 0),
      followUps: Math.max(0, Number(row.followUps) || 0),
      replies: Math.max(0, Number(row.replies) || 0),
      meetingsBooked: Math.max(0, Number(row.meetingsBooked) || 0),
    }))
  } catch {
    return []
  }
}
