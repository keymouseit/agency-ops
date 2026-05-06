# Agency Ops — Honest System Assessment
# Written for: Shiven (founder) + next Claude instance taking over
# Version: v6 · Date of assessment: May 2025
# Status: NOT ready for QA. Fix the blocking issues below first.

---

## THE ONE-LINE VERDICT

The system is architecturally sound and covers the right ground.
It is not ready for the team to use yet. There are 6 issues that will
either cause crashes, data corruption, or security holes before anyone
logs their first daily plan. Fix those first. Then send it to QA.

---

## WHAT IS GENUINELY GOOD

### 1. The scope is right
Most internal tools for agencies try to be everything — Jira, Salesforce,
HubSpot, Slack, all in one. This system resists that. It tracks what an
agency founder actually needs to see:
- Is each project healthy or burning?
- Is the team productive or idle?
- Where are leads being lost and why?
- Is this release safe to ship?
- Are we estimating accurately or guessing?

Every module has a clear purpose. The QA redesign (test cycles instead of
bug tickets) is exactly the right call for a 6–10 person agency. The
estimation module with dev confirmation is the right process. The daily
plan + EOD loop is the right accountability mechanism.

### 2. The data model is solid
24 models. Every relationship is correct. The schema enforces business
rules at the database level (unique constraints on week-scoped records,
the @@unique on ReleaseSignOff so there's one per project). No raw
queries — all Prisma ORM, so no SQL injection risk.

### 3. The hard gates work
The project delivery gate is properly enforced:
- Cannot mark delivered without ReleaseSignOff
- Cannot sign off without a passing TestCycle
- Cannot sign off if cycle result is "fail"
These are the three most important business rules and they are all
enforced at the API level, not just the UI.

### 4. Authentication is correct in architecture
NextAuth v5, bcrypt password hashing, JWT sessions, middleware-based
route protection. The role-based access matrix is correct. The
setup-accounts.ts CLI is clean and practical.

### 5. The founder intelligence view is the right idea
One page that answers all 8 founder questions simultaneously. Health
score formula is defensible (penalises schedule slip, estimation drift,
post-delivery issues, unsigned COs, no client update). Projects sorted
critical-first so the founder never has to hunt.

---

## WHAT IS BROKEN RIGHT NOW

These are not "nice to have" items. These are issues that will cause
crashes or data problems on first real use.

---

### BLOCKER 1 — Login page will crash in production
**File:** src/app/login/page.tsx
**Issue:** The login page uses `useSearchParams()` from next/navigation.
In Next.js 14, any component using useSearchParams must be wrapped in a
React Suspense boundary or the entire page crashes with a build error.
This will work in `npm run dev` but fail on `npm run build`.

**Fix — wrap LoginPage in Suspense:**
```tsx
// src/app/login/page.tsx
import { Suspense } from 'react'

function LoginForm() {
  // move all existing LoginPage content here (the useState, useSearchParams, etc.)
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-950" />}>
      <LoginForm />
    </Suspense>
  )
}
```

---

### BLOCKER 2 — Clicking "Estimates" in the nav crashes with 404
**File:** Nav links to /estimate but src/app/estimate/page.tsx does not exist.
Only /estimate/[leadId]/page.tsx exists.
**Who is affected:** BD, Both, Dev, Founder roles — everyone who sees the
Estimates nav link.

**Fix — create a list page at /estimate/page.tsx:**
```tsx
// src/app/estimate/page.tsx
import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { fmtDate } from '@/lib/utils'
export const dynamic = 'force-dynamic'

export default async function EstimatesPage() {
  const requests = await prisma.estimationRequest.findMany({
    include: {
      lead: true, assignee: true, requester: true,
      record: { select: { totalHoursFinal: true, totalPriceFinal: true, devConfirmedAt: true, bdApprovedAt: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  const statusColors: Record<string, string> = {
    pending: 'bg-gray-100 text-gray-600', in_progress: 'bg-blue-100 text-blue-800',
    confirmed: 'bg-purple-100 text-purple-800', revision: 'bg-red-100 text-red-700',
    approved: 'bg-green-100 text-green-800', won: 'bg-teal-100 text-teal-800', lost: 'bg-red-100 text-red-700',
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-gray-900 mb-6">Estimates</h1>
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr className="text-xs text-gray-400 uppercase tracking-wide">
              <th className="text-left px-4 py-3 font-medium">Client</th>
              <th className="text-left px-3 py-3 font-medium">Assigned to</th>
              <th className="text-left px-3 py-3 font-medium">Requested by</th>
              <th className="text-center px-3 py-3 font-medium">Status</th>
              <th className="text-center px-3 py-3 font-medium">Hours</th>
              <th className="text-center px-3 py-3 font-medium">Price</th>
              <th className="text-center px-3 py-3 font-medium">Created</th>
              <th className="px-3 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {requests.map(r => (
              <tr key={r.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-800">{r.lead.clientName}</td>
                <td className="px-3 py-3 text-gray-600">{r.assignee.name}</td>
                <td className="px-3 py-3 text-gray-500">{r.requester.name}</td>
                <td className="text-center px-3 py-3">
                  <span className={`badge text-xs ${statusColors[r.status] ?? 'bg-gray-100 text-gray-600'}`}>
                    {r.status.replace('_', ' ')}
                  </span>
                </td>
                <td className="text-center px-3 py-3 text-gray-500">
                  {r.record?.totalHoursFinal ? `${r.record.totalHoursFinal}h` : '—'}
                </td>
                <td className="text-center px-3 py-3 text-gray-500">
                  {r.record?.totalPriceFinal ? `$${r.record.totalPriceFinal.toLocaleString()}` : '—'}
                </td>
                <td className="text-center px-3 py-3 text-gray-400 text-xs">{fmtDate(r.createdAt)}</td>
                <td className="px-3 py-3">
                  <Link href={`/estimate/${r.leadId}`} className="text-xs text-blue-600 hover:underline">
                    Open →
                  </Link>
                </td>
              </tr>
            ))}
            {requests.length === 0 && (
              <tr><td colSpan={8} className="text-center py-10 text-gray-400 text-sm">
                No estimates yet. BD requests an estimate from a lead's detail page.
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

---

### BLOCKER 3 — Project actual hours are NEVER synced
**Impact:** The single most important metric in the system — estimation
accuracy — is never actually calculated for active projects.
The Intelligence dashboard, the margin health section, and the
ProjectHealthSnapshot model all reference `project.actualHours`. But
`project.actualHours` is never updated automatically from daily task logs.
It is only updated when someone manually fills in the post-mortem.

This means:
- Margin health always shows "—" for active projects
- Intelligence health score cannot penalise estimation drift
- Estimation review tab shows "—" for actual vs estimated

**Root cause:** Daily logs write actual hours to `DailyTask.actualHours`.
But nothing aggregates those into `Project.actualHours`.

**Fix — add this to the EOD API route after saving tasks:**
```typescript
// src/app/api/daily/[logId]/eod/route.ts
// After the existing task updates, add:

const log = await prisma.dailyLog.findUnique({
  where: { id: params.logId },
  include: { tasks: { include: { project: true } } },
})

// Group actual hours by project and update each project's total
const projectHours: Record<string, number> = {}
for (const task of log?.tasks ?? []) {
  if (task.projectId && task.actualHours) {
    projectHours[task.projectId] = (projectHours[task.projectId] ?? 0) + task.actualHours
  }
}

// For each project touched today, recalculate total from ALL daily task logs
for (const projectId of Object.keys(projectHours)) {
  const totalActual = await prisma.dailyTask.aggregate({
    where: { projectId, actualHours: { not: null } },
    _sum: { actualHours: true },
  })
  await prisma.project.update({
    where: { id: projectId },
    data: { actualHours: totalActual._sum.actualHours ?? 0 },
  })
}
```

---

### BLOCKER 4 — API routes have no server-side auth check
**All 25 API routes accept requests from anyone with a valid URL.**
The middleware handles page-level protection but API routes do not
independently verify the session. This means:

- A QA person logged in can POST to /api/leads to create a lead
- A Dev can POST to /api/qa/[id]/signoff to sign off their own project
- Anyone who guesses a URL can hit any endpoint

This is the most critical security gap. In a local-only tool it is
lower risk, but once anyone accesses it from a non-local machine, it
needs fixing before any real data goes in.

**Fix — add this helper to src/lib/auth.ts:**
```typescript
// Add to src/lib/auth.ts
export async function requireRole(roles: string[]): Promise<string> {
  const session = await auth()
  if (!session?.user) throw new Error('UNAUTHORIZED')
  if (!roles.includes(session.user.role)) throw new Error('FORBIDDEN')
  return session.user.id
}
```

**Then in each API route (example — leads):**
```typescript
import { requireRole } from '@/lib/auth'

export async function POST(req: Request) {
  try {
    await requireRole(['BD', 'Both', 'Founder'])
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Forbidden' },
      { status: e instanceof Error && e.message === 'UNAUTHORIZED' ? 401 : 403 }
    )
  }
  // ... rest of route
}
```

Priority order for adding auth checks:
1. /api/qa/[id]/signoff (QA only — prevents dev signing off own project)
2. /api/estimate/[recordId]/approve (BD/Founder only)
3. /api/estimate/[recordId]/revision (BD/Founder only)
4. /api/goals (Founder only for create/update)
5. /api/leads (BD/Both/Founder only)
6. All others can wait for the next iteration

---

### BLOCKER 5 — Hardcoded fallback secret in auth.ts
**File:** src/lib/auth.ts line 76
```typescript
secret: process.env.NEXTAUTH_SECRET ?? 'dev-secret-change-in-production',
```
If NEXTAUTH_SECRET is not set in .env, the app uses a known fallback.
An attacker can forge valid session tokens if they know the secret.
This ships to the team with a known default secret.

**Fix:**
```typescript
// Change to:
secret: process.env.NEXTAUTH_SECRET,
```
Then document clearly: the app will not start without NEXTAUTH_SECRET set.
This forces whoever runs the app to generate a real secret first.
Generate one with: `openssl rand -base64 32`

---

### BLOCKER 6 — Seed creates 4 separate Prisma clients
**File:** prisma/seed.ts
Creates `prisma`, `prisma2`, `prisma3`, and `pr` — four separate database
connections in one script. This causes connection pool exhaustion warnings
and occasionally leaves connections open. In SQLite specifically this can
cause database lock errors during seeding.

**Fix:** Use the single `prisma` instance throughout, or restructure seed
into sequential async functions sharing one client.

---

## WHAT IS MISSING (NOT BLOCKING, BUT IMPORTANT)

These will not break the app but are gaps that will frustrate the team
within the first month of real use.

### GAP 1 — No "My tasks today" view
Every team member currently has to know to open /daily/plan and select
themselves. There is no personalised dashboard — no "here is what you
have open, here is what is due this week, here is your plan for today."
This means the system requires discipline to check. Systems that require
discipline fail. Systems that surface the right information to the right
person without them asking succeed.

**What to build:**
A `/me` or `/home` page per logged-in user showing:
- "Your plan today" (their daily log if submitted, or the plan form if not)
- "Your open projects" (projects where they are owner)
- "Your active goals" (from /goals, filtered to them)
- "Your pending items" (any check-in due this week, any EOD missing)

This is the page that makes the app feel alive to individual contributors
instead of feeling like a management surveillance tool.

---

### GAP 2 — No "what needs my attention now" signal
The founder has the Intelligence page. Individual team members have nothing
that tells them "here is what you need to do today." They get no signal
when a goal is falling behind, when a blocker they raised has been
resolved, or when BD has requested an estimate from them.

Without this, the system becomes: founder checks it daily, team ignores it
until Friday standup. That defeats the whole point.

**What to build:**
A simple notification model — not email yet, just an in-app "inbox":
```prisma
model Notification {
  id         String   @id @default(cuid())
  memberId   String
  type       String   // "estimate_requested" | "blocker_resolved" | "revision_requested"
              //     | "plan_missing" | "signoff_needed" | "goal_update_due"
  message    String
  linkTo     String?  // URL to go to
  read       Boolean  @default(false)
  createdAt  DateTime @default(now())
}
```
Show a badge in the nav when there are unread notifications. This is 2–3
days of work and dramatically increases system adoption.

---

### GAP 3 — Estimation flow is BD-initiated only, developer has no queue
Right now, a developer gets assigned an estimation request through a
conversation ("Kavya sent me an estimation request in the system"). There
is no way for a developer to open the app and see "I have 2 pending
estimation requests." The /estimate page lists all requests, but developers
can see it and don't know which are theirs.

**Fix:** On the /estimate list page, add a filter "Assigned to me" using
the logged-in user's ID. Also show a count in the nav badge.

---

### GAP 4 — No actual hours entry path for developers who don't use daily logs
The daily EOD is the only way actual hours get into the system. If a
developer submits their plan but forgets to submit EOD, actual hours for
that day are never recorded. The system has no fallback and no nudge.

Two options:
- Option A: Allow actual hours to be entered directly on the project page
  (simpler, less granular)
- Option B: Make EOD submission mandatory — if someone submits a morning
  plan, the system locks them out of submitting the next morning's plan
  until they submit yesterday's EOD

Option B is better for data integrity and matches the "hard accountability"
direction of the system.

---

### GAP 5 — Loss analysis can be skipped on won leads
The system requires loss analysis on lost leads (enforced by warning). But
there is no "win analysis" on won leads. Understanding why you won is as
important as understanding why you lost — especially for BD training.

**What to add:**
A simple `WinAnalysis` model on Lead (parallel to LossAnalysis):
- What tipped the client in our favour
- Which team member contributed most to the win
- Was the estimation accurate vs final project cost
- Would we take this client/project type again

This feeds into the analytics page and eventually tells you what kind of
leads to pursue more of.

---

### GAP 6 — No project archive / search
Once you have 30+ projects, the /projects page becomes a wall of cards
with no way to search or filter by client, date range, tech stack, or
status history. This is currently not a problem (seed data has 4 projects)
but will be within 6 months of real use.

**Minimum fix:** Add a search input that filters the project list by name
or client name. This is a 30-minute change.

---

### GAP 7 — The QA test scenarios document references old models
QA_TEST_SCENARIOS.md still has test cases for bugs, QA check-ins, and
individual bug logging (TC-034 through TC-044 in the old version). These
modules no longer exist. Neha will be testing against features that are
gone.

**Action required:** Update QA_TEST_SCENARIOS.md to reflect the new QA
model (test cycles, sign-off, post-delivery issues). Replace all old QA
test cases with the new flow. This must happen BEFORE QA starts.

---

### GAP 8 — Weekly score entry is self-reported and not time-blocked
Any team member can go to /team and submit a score for any other team
member, or submit scores for themselves multiple times and pick the best
one. The upsert prevents duplicate records for the same week, but there is
no audit trail of WHO submitted a score. The `founderScore: boolean` field
exists to distinguish self vs founder scores, but the form does not enforce
that only the right person submits each type.

**Minimum fix:** Use the logged-in user's session to automatically set
`submittedById` on the score, and restrict submission to the member
themselves for self-scores. Do not let Kavya submit Vishal's score.

---

## WHAT WOULD ADD REAL VALUE (FUTURE)

These are not gaps in the current system — they are the next level.

### VALUE ADD 1 — Client health score
Right now the system tracks project health. It does not track client health
— are they happy? Have they been communicated with? Have they paid on time?
Are they the kind of client you want to keep?

A simple `ClientProfile` model (separate from Lead/Project) that tracks:
client name, contact person, industry, total projects done, NPS-style
rating, payment reliability, referral count. Over time this tells you which
clients are worth taking on again and which to avoid.

### VALUE ADD 2 — Revenue forecasting
With contract values on projects and estimated delivery dates, you can show
a simple cash flow forecast: "expected invoicing in Q3 based on current
active projects." This requires no new data — just aggregating what already
exists. But it would be one of the most valuable things you could show
yourself every Monday morning.

### VALUE ADD 3 — Upwork connect ROI
The estimation module tracks proposal budgets. If connect spend is also
tracked (the scraper you have already), you can calculate cost-per-proposal
and cost-per-won-deal by source. This tells you whether Upwork is
profitable as a channel at your current win rate and pricing.

### VALUE ADD 4 — Template library for estimation
After 20+ projects, patterns emerge: a React dashboard takes about 80h,
a mobile app with auth and notifications takes about 200h, a WordPress
custom theme takes about 30h. A template system in the estimation module
— "start from similar project" — would cut estimation time in half and
make new developers' estimates more accurate from day one.

### VALUE ADD 5 — Portfolio app integration
The API endpoint GET /api/portfolio-feed is planned but not built. When
it exists, the portfolio app (React + Vite, separate repo) fetches
delivered projects automatically instead of being maintained manually.
This is the "dog-fooding" moment — Agency Ops feeds the thing that sells
the agency.

---

## SHOULD QA START NOW?

**No. Not yet.**

Fix Blockers 1–5 first (Blocker 6 is lower risk). Estimated time: 1 day of
focused work. Then:

1. Fix the QA test scenarios document (Gap 7) — half a day
2. Run `npm run build` and verify it succeeds with no errors
3. Run `npx prisma db push && npx prisma db seed` on a fresh clone
4. Verify login works with at least 2 different roles (Founder + BD)
5. Manually smoke-test the 5 critical paths:
   - Lead → Request estimate → Dev fills estimate → BD approves
   - Project check-in → weekly summary visible on dashboard
   - Morning plan → EOD → completion rate on daily analytics
   - Test cycle → sign-off → project status update to delivered
   - Intelligence page loads without error

If all 5 pass, hand it to Neha.

The QA test scenarios (85 P1 cases) are comprehensive. The system is
complex enough that QA will find real issues. You want to make sure it
runs cleanly before Neha spends 2 days testing features that crash on
startup.

---

## HANDOVER NOTES FOR NEXT CLAUDE INSTANCE

**Context:** This is an internal operations platform for KeyMouse IT
(Chandigarh, India) and DearDev (Dubai, UAE), both founded by Shiven.
It is built with Next.js 14, Prisma, SQLite, NextAuth v5, Tailwind.

**The 6 things to fix immediately (in order):**

1. Login page Suspense wrapper — see BLOCKER 1 above
2. /estimate/page.tsx missing — see BLOCKER 2 above (full code provided)
3. Project actualHours never synced — see BLOCKER 3 above (code provided)
4. API routes have no server-side auth — see BLOCKER 4 above (pattern provided)
5. Hardcoded auth secret fallback — see BLOCKER 5 above (1 line change)
6. Seed has 4 Prisma clients — see BLOCKER 6 (lower priority, fix after others)

**After fixing blockers:**
- Update QA_TEST_SCENARIOS.md (remove old bug/QACheckIn test cases,
  add TestCycle/ReleaseSignOff/PostDeliveryIssue test cases)
- Build a /me personalised home page per logged-in user
- Add Notification model and in-app inbox
- Add "assigned to me" filter on /estimate list page

**The founder's mental model for this system:**
Shiven has a strong preference for understanding "why" before implementing.
He challenges assumptions — this is a feature, not friction. When proposing
changes, explain the reasoning first. He prefers direct language with no
corporate buzzwords. He builds in public on LinkedIn and is targeting
SaaS founders as clients while also running KeyMouse.

**Files to read first (in order):**
1. CLAUDE_HANDOVER.md — architecture, models, API routes, business rules
2. prisma/schema.prisma — the complete data model
3. This document — current state, what is broken, what is missing
4. QA_TEST_SCENARIOS.md — what QA will be testing

**One thing to know about the business rules:**
The delivery gate (project cannot move to "delivered" without ReleaseSignOff)
is the most important rule in the system. Do not soften it, do not add
exceptions to it, and do not let any UI path bypass it. Every other rule
in the system can have exceptions. This one cannot.

---
*Assessment written: v6 build · 61 source files · 24 schema models · 25 API routes*
*Author: Claude (Sonnet) with full codebase access*
