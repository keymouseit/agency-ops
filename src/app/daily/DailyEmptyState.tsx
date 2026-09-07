import Link from 'next/link'

type Props = {
  showTeamView: boolean
  isToday: boolean
}

export default function DailyEmptyState({ showTeamView, isToday }: Props) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-gradient-to-br from-white via-white to-gray-50 p-10 sm:p-14 text-center shadow-sm">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-900 text-2xl text-white shadow-sm">
        ☀️
      </div>
      <h2 className="text-lg font-semibold text-gray-900 mb-2">
        {showTeamView ? 'No plans yet today' : 'No morning plan yet'}
      </h2>
      <p className="text-sm text-gray-500 max-w-sm mx-auto mb-6">
        {showTeamView
          ? 'Nobody on the team has submitted a morning plan for this day.'
          : "You haven't submitted a morning plan for this day. Plan your tasks before you start working."}
      </p>
      {isToday && !showTeamView && (
        <Link href="/daily/plan" className="btn-primary inline-flex items-center gap-2">
          Submit morning plan →
        </Link>
      )}
      {isToday && showTeamView && (
        <p className="text-xs text-gray-400">Team members can submit from their own daily log.</p>
      )}
    </div>
  )
}
