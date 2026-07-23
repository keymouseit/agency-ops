import Link from 'next/link'
import { fmtDate } from '@/lib/utils'

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

  if (latestCycle?.result === 'fail') {
    return (
      <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl">
        <div className="text-sm font-semibold text-red-800">⛔ QA release blocked</div>
        {latestCycle.blockerNote && (
          <p className="text-sm text-red-700 mt-1 whitespace-pre-wrap">{latestCycle.blockerNote}</p>
        )}
        <p className="text-xs text-red-500 mt-2">QA is resolving blockers before sign-off.</p>
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
