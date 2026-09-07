import Link from 'next/link'
import CampaignForm from '../CampaignForm'

export const dynamic = 'force-dynamic'

export default function NewCampaignPage() {
  return (
    <div className="w-full">
      <div className="text-xs text-gray-400 mb-4">
        ← <Link href="/campaigns" className="hover:text-gray-700">Campaigns</Link>
      </div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">New campaign</h1>
        <p className="text-sm text-gray-500 mt-0.5">Track LinkedIn outreach and calls that come from it.</p>
      </div>
      <CampaignForm />
    </div>
  )
}
