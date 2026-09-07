'use client'

import { useEffect, useState } from 'react'
import TestCyclesList from '@/components/TestCyclesList'
import QAProjectActions, { type EditableTestCycle } from './QAProjectActions'
import TestCycleManageButtons from './TestCycleManageButtons'
import type { TestCycleDetail } from '@/components/TestCycleDetailModal'

type Member = { id: string; name: string; role: string }
type Milestone = { id: string; title: string; status: string; dueDate: Date }

type Props = {
  project: { id: string; name: string; status: string }
  members: Member[]
  milestones: Milestone[]
  testCycles: TestCycleDetail[]
  hasSignOff: boolean
  canSignOff: boolean
  latestCycleId?: string
}

export default function TestCyclesPanel({
  project,
  members,
  milestones,
  testCycles,
  hasSignOff,
  canSignOff,
  latestCycleId,
}: Props) {
  const [editingCycleId, setEditingCycleId] = useState<string | null>(null)

  useEffect(() => {
    if (editingCycleId && !testCycles.some(c => c.id === editingCycleId)) {
      setEditingCycleId(null)
    }
  }, [testCycles, editingCycleId])

  const editingCycle: EditableTestCycle | null = editingCycleId
    ? (() => {
        const cycle = testCycles.find(c => c.id === editingCycleId)
        if (!cycle) return null
        return {
          id: cycle.id,
          cycleType: cycle.cycleType,
          environment: cycle.environment,
          result: cycle.result,
          conductedById: cycle.conductedById ?? '',
          summary: cycle.summary,
          blockerNote: cycle.blockerNote,
          fixedInCycle: cycle.fixedInCycle,
          testedAuth: cycle.testedAuth,
          testedCoreFlows: cycle.testedCoreFlows,
          testedEdgeCases: cycle.testedEdgeCases,
          testedMobile: cycle.testedMobile,
          testedCrossBrowser: cycle.testedCrossBrowser,
          testedPerformance: cycle.testedPerformance,
          testedIntegrations: cycle.testedIntegrations,
          testedDataIntegrity: cycle.testedDataIntegrity,
          cases: cycle.cases.map(c => ({ title: c.title, status: c.status, notes: c.notes })),
        }
      })()
    : null

  return (
    <div className="card p-5 mb-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-gray-900">Test cycles</h2>
        {!hasSignOff && (
          <QAProjectActions
            project={project}
            members={members}
            canSignOff={canSignOff}
            latestCycleId={latestCycleId}
            hasSignOff={hasSignOff}
            milestones={milestones}
            editingCycle={editingCycle}
            onCancelEdit={() => setEditingCycleId(null)}
          />
        )}
      </div>

      {editingCycleId && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-100 rounded-xl text-sm text-blue-800">
          Editing test cycle — save or cancel above.
        </div>
      )}

      <TestCyclesList
        testCycles={testCycles}
        hasSignOff={hasSignOff}
        manageButtons={(cycle, _isLatest, closeModal) =>
          !hasSignOff && editingCycleId !== cycle.id ? (
            <TestCycleManageButtons
              projectId={project.id}
              cycle={cycle}
              hasProjectSignOff={hasSignOff}
              onEdit={() => {
                closeModal()
                setEditingCycleId(cycle.id)
              }}
            />
          ) : null
        }
      />
    </div>
  )
}
