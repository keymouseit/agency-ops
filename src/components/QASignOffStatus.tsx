import Link from 'next/link'
import { fmtDate } from '@/lib/utils'
import { isBlockingCycleResult } from '@/lib/qa'

type SignOff = {
  signedOffAt: Date | string
  signedOffBy: { name: string }
  qualityScore?: number | null
  releaseNotes?: string | null
}

type TestCycle = {
  result: string
  blockerNote?: string | null
}

export function QASignOffBadge({ signed }: { signed: boolean }) {
  if (!signed) return null
  return (
    <span className="badge bg-green-100 text-green-800">✓ QA signed off</span>
  )
}

export default function QASignOffStatus({
  projectId,
  projectStatus,
  signOff,
  latestCycle,
  showQALink = false,
}: {
  projectId: string
  projectStatus: string
  signOff: SignOff | null
  latestCycle?: TestCycle | null
  showQALink?: boolean
}) {
  const hasSignOff = !!signOff
  const inQA = projectStatus === 'qa' || projectStatus === 'delivered'
  const canSignOff = latestCycle?.result === 'pass' || latestCycle?.result === 'conditional'

  if (!hasSignOff && !inQA) return null

  if (hasSignOff) {
    return (
      <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-xl">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-sm font-semibold text-green-800">
              ✓ Released — QA sign-off complete
            </div>
            <div className="text-xs text-green-600 mt-0.5">
              Signed off by {signOff.signedOffBy.name} on {fmtDate(signOff.signedOffAt)}
              {signOff.qualityScore != null && ` · Quality score: ${signOff.qualityScore}/10`}
            </div>
            {signOff.releaseNotes && (
              <p className="text-xs text-green-700 mt-1">{signOff.releaseNotes}</p>
            )}
          </div>
          {showQALink && (
            <Link href={`/qa/${projectId}`} className="text-xs text-green-700 hover:underline flex-shrink-0">
              QA details →
            </Link>
          )}
        </div>
      </div>
    )
  }

  if (isBlockingCycleResult(latestCycle?.result ?? '')) {
    const blocked = latestCycle?.result === 'blocked'
    return (
      <div className={`mb-4 p-4 rounded-xl border ${
        blocked ? 'bg-orange-50 border-orange-200' : 'bg-red-50 border-red-200'
      }`}>
        <div className={`text-sm font-semibold ${blocked ? 'text-orange-800' : 'text-red-800'}`}>
          {blocked ? '⊘ QA testing or release blocked' : '✕ QA test cycle failed'}
        </div>
        {latestCycle?.blockerNote && (
          <p className={`text-sm mt-1 whitespace-pre-wrap ${blocked ? 'text-orange-700' : 'text-red-700'}`}>
            {latestCycle.blockerNote}
          </p>
        )}
        <p className={`text-xs mt-2 ${blocked ? 'text-orange-500' : 'text-red-500'}`}>
          {blocked ? 'QA is waiting on the blocker before sign-off.' : 'QA is waiting on fixes before sign-off.'}
        </p>
      </div>
    )
  }

  if (canSignOff) {
    return (
      <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-xl">
        <div className="text-sm font-semibold text-amber-800">
          ⚡ QA test passed — awaiting release sign-off
        </div>
        <p className="text-xs text-amber-600 mt-1">
          Delivery unlocks once QA submits formal sign-off.
        </p>
      </div>
    )
  }

  if (projectStatus === 'qa') {
    return (
      <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-xl">
        <div className="text-sm font-medium text-blue-800">In QA — sign-off pending</div>
        <p className="text-xs text-blue-600 mt-1">
          QA is running test cycles before release sign-off.
        </p>
      </div>
    )
  }

  return null
}
