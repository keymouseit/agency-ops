'use client'

import { MOM_ACTION_STATUSES, MOM_ACTION_STATUS_COLORS, momActionStatusLabel } from '@/lib/utils'

export type ActionRowDraft = {
  key: string
  id?: string
  title: string
  ownerId: string
  dueDate: string
  status: string
  blockedReason: string
}

type Member = { id: string; name: string; role: string }

let keySeq = 0
export function newActionRow(partial?: Partial<ActionRowDraft>): ActionRowDraft {
  keySeq += 1
  return {
    key: `new-${Date.now()}-${keySeq}`,
    title: '',
    ownerId: '',
    dueDate: '',
    status: 'Open',
    blockedReason: '',
    ...partial,
  }
}

function ownerLabel(members: Member[], ownerId: string) {
  const m = members.find(x => x.id === ownerId)
  return m ? m.name : '—'
}

export default function MomActionItemsEditor({
  members,
  rows,
  onChange,
  required,
  readOnly = false,
}: {
  members: Member[]
  rows: ActionRowDraft[]
  onChange: (rows: ActionRowDraft[]) => void
  required?: boolean
  /** When plan is locked (≥1 action, non-Founder/Manager), show summary; status via detail. */
  readOnly?: boolean
}) {
  function update(index: number, patch: Partial<ActionRowDraft>) {
    onChange(rows.map((r, i) => (i === index ? { ...r, ...patch } : r)))
  }

  function remove(index: number) {
    onChange(rows.filter((_, i) => i !== index))
  }

  if (readOnly) {
    return (
      <div className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">Action items</h2>
          <p className="text-xs text-amber-700 mt-0.5 bg-amber-50 border border-amber-100 rounded-md px-2.5 py-1.5 inline-block">
            Action plan is locked. Only Founder/Manager can change what, owner, or due. Owners update status on the MOM detail page.
          </p>
        </div>

        {rows.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50/80 px-4 py-6 text-center text-sm text-gray-500">
            No structured actions on this MOM.
          </div>
        ) : (
          <div className="space-y-2">
            {rows.map((row, index) => (
              <div
                key={row.key}
                className="rounded-xl border border-gray-200 bg-gray-50/60 px-4 py-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-gray-400 mb-0.5">Action {index + 1}</p>
                    <p className="text-sm font-medium text-gray-900">{row.title || '—'}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      Owner: <span className="text-gray-700">{ownerLabel(members, row.ownerId)}</span>
                      {' · '}
                      Due: <span className="text-gray-700">{row.dueDate || '—'}</span>
                    </p>
                    {row.status === 'Blocked' && row.blockedReason ? (
                      <p className="text-xs text-red-600 mt-1">Blocked: {row.blockedReason}</p>
                    ) : null}
                    {row.status === 'Skipped' && row.blockedReason ? (
                      <p className="text-xs text-slate-600 mt-1">Skipped: {row.blockedReason}</p>
                    ) : null}
                  </div>
                  <span
                    className={`badge border shrink-0 ${MOM_ACTION_STATUS_COLORS[row.status] ?? 'bg-gray-50 text-gray-700 border-gray-200'}`}
                  >
                    {momActionStatusLabel(row.status)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">
            Action items{required ? ' *' : ''}
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Structured next steps with owner and due date. Required unless status is Hold or Closed.
          </p>
        </div>
        <button
          type="button"
          onClick={() => onChange([...rows, newActionRow()])}
          className="btn-secondary shrink-0 text-xs"
        >
          + Add action
        </button>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50/80 px-4 py-6 text-center text-sm text-gray-500">
          No structured actions yet.
          {required ? ' Add at least one before saving.' : ' Optional for Hold / Closed.'}
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((row, index) => (
            <div
              key={row.key}
              className="rounded-xl border border-gray-200 bg-white p-4 space-y-3"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-gray-500">Action {index + 1}</span>
                <button
                  type="button"
                  onClick={() => remove(index)}
                  className="text-xs text-gray-400 hover:text-red-600"
                >
                  Remove
                </button>
              </div>
              <div>
                <label className="label">What *</label>
                <input
                  type="text"
                  className="input"
                  value={row.title}
                  onChange={e => update(index, { title: e.target.value })}
                  placeholder="e.g. Send revised proposal deck"
                  required={required}
                />
              </div>
              <div className="grid sm:grid-cols-3 gap-3">
                <div>
                  <label className="label">Owner *</label>
                  <select
                    className="input"
                    value={row.ownerId}
                    onChange={e => update(index, { ownerId: e.target.value })}
                    required={required}
                  >
                    <option value="">Select owner</option>
                    {members.map(m => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({m.role})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Due date *</label>
                  <input
                    type="date"
                    className="input"
                    value={row.dueDate}
                    onChange={e => update(index, { dueDate: e.target.value })}
                    required={required}
                  />
                </div>
                <div>
                  <label className="label">Status</label>
                  <select
                    className="input"
                    value={row.status}
                    onChange={e => update(index, { status: e.target.value })}
                  >
                    {MOM_ACTION_STATUSES.map(s => (
                      <option key={s} value={s}>{momActionStatusLabel(s)}</option>
                    ))}
                  </select>
                </div>
              </div>
              {(row.status === 'Blocked' || row.status === 'Skipped') && (
                <div>
                  <label className="label">
                    {row.status === 'Skipped' ? 'Skipped reason *' : 'Blocked reason *'}
                  </label>
                  <input
                    type="text"
                    className="input"
                    value={row.blockedReason}
                    onChange={e => update(index, { blockedReason: e.target.value })}
                    placeholder={row.status === 'Skipped' ? 'Why is this skipped?' : 'Why is this blocked?'}
                    required
                  />
                </div>
              )}
              <div className="flex items-center gap-2">
                <span className={`badge border ${MOM_ACTION_STATUS_COLORS[row.status] ?? 'bg-gray-50 text-gray-700 border-gray-200'}`}>
                  {momActionStatusLabel(row.status)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
