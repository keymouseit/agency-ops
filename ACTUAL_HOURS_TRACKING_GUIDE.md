# Developer Actual Hours Tracking - QA Testing Guide

## Overview
Developers enter actual hours spent on tasks through the **End-of-Day (EOD) report** system at `/daily/eod`.

---

## How It Works

### Step 1: Morning Plan (by 9:30am)
**Location:** `/daily`

1. Developer navigates to Daily page
2. Clicks "+ Add daily plan" or "+ Plan today"
3. Creates tasks for the day:
   - Task title
   - Task type (feature/bug/review/meeting/admin/qa/research)
   - Priority (high/medium/low)
   - **Estimated hours** (e.g., 3.5 hours)
   - Project (optional)
4. Submits plan

**Key Point:** This is where **estimated hours** are entered, not actual hours.

---

### Step 2: Work During the Day
Developer works on their planned tasks throughout the day.

---

### Step 3: End of Day Report (by 7pm)
**Location:** `/daily/eod`

**How to Access:**
- Navigate directly to `/daily/eod`
- OR: From `/daily` page, click "Submit EOD" button
- OR: Click EOD reminder banner if it appears

**What Developer Enters for Each Task:**

1. **Status** (required):
   - ✓ Done - Task completed
   - ½ Partial - Started but not finished
   - ⊘ Blocked - Cannot proceed
   - → Moved - Postponed to another day

2. **Actual Hours** (required):
   - Number input with 0.5 increments
   - Can be different from estimated hours
   - Example: Estimated 2h, actually took 3.5h

3. **Notes** (optional):
   - What happened with this task?
   - Any challenges or learnings
   - Example: "Fixed auth bug but discovered related issue in session handling"

4. **Blocker Reason** (required if status = Blocked):
   - Explain what's blocking
   - Example: "Waiting for API credentials from client"

**Additional EOD Fields:**

5. **General Blockers** (optional):
   - Team-wide blockers or issues
   - Not task-specific

6. **Carry Over** (optional):
   - Tasks to continue tomorrow
   - Automatically suggested from incomplete tasks

7. **Day Rating** (required):
   - Rate productivity: 1 (poor) to 10 (excellent)

8. **EOD Notes** (optional):
   - Overall reflections on the day
   - Team communication

---

## UI Screenshot Description

The EOD form shows:

```
┌─────────────────────────────────────────┐
│ EOD report                              │
│ [Developer Name] · Monday, 19 May       │
│ Due by 7pm                              │
├─────────────────────────────────────────┤
│                                         │
│ ┌───────┬──────────┬──────────┐        │
│ │   3   │    0     │   6.5h   │        │
│ │ Done  │ Blocked  │ Hours    │        │
│ └───────┴──────────┴──────────┘        │
│                                         │
│ ┌──── Task 1 ─────────────────────────┐│
│ │ Fix authentication bug              ││
│ │ [Project Name]          2h est.     ││
│ │                                     ││
│ │ Status: [✓Done] [½Part] [⊘Blk] [→] ││
│ │                                     ││
│ │ Actual hours: [3.5] hours          ││
│ │ Notes: [Fixed auth but found...   ]││
│ └─────────────────────────────────────┘│
│                                         │
│ [More tasks...]                         │
│                                         │
│ Day rating: [1][2][3]...[10]           │
│                                         │
│ [Submit EOD Report]                     │
└─────────────────────────────────────────┘
```

---

## Data Flow

```
Morning Plan (Estimated Hours)
         ↓
    Work During Day
         ↓
   EOD Report (Actual Hours)
         ↓
    Database Storage
         ↓
    Analytics & Metrics
```

### Where Actual Hours Are Stored

**Database Schema:**
```typescript
model DailyTask {
  id              String
  dailyLogId      String
  title           String
  taskType        String
  priority        String
  estimatedHours  Float?      // From morning plan
  actualHours     Float?      // ← From EOD report
  status          String      // planned/done/partial/blocked/moved
  eodNotes        String?     // Task notes
  blockedReason   String?     // If blocked
}
```

### Where Actual Hours Are Used

1. **Daily Analytics** (`/daily/analytics`):
   - Shows planned vs actual hours
   - Team productivity metrics
   - Estimation accuracy

2. **Project Tracking**:
   - Aggregated actual hours per project
   - Budget tracking
   - Estimation accuracy for future projects

3. **Team Dashboard** (`/`):
   - Weekly logged hours per team member
   - Burnout risk indicators
   - Productivity trends

4. **Personal Scorecards** (`/team`):
   - Individual performance metrics
   - Estimation accuracy over time

---

## QA Testing Checklist

### ✓ Test Case 1: Full Daily Workflow
1. Login as Developer (`testdev@agency.com`)
2. Navigate to `/daily`
3. Create daily plan with 3 tasks, each with estimated hours
4. Submit plan
5. Navigate to `/daily/eod`
6. **Verify:** All 3 tasks appear in EOD form
7. **Verify:** Estimated hours show next to each task
8. For each task:
   - Select status
   - **Enter actual hours** (try 2.5, 3.0, 1.5)
   - Add notes
9. Rate day (1-10)
10. Submit EOD
11. **Expected:** Success message
12. Navigate back to `/daily`
13. **Expected:** Yesterday's actual hours visible in history

### ✓ Test Case 2: Actual Hours Different from Estimate
1. Create plan: Task with 2h estimated
2. Submit EOD: Same task with 5h actual
3. Navigate to `/daily/analytics`
4. **Expected:** Shows variance (150% over estimate)
5. **Expected:** Red indicator for significant overrun

### ✓ Test Case 3: Zero Actual Hours (Blocked Task)
1. Create plan: Task with 3h estimated
2. Mark as "Blocked" in EOD
3. Enter 0h actual
4. Fill blocker reason
5. Submit
6. **Expected:** Accepts 0 hours for blocked tasks
7. **Expected:** Blocker tracked separately

### ✓ Test Case 4: Partial Hours (0.5 increments)
1. Enter actual hours: 0.5, 1.5, 2.5, 3.5
2. **Expected:** All half-hour values accepted
3. **Expected:** Proper calculation in totals

### ✓ Test Case 5: Analytics Roll-Up
1. Submit EOD with various actual hours
2. Check `/daily/analytics`
3. **Expected:** Daily total matches sum of task hours
4. **Expected:** Weekly total accumulates correctly
5. **Expected:** Planned vs Actual chart updates

### ✓ Test Case 6: Project-Level Aggregation
1. Create tasks for specific project
2. Log actual hours in EOD
3. Navigate to project detail page
4. **Expected:** Project shows actual hours spent
5. **Expected:** Estimation accuracy calculated

### ✓ Test Case 7: Missing EOD Reminder
1. Submit daily plan
2. Wait until end of day (or change system time)
3. Navigate to `/daily`
4. **Expected:** Banner shows "Missing EOD for yesterday"
5. Click "Submit EOD now"
6. **Expected:** Redirects to `/daily/eod` for previous day

### ✓ Test Case 8: Cannot Submit EOD Without Plan
1. Skip morning plan
2. Try to access `/daily/eod`
3. **Expected:** Error or message: "No plan for today"
4. **Expected:** Prompts to create plan first

---

## Common Issues & Troubleshooting

### Issue: "I can't find where to enter actual hours"
**Solution:** Actual hours are NOT entered during the plan. They are entered at end of day via `/daily/eod`.

### Issue: "EOD page is empty"
**Solution:** You need to submit a morning plan first. Go to `/daily` and create tasks.

### Issue: "My actual hours don't show in analytics"
**Solution:**
- Ensure EOD was submitted successfully
- Check `/daily` to see if yesterday's log shows "EOD submitted"
- Analytics may cache - try refreshing page

### Issue: "Can I edit actual hours after EOD submission?"
**Current Behavior:** EOD is locked once submitted.
**Workaround:** Contact Founder to update via database if critical correction needed.

### Issue: "Task disappeared from EOD form"
**Solution:** Only tasks from today's morning plan appear in EOD. If you added a task to a different day, it won't show in today's EOD.

---

## Code References

For developers investigating issues:

### Frontend Components:
- **EOD Form:** `src/app/daily/eod/EODClient.tsx` (lines 154-166)
- **Daily Plan:** `src/app/daily/plan/DailyPlanClient.tsx`
- **Analytics:** `src/app/daily/analytics/page.tsx`

### API Endpoints:
- **Submit EOD:** `POST /api/daily/[logId]/eod`
  - File: `src/app/api/daily/[logId]/eod/route.ts`
  - Validates all tasks have status
  - Saves actualHours for each task
  - Updates team member scores

### Database Schema:
- **Table:** `DailyTask`
- **Field:** `actualHours` (Float, nullable)
- **Related:** `DailyLog.eodSubmittedAt` (timestamp)

### Validation Rules:
- Actual hours must be >= 0
- Can use decimal values (0.5 increments)
- Required for all tasks when submitting EOD
- No maximum limit enforced

---

## Feature Status

✅ **Working as Designed**
- Morning plan with estimated hours
- EOD form with actual hours input
- Task-level actual hours tracking
- Analytics aggregation
- Project-level roll-up

❌ **Known Limitations**
- Cannot edit EOD after submission
- Cannot submit EOD without morning plan
- No mobile-optimized EOD form yet

---

## Questions for Product Team

1. Should we allow editing EOD after submission?
2. Should we allow partial EOD (some tasks without actual hours)?
3. Should we add bulk actual hours entry (e.g., "all tasks took estimated time")?
4. Should we add time tracking integration (automatic tracking)?

---

**For Additional Questions:**
Contact: Development Team
Reference: Session 5 Bug Analysis (2026-05-19)
