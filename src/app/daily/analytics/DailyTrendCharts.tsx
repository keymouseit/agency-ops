'use client'

import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  BarChart,
} from 'recharts'

export type TrendPoint = {
  label: string
  plans: number
  eods: number
  team: number
  tasks: number
  done: number
}

export type MemberTrend = {
  name: string
  tasks: number
  plans: number
}

export default function DailyTrendCharts({
  daily,
  members,
}: {
  daily: TrendPoint[]
  members: MemberTrend[]
}) {
  return (
    <div className="grid lg:grid-cols-2 gap-4 mb-6">
      <div className="card p-5">
        <h2 className="text-sm font-semibold text-gray-900 mb-1">Daily submission trend</h2>
        <p className="text-xs text-gray-400 mb-4">Plans and EODs submitted vs team size (last 30 days)</p>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={daily} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#9ca3af' }} interval="preserveStartEnd" />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#9ca3af' }} />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="plans" name="Plans" fill="#111827" radius={[4, 4, 0, 0]} maxBarSize={18} />
              <Line type="monotone" dataKey="eods" name="EODs" stroke="#059669" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="team" name="Team" stroke="#d1d5db" strokeWidth={1.5} strokeDasharray="4 4" dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card p-5">
        <h2 className="text-sm font-semibold text-gray-900 mb-1">Task trend</h2>
        <p className="text-xs text-gray-400 mb-4">Tasks planned vs completed each day</p>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={daily} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#9ca3af' }} interval="preserveStartEnd" />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#9ca3af' }} />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="tasks" name="Planned" fill="#93c5fd" radius={[4, 4, 0, 0]} maxBarSize={18} />
              <Line type="monotone" dataKey="done" name="Done" stroke="#2563eb" strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card p-5 lg:col-span-2">
        <h2 className="text-sm font-semibold text-gray-900 mb-1">Who is adding tasks</h2>
        <p className="text-xs text-gray-400 mb-4">Tasks logged per person over the last 30 days</p>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={members} margin={{ top: 8, right: 8, left: -8, bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#6b7280' }} interval={0} angle={-30} textAnchor="end" height={60} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#9ca3af' }} />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="tasks" name="Tasks" fill="#111827" radius={[4, 4, 0, 0]} maxBarSize={28} />
              <Bar dataKey="plans" name="Plan days" fill="#9ca3af" radius={[4, 4, 0, 0]} maxBarSize={28} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
