# QA Bugs - Session 5

## Summary
5 issues reported by QA team. 4 are actual bugs, 1 is a question about existing functionality.

---

## Bug 1: Post-Delivery Issues Button Visible Before Sign-Off ❌

**Expected:** Post-delivery issues should only be added after QA has signed off the project.

**Actual:** The "+ Post-delivery issue" button is visible on QA project page even before sign-off.

**Root Cause:**
- File: `src/app/qa/[id]/QAProjectActions.tsx` (lines 198-200)
- The button is shown unconditionally when not in `issueMode`
- Missing check for `releaseSignOff`

**Current Code:**
```typescript
{!issueMode && (
  <div className="flex gap-2 flex-wrap">
    <button className="btn-primary text-xs" onClick={() => setView('cycle')}>
      + Log test cycle
    </button>
    {canSignOff && !view && (
      <button className="btn-secondary text-xs border-green-300 text-green-800 hover:bg-green-50" onClick={() => setView('signoff')}>
        ✓ Submit release sign-off
      </button>
    )}
    <button className="btn-secondary text-xs" onClick={() => setView('issue')}>
      + Post-delivery issue
    </button>
  </div>
)}
```

**Fix:** Add a `hasSignOff` prop and conditionally render the button

---

## Bug 2: Post-Mortem Button Visible Before Sign-Off ❌

**Expected:** Post-mortem form should only be visible after QA has signed off the project.

**Actual:**
- Post-mortem button shows when project status is 'qa' or 'delivered'
- API correctly rejects with 403 error
- UI should not show button until sign-off exists

**Root Cause:**
- File: `src/app/projects/[id]/ProjectActions.tsx` (line 65, 74)
- Visibility check only looks at `project.status`, not `releaseSignOff`
- API has correct gate at `src/app/api/projects/[id]/postmortem/route.ts` (lines 8-23)

**Current Code:**
```typescript
const canAddPostMortem = ['qa', 'delivered'].includes(project.status)
...
{canAddPostMortem && !project.postMortem && <button className="btn-secondary text-xs" onClick={() => setView('postmortem')}>+ Post-mortem</button>}
```

**Fix:** Check for `releaseSignOff` in addition to status

---

## Bug 3: Milestone Update Returns 403 for QA ❌

**Expected:** QA should be able to mark milestones as complete.

**Actual:** QA gets 403 Forbidden error when trying to update milestone status.

**Root Cause:**
- File: `src/middleware.ts` (lines 57-78)
- Middleware blocks QA from accessing `/api/projects/milestones/*`
- Milestone API endpoint allows ['QA', 'Both', 'Founder'] at `src/app/api/projects/milestones/[id]/route.ts` (line 6)
- But middleware only allows ['Dev', 'Both', 'Founder'] to access `/api/projects`

**Current Middleware Code:**
```typescript
function checkApiAccess(path: string, role: string): boolean {
  // Dev can access project/daily/checkin/estimate APIs
  if (['Dev', 'Both', 'Founder'].includes(role)) {
    if (
      path.startsWith('/api/projects') ||
      ...
    ) return true
  }
  // QA can access QA and bug APIs
  if (['QA', 'Founder'].includes(role)) {
    if (path.startsWith('/api/qa') || path.startsWith('/api/blockers')) return true
  }
  ...
}
```

**Fix:** Add special case in middleware to allow QA to access `/api/projects/milestones`

---

## Bug 4: "Log Test Cycle" Button Visible to Developers ❌

**Expected:** Only QA team members should see "Log test cycle" and "Submit sign-off" actions.

**Actual:** When developer views their own projects in "My Day" page, they see QA-specific action buttons.

**Root Cause:**
- File: `src/app/me/page.tsx` (lines 446-447, 481-490)
- Developer projects show "Log test cycle →" and "Submit sign-off →" links
- These buttons link to `/qa/[id]` which developers cannot access

**Current Code:**
```typescript
const needsSignOff  = inQA && !p.releaseSignOff && p.testCycles[0]?.result === 'pass'
const needsCycle    = inQA && !p.releaseSignOff && !p.testCycles[0]

...

{needsCycle && (
  <Link href={`/qa/${p.id}`} className="text-xs px-2 py-0.5 bg-blue-100 text-blue-800 rounded hover:bg-blue-200">
    Log test cycle →
  </Link>
)}
{needsSignOff && (
  <Link href={`/qa/${p.id}`} className="text-xs px-2 py-0.5 bg-green-100 text-green-800 rounded hover:bg-green-200">
    Submit sign-off →
  </Link>
)}
```

**Fix:** Only show these QA action buttons for users with QA role (['QA', 'Both', 'Founder'])

---

## Question 5: How Do Developers Enter Actual Hours? ✅

**Answer:** Developers enter actual hours in their End-of-Day (EOD) report.

**Location:**
- Page: `/daily/eod`
- File: `src/app/daily/eod/EODClient.tsx` (lines 157-166)

**How it works:**
1. Developer plans their day with tasks and estimated hours at `/daily`
2. At end of day (by 7pm), they submit EOD report
3. For each task, they enter:
   - Status (Done/Partial/Blocked/Moved)
   - **Actual hours** spent
   - Notes about what happened
4. Actual hours are stored in `DailyTask.actualHours` field
5. These aggregate into project-level metrics and team analytics

**UI:**
```typescript
<div>
  <label className="label">Actual hours</label>
  <input
    type="number"
    step="0.5"
    min="0"
    value={update.actualHours}
    onChange={e => updateTask(task.id, 'actualHours', e.target.value)}
    className="input"
  />
</div>
```

---

## Fixes Required

### Priority 1 (Blocking QA workflow):
- ✅ Bug 3: Milestone update permission

### Priority 2 (Incorrect UI behavior):
- ✅ Bug 1: Post-delivery issue button visibility
- ✅ Bug 2: Post-mortem button visibility
- ✅ Bug 4: QA buttons visible to developers

### No Fix Required:
- ✅ Question 5: Feature works as designed
