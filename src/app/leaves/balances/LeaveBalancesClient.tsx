'use client'

import { useState } from 'react'
import Link from 'next/link'
import toast, { Toaster } from 'react-hot-toast'

type BalanceRow = {
  memberId: string
  name: string
  email: string
  role: string
  accrued: number
  used: number
}

export default function LeaveBalancesClient({
  year,
  rows: initialRows,
}: {
  year: number
  rows: BalanceRow[]
}) {
  const [rows, setRows] = useState(
    initialRows.map(r => ({
      ...r,
      accruedInput: String(r.accrued),
      usedInput: String(r.used),
      saving: false,
    }))
  )

  async function saveRow(memberId: string) {
    const row = rows.find(r => r.memberId === memberId)
    if (!row) return

    const accrued = Number(row.accruedInput)
    const used = Number(row.usedInput)
    if (!Number.isFinite(accrued) || accrued < 0) {
      toast.error('Accrued must be a valid number ≥ 0')
      return
    }
    if (!Number.isFinite(used) || used < 0) {
      toast.error('Used must be a valid number ≥ 0')
      return
    }

    setRows(prev => prev.map(r => (r.memberId === memberId ? { ...r, saving: true } : r)))

    try {
      const res = await fetch('/api/leaves/balance', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId, year, accrued, used }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to save')

      setRows(prev =>
        prev.map(r =>
          r.memberId === memberId
            ? {
                ...r,
                accrued: data.accrued,
                used: data.used,
                accruedInput: String(data.accrued),
                usedInput: String(data.used),
                saving: false,
              }
            : r
        )
      )
      toast.success(`Updated balance for ${row.name}`)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to save'
      toast.error(msg)
      setRows(prev => prev.map(r => (r.memberId === memberId ? { ...r, saving: false } : r)))
    }
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <Toaster position="top-right" />

      <div className="mb-8">
        <div className="text-xs text-gray-400 mb-2">
          <Link href="/leaves" className="hover:text-gray-700">← Leave Management</Link>
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">Employee Leave Balances</h1>
        <p className="text-sm text-gray-500 mt-1 max-w-2xl">
          Set Accrued and Used for {year}. People who joined mid-year should have a lower Accrued
          (not 1 day for every month of the year). Saved values are kept after refresh.
          Available = Accrued − Used.
        </p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm ring-1 ring-gray-900/5 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/40 flex items-center justify-between">
          <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Active employees</h2>
          <span className="text-xs font-semibold text-gray-500">{rows.length} people · {year}</span>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider border-b border-gray-100">
                <th className="px-6 py-3">Employee</th>
                <th className="px-6 py-3">Role</th>
                <th className="px-6 py-3 w-32">Accrued</th>
                <th className="px-6 py-3 w-32">Used</th>
                <th className="px-6 py-3 w-28">Available</th>
                <th className="px-6 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {rows.map(row => {
                const accruedNum = Number(row.accruedInput)
                const usedNum = Number(row.usedInput)
                const available =
                  Number.isFinite(accruedNum) && Number.isFinite(usedNum)
                    ? Math.max(0, accruedNum - usedNum)
                    : '—'
                const dirty =
                  String(row.accrued) !== row.accruedInput || String(row.used) !== row.usedInput

                return (
                  <tr key={row.memberId} className="hover:bg-gray-50/60">
                    <td className="px-6 py-4">
                      <div className="font-semibold text-gray-900">{row.name}</div>
                      <div className="text-xs text-gray-400">{row.email}</div>
                    </td>
                    <td className="px-6 py-4 text-gray-600">{row.role}</td>
                    <td className="px-6 py-4">
                      <input
                        type="number"
                        min={0}
                        max={24}
                        step={0.25}
                        value={row.accruedInput}
                        onChange={e =>
                          setRows(prev =>
                            prev.map(r =>
                              r.memberId === row.memberId
                                ? { ...r, accruedInput: e.target.value }
                                : r
                            )
                          )
                        }
                        className="w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                      />
                    </td>
                    <td className="px-6 py-4">
                      <input
                        type="number"
                        min={0}
                        max={24}
                        step={0.25}
                        value={row.usedInput}
                        onChange={e =>
                          setRows(prev =>
                            prev.map(r =>
                              r.memberId === row.memberId
                                ? { ...r, usedInput: e.target.value }
                                : r
                            )
                          )
                        }
                        className="w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                      />
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-bold text-gray-900">{available}</span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        type="button"
                        disabled={row.saving || !dirty}
                        onClick={() => saveRow(row.memberId)}
                        className="text-[11px] font-bold uppercase tracking-wide px-3 py-1.5 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed bg-gray-900 text-white hover:bg-gray-800"
                      >
                        {row.saving ? 'Saving…' : 'Save'}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
