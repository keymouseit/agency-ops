# Agency Ops — Claude Code Handover Document

**Last updated:** After daily planning + EOD module was added and fully completed.
**Status:** TypeScript clean (zero errors). All modules built and functional.
**Next priority:** Authentication before real data goes in.

This document is the single source of truth for any developer or Claude Code instance
picking up this codebase. Read this before touching anything.

---

## 1. What this app is and why it exists

An internal operations platform for **KeyMouse IT** (Chandigarh, India) and
**DearDev** (Dubai, UAE) — both founded by Shiven, a JavaScript/React/Node.js
developer with 10 years of experience.

**The problem it solves:** The founder was the only consistent revenue source.
Projects ran at a loss due to scope creep and bad estimation. Team had no formal
accountability structure, no data on why leads were lost, and Slack status updates
that were unmeasurable. A formal team reset was done — this app is the operational
backbone of that reset.

**What it is not:** An HRMS. Not a payroll tool. Not a client portal. Not a time
tracker in the granular sense. It is a structured accountability and visibility
system covering BD, project delivery, QA, daily work, and people performance.

**Business model:** Service agency. Custom software for clients. Mostly fixed-scope.
Revenue from Upwork (primary), LinkedIn, Referral, and direct inbound. Team is
6–10 people across BD, Dev, QA, and Founder roles.

---

## 2. Tech stack

| Layer | Choice | Notes |
|-------|--------|-------|
| Framework | Next.js 14 (App Router) | Server components by default. Client components only where interactivity needed. |
| Database | SQLite via Prisma ORM | Single file at `prisma/agency-ops.db`. Zero infrastructure. |
| ORM | Prisma 5.x | Schema at `prisma/schema.prisma`. Run `npx prisma db push` after any schema change. |
| Styling | Tailwind CSS 3.4+ | Utility classes only. Shared classes defined in `src/app/globals.css` (card, badge, btn-*, input, label). |
| Language | TypeScript 5 | `strict: false`, `strictNullChecks: true`. Intentional — this is an internal tool, not a library. |
| Date handling | date-fns 3.x | Used throughout. Key functions: `startOfDay`, `startOfWeek`, `subDays`, `subWeeks`, `format`, `eachDayOfInterval`. |
| Runtime | Node.js, local only | No cloud deployment. `npm run dev` → localhost:3000. |

---

## 3. Running the app

```bash
# First time setup
npm install
npx prisma db push        # creates prisma/agency-ops.db from schema
npx prisma db seed        # loads realistic sample data

# Daily development
npm run dev               # http://localhost:3000

# After any schema change
npx prisma db push        # syncs schema → db (safe if new fields are optional)
                          # prisma generate runs automatically after push

# Database tools
npm run db:studio         # Prisma Studio visual browser at localhost:5555
npm run db:reset          # DESTRUCTIVE — wipe + re-seed from scratch

# Production / local network sharing
npm run build
npm start -- --hostname 0.0.0.0
# Team accesses via http://[machine-local-ip]:3000
```

**The database is a single file.** Back up by copying `prisma/agency-ops.db`.
Restore by replacing it. No migrations — Prisma push is used throughout.

---

## 4. Complete file structure

```
agency-ops/
├── prisma/
│   ├── schema.prisma              # THE source of truth for all data models
│   └── seed.ts                    # Sample data — team, leads, projects, bugs, daily logs
│
├── src/
│   ├── app/
│   │   ├── layout.tsx             # Root layout — wraps Nav around every page
│   │   ├── globals.css            # Global styles + shared utility classes
│   │   ├── page.tsx               # CEO Dashboard — flags, projects, scores, daily summary
│   │   │
│   │   ├── pipeline/
│   │   │   ├── page.tsx           # Lead list with stage filter + summary counts
│   │   │   ├── AddLeadForm.tsx    # [client] Modal — new lead form
│   │   │   └── [id]/
│   │   │       ├── page.tsx       # Lead detail — proposals, loss analysis, project link
│   │   │       └── LeadActions.tsx # [client] Add proposal / log loss / update status
│   │   │
│   │   ├── projects/
│   │   │   ├── page.tsx           # Project list — active cards + delivered table
│   │   │   ├── AddProjectForm.tsx  # [client] Modal — new project form
│   │   │   └── [id]/
│   │   │       ├── page.tsx       # Project detail — milestones, scope log, check-ins, post-mortem
│   │   │       └── ProjectActions.tsx # [client] Check-in / scope / milestone / post-mortem / status forms
│   │   │
│   │   ├── qa/
│   │   │   ├── page.tsx           # QA dashboard — project health, open bugs, client-reported alerts
│   │   │   ├── checkin/
│   │   │   │   ├── page.tsx       # QA check-in landing (server)
│   │   │   │   └── QACheckInClient.tsx # [client] QA's Monday form
│   │   │   └── [id]/
│   │   │       ├── page.tsx       # Per-project QA — bugs, check-in history, sign-off checklist
│   │   │       └── QAProjectActions.tsx # [client] Log bug / update bug / QA check-in / sign-off
│   │   │
│   │   ├── team/
│   │   │   ├── page.tsx           # Scorecards — this week's scores + 6-week trend bars per person
│   │   │   └── SubmitScoreForm.tsx # [client] Weekly self-assessment modal (5 dimensions, 1–10)
│   │   │
│   │   ├── checkin/
│   │   │   ├── page.tsx           # Weekly check-in landing (server — fetches members + projects)
│   │   │   └── CheckInClient.tsx  # [client] 3-step form: who → project status → self-score
│   │   │
│   │   ├── daily/
│   │   │   ├── page.tsx           # Daily team view — all plans and EODs for a given date
│   │   │   ├── analytics/
│   │   │   │   └── page.tsx       # 30-day patterns: completion rates, estimation accuracy, blockers
│   │   │   ├── plan/
│   │   │   │   ├── page.tsx       # Morning plan landing (server — checks who already submitted)
│   │   │   │   └── MorningPlanClient.tsx # [client] Dynamic task builder — add tasks, est hours, priority
│   │   │   └── eod/
│   │   │       ├── page.tsx       # EOD landing — shows picker if no logId in query param
│   │   │       └── EODClient.tsx  # [client] Per-task status update + day summary + rating
│   │   │
│   │   ├── analytics/
│   │   │   └── page.tsx           # Business analytics — win rates, loss patterns, estimation, score trends
│   │   │
│   │   └── api/                   # REST API routes — POST/PATCH only (reads use server components)
│   │       ├── leads/
│   │       │   ├── route.ts                       POST   /api/leads
│   │       │   └── [id]/
│   │       │       ├── proposals/route.ts          POST   /api/leads/:id/proposals
│   │       │       ├── loss/route.ts               POST   /api/leads/:id/loss
│   │       │       └── status/route.ts             POST   /api/leads/:id/status
│   │       ├── projects/
│   │       │   ├── route.ts                       POST   /api/projects
│   │       │   └── [id]/
│   │       │       ├── checkin/route.ts            POST   /api/projects/:id/checkin
│   │       │       ├── scope/route.ts              POST   /api/projects/:id/scope
│   │       │       ├── milestones/route.ts         POST   /api/projects/:id/milestones
│   │       │       ├── postmortem/route.ts         POST   /api/projects/:id/postmortem
│   │       │       └── status/route.ts             POST   /api/projects/:id/status
│   │       ├── qa/
│   │       │   └── [id]/
│   │       │       ├── checkin/route.ts            POST   /api/qa/:id/checkin
│   │       │       ├── bugs/
│   │       │       │   ├── route.ts                POST   /api/qa/:id/bugs
│   │       │       │   └── [bugId]/route.ts        PATCH  /api/qa/:id/bugs/:bugId
│   │       │       └── signoff/route.ts            POST   /api/qa/:id/signoff
│   │       ├── scores/
│   │       │   └── route.ts                       POST   /api/scores
│   │       └── daily/
│   │           ├── plan/route.ts                  POST   /api/daily/plan
│   │           └── [logId]/
│   │               └── eod/route.ts               POST   /api/daily/:logId/eod
│   │
│   ├── components/
│   │   └── Nav.tsx                # Sticky top nav — active link detection via usePathname
│   │
│   └── lib/
│       ├── prisma.ts              # Prisma client singleton (globalThis pattern, dev-safe)
│       ├── auth.ts                # NextAuth v5 config — credentials provider, role-based callbacks
│       └── utils.ts               # Shared constants (LEAD_SOURCES, ROLES etc), color helpers, formatters
```

---

## 5. Navigation — current links

```
/ Dashboard        → CEO overview (flags, projects, scores, daily summary bar)
/pipeline          → BD lead funnel (all stages, filter by status)
/projects          → Project lifecycle list
/qa                → QA dashboard (bugs, project health, client-reported alerts)
/team              → Weekly scorecards + 6-week trends
/checkin           → Weekly check-in form (3-step: who → project → self-score)
/daily             → Daily ops view (today's plans and EODs, date navigation)
/analytics         → Business analytics (win rates, loss patterns, estimation, scores)

Sub-pages (no nav link — accessed via parent):
/pipeline/[id]           → Lead detail
/projects/[id]           → Project detail
/qa/[id]                 → Per-project QA view
/qa/checkin              → QA's weekly check-in form
/daily/plan              → Morning plan form (due 9:30am)
/daily/eod               → EOD report form (due 7pm)
/daily/analytics         → 30-day daily analytics
```

---

## 6. Data model — all 16 models

```
TeamMember
  ├── leadsOwned       → Lead[]
  ├── proposalsWritten → Proposal[]
  ├── projectsOwned    → Project[]
  ├── checkIns         → ProjectCheckIn[]
  ├── qaCheckIns       → QACheckIn[]
  ├── bugsFound        → Bug[] (@relation "BugFoundBy")
  ├── bugsAssigned     → Bug[] (@relation "BugAssignedTo")
  ├── bugsVerified     → Bug[] (@relation "BugVerifiedBy")
  ├── qaSignOffs       → QASignOff[]
  ├── weeklyScores     → WeeklyScore[]
  ├── monthlyReviews   → MonthlyReview[]
  ├── scopeChanges     → ScopeChange[] (approved scope changes)
  └── dailyLogs        → DailyLog[]

  role: "BD" | "Dev" | "QA" | "Both" | "Founder"

── BD PIPELINE ────────────────────────────────────────────────────────

Lead
  ├── owner       → TeamMember
  ├── proposals   → Proposal[]
  ├── project     → Project? (1:1 — set when lead is won and project created)
  └── lossAnalysis → LossAnalysis? (REQUIRED when status = 'lost')

  status: "new" | "proposal_sent" | "interview" | "won" | "lost"
  source: "Upwork" | "LinkedIn" | "Referral" | "Inbound" | "Direct"

Proposal
  ├── lead       → Lead
  └── writtenBy  → TeamMember

LossAnalysis
  └── lead → Lead (unique — one analysis per lost lead)

  reason: "price_too_high" | "slow_response" | "weak_proposal" | "trust_gap" |
          "tech_mismatch" | "lost_interview" | "no_response" | "other"
  faultArea: "BD" | "Estimation" | "Communication" | "Proposal_Quality" | "External"

── PROJECT LIFECYCLE ───────────────────────────────────────────────────

Project
  ├── lead         → Lead? (optional link to originating lead)
  ├── owner        → TeamMember (dev team lead)
  ├── milestones   → Milestone[]
  ├── scopeChanges → ScopeChange[]
  ├── checkIns     → ProjectCheckIn[] (weekly dev updates)
  ├── qaCheckIns   → QACheckIn[] (weekly QA updates)
  ├── bugs         → Bug[]
  ├── qaSignOff    → QASignOff? (delivery gate)
  ├── postMortem   → PostMortem? (required within 1 week of delivery)
  └── dailyTasks   → DailyTask[] (tasks worked on this project)

  status: "scoping" | "active" | "qa" | "delivered" | "cancelled"

Milestone        → Project
ScopeChange      → Project + TeamMember? (approvedBy)
ProjectCheckIn   → Project + TeamMember (submittedBy)
PostMortem       → Project (unique)

── QA ─────────────────────────────────────────────────────────────────

QACheckIn → Project + TeamMember
  Fields: testCasesTotal/Passed/Failed/Pending, bugsOpenCritical/Major/Minor,
          bugsClosedThisWeek, readyForDelivery, blockers, notes

Bug → Project + Milestone? + TeamMember (foundBy/assignedTo/verifiedBy)
  severity: "critical" | "major" | "minor" | "trivial"
  type: "functional" | "ui" | "performance" | "security" | "regression"
  status: "open" | "in_progress" | "fixed" | "verified" | "closed" | "wont_fix"
  clientReported: Boolean  ← RED FLAG. Means QA missed it.
  qaChecklistMiss: Boolean ← Should have been on the checklist

QASignOff → Project + TeamMember (signedOffBy)  [unique — one per project]
  8-item boolean checklist: allTestCasesPassed, noCriticalBugsOpen,
  noMajorBugsOpen, regressionTestDone, clientUATCompleted, stagingVerified,
  performanceChecked, securityChecked

── PEOPLE & SCORES ─────────────────────────────────────────────────────

WeeklyScore → TeamMember
  5 dimensions (1–10): delivery, process, communication, growth, culture
  founderScore: Boolean — false = self-assessment, true = founder's view
  @@unique([memberId, weekOf, founderScore])

MonthlyReview → TeamMember
  Aggregated monthly averages + pipFlag + recognized + founderNotes
  @@unique([memberId, month])

── DAILY PLANNING ──────────────────────────────────────────────────────

DailyLog → TeamMember
  Phase 1 (plan, due 9:30am): planSubmittedAt, planNotes
  Phase 2 (EOD, due 7pm):     eodSubmittedAt, blockers, carryOver,
                               dayRating (1–5), eodNotes
  Computed on EOD: completionRate (float 0–1), estimationScore (float, 1.0 = perfect)
  Flags: planMissed, eodMissed (set by background job — not yet built)
  @@unique([memberId, date])

DailyTask → DailyLog + Project?
  Plan fields: title, taskType, priority, estimatedHours
  EOD fields:  status, actualHours, eodNotes, blockedReason

  taskType: "feature" | "bug" | "review" | "meeting" | "admin" | "qa" | "research"
  priority: "high" | "medium" | "low"
  status: "planned" → "done" | "partial" | "blocked" | "moved"
```

---

## 7. Critical business rules — never remove without explicit instruction

These rules exist because the founder experienced real business damage from their absence.

### Rule 1 — Scope change = change order required
Every `ScopeChange` must eventually have `changeOrderSigned: true`.
Dashboard flags unsigned COs. Project detail warns.
**MISSING:** Project status API doesn't yet block `delivered` if COs are unsigned.
This must be enforced — see Urgent backlog.

### Rule 2 — QA sign-off is a hard delivery gate
`POST /api/qa/[id]/signoff` → returns 422 if any Bug with severity `critical` or
`major` has status `open` or `in_progress`. Enforced at API level.
**MISSING:** `POST /api/projects/[id]/status` does NOT yet check for QASignOff
before allowing the `delivered` transition. Fix this immediately.

### Rule 3 — Loss analysis is mandatory on every lost lead
Currently a social rule, not a system rule. The lead detail page shows a warning.
**Future:** Block status change to `lost` until `lossAnalysis` exists.

### Rule 4 — Client-reported bugs are always prominent
Any `Bug` with `clientReported: true` appears:
- CEO dashboard flags section (top, red)
- QA dashboard alert banner (top, red)
Do not bury this — it is the primary QA accountability metric.

### Rule 5 — Weekly check-ins are week-scoped (upsert pattern)
`ProjectCheckIn`, `QACheckIn`, and `WeeklyScore` all use upsert on
`(memberId/projectId + weekOf)`. Submitting twice in the same week overwrites.
This is intentional — "current state" not "append log".
`weekOf` is always `startOfWeek(new Date())`.

### Rule 6 — Daily logs are day-scoped (upsert pattern)
`DailyLog` has `@@unique([memberId, date])` where `date` = `startOfDay(new Date())`.
Re-submitting a morning plan the same day: deletes existing tasks + recreates them.
Re-submitting EOD: updates existing log record + task records in place.
`planMissed` and `eodMissed` flags exist on the model but are not yet set
automatically — requires a background job (see backlog).

### Rule 7 — Task titles must be specific
The morning plan form placeholder reads: "Build appointment booking API endpoint"
not "work on project". This is intentional UX design. Vague titles like
"working on tasks" provide zero accountability value. Do not change the placeholder
to something generic.

### Rule 8 — QA person cannot verify their own bugs
Not yet enforced in code. The `verifiedById` on Bug should differ from `foundById`.
Add this validation to `PATCH /api/qa/[id]/bugs/[bugId]/route.ts`.

---

## 8. How to make common changes

### Add a field to an existing model
```
1. Edit prisma/schema.prisma — add field with ? (optional) to avoid data loss
2. npx prisma db push
3. Add input to the relevant *Actions.tsx or *Form.tsx component
4. Add to the relevant API route handler (parse and pass to prisma.model.create/update)
5. Display in the relevant page.tsx
```

### Add a new team member role
```
1. Add to ROLES in src/lib/utils.ts
2. Update filter in AddLeadForm.tsx (BD owner dropdown)
3. Update filter in CheckInClient.tsx (project visibility)
4. Done — role is a plain string in Prisma
```

### Add a new lead source or task type
```
1. Add to LEAD_SOURCES or equivalent constant in src/lib/utils.ts
2. It auto-populates in all select dropdowns — no other changes needed
```

### Add a new page
```
1. Create src/app/[route]/page.tsx (server component)
2. For forms: add src/app/[route]/[Name]Client.tsx with 'use client' at top
3. Add to links array in src/components/Nav.tsx if it needs a nav link
4. Data reads: use prisma.* directly in the server component (no API call needed)
5. Data writes: create src/app/api/[route]/route.ts
```

### Add authentication (URGENT — do this first)
```bash
npm install next-auth
```

Create `src/app/api/auth/[...nextauth]/route.ts`:
```ts
import NextAuth from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'

export const { handlers, auth } = NextAuth({
  providers: [
    CredentialsProvider({
      credentials: { password: { type: 'password' } },
      authorize(credentials) {
        if (credentials.password === process.env.ADMIN_PASSWORD) {
          return { id: '1', name: 'Admin' }
        }
        return null
      },
    }),
  ],
})
export const { GET, POST } = handlers
```

Create `src/middleware.ts`:
```ts
export { auth as middleware } from './app/api/auth/[...nextauth]/route'
export const config = { matcher: ['/((?!api/auth|_next).*)'] }
```

Add to `.env`:
```
NEXTAUTH_SECRET=your-random-secret-here
ADMIN_PASSWORD=your-chosen-password
```

---

## 9. Known limitations and tech debt

| Item | Detail | Priority |
|------|--------|----------|
| Authentication | ✅ IMPLEMENTED — NextAuth v5, credentials, role-based access | Done |
| QA sign-off gate | ✅ IMPLEMENTED — project status API enforces sign-off + no unsigned COs + no open critical bugs | Done |
| Unsigned CO gate | ✅ IMPLEMENTED — same status API check as QA sign-off | Done |
| No automatic daily miss flagging | `planMissed`/`eodMissed` fields exist but never get set | High |
| No notifications | Flags only visible by opening the dashboard | High |
| Loss analysis not enforced | Can mark lead 'lost' without completing analysis | Medium |
| Bug verifier ≠ finder not enforced | QA can verify their own bugs | Medium |
| Seed has 3 PrismaClient instances | Works but is wasteful — consolidate to one | Low |
| No pagination | All records loaded — fix when any table exceeds ~200 rows | Low |
| No real-time updates | Dashboard requires manual refresh | Low |
| Single-user assumption | No per-user data isolation | Not needed until team > 20 |

---

## 10. Feature backlog

### Urgent — before real data goes in

**Authentication**
See section 8 above for full implementation. Once auth is in:
- Role-based visibility: BD → pipeline + check-in, Dev → projects + check-in + daily,
  QA → qa + check-in + daily, Founder → everything
- Files: `src/middleware.ts`, `src/app/api/auth/[...nextauth]/route.ts`

**QA sign-off gate + unsigned CO gate on project delivery**
In `src/app/api/projects/[id]/status/route.ts`, add before the update:
```ts
if (data.status === 'delivered') {
  const [signOff, unsignedCOs] = await Promise.all([
    prisma.qASignOff.findUnique({ where: { projectId: params.id } }),
    prisma.scopeChange.count({ where: { projectId: params.id, changeOrderSigned: false } }),
  ])
  if (!signOff) return NextResponse.json({ error: 'QA sign-off required' }, { status: 422 })
  if (unsignedCOs > 0) return NextResponse.json({ error: `${unsignedCOs} unsigned change order(s)` }, { status: 422 })
}
```
Also show the error message in `ProjectActions.tsx` status update form.

**Daily miss flagging — background job**
Create `src/app/api/daily/flag-misses/route.ts` (call it via cron or manually):
- At 9:31am: find all active members with no `DailyLog.planSubmittedAt` for today →
  set `planMissed = true`, create the log record if it doesn't exist
- At 7:01pm: find all logs with `planSubmittedAt` but no `eodSubmittedAt` →
  set `eodMissed = true`
Surface missed submissions on the CEO dashboard in the daily summary bar.

**Email notifications — nodemailer**
```bash
npm install nodemailer @types/nodemailer
```
Trigger points:
- `clientReported: true` bug logged → immediate email to founder
- Monday 10am: list of team members who haven't submitted check-in
- 9:31am daily: list of members who haven't submitted morning plan
- 7:01pm daily: list of members who haven't submitted EOD
Add `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `FOUNDER_EMAIL` to `.env`.

---

### Good to have — next 4–8 weeks

**Quarterly goals / KRA per team member**
```prisma
model Goal {
  id          String     @id @default(cuid())
  memberId    String
  member      TeamMember @relation(fields: [memberId], references: [id])
  title       String
  description String?
  quarter     String     // "Q3-2025", "Q4-2025"
  targetDate  DateTime?
  progressPct Int        @default(0)
  status      String     @default("active") // "active" | "achieved" | "missed" | "deferred"
  createdAt   DateTime   @default(now())
  updatedAt   DateTime   @updatedAt
}
```
Pages: `/team/goals` (founder sets + reviews), goal progress in `/checkin` self-assessment,
goal summary in monthly review. This is the missing link between weekly scores and
long-term growth direction.

**Team member profile pages**
New page `/team/[id]`:
- Basic info: name, email, role, join date, designation
- All-time score trend (not just 6 weeks)
- Projects owned — delivered count, avg estimation accuracy, avg client score
- Goals (once implemented)
- Monthly review history
Add to `TeamMember` model: `joinDate`, `designation`, `phone`, `location`,
`githubUsername`, `upworkProfileUrl` (all optional).

**Portfolio app integration**
Expose `GET /api/portfolio-feed` from agency-ops:
```ts
// Returns: delivered projects where clientScore >= 7 and postMortem exists
// Fields: name, techStack, clientName, clientScore, whatWorked, deliveredAt
```
In the portfolio app (React + Vite): fetch from this endpoint to hydrate project data
automatically instead of maintaining it manually.
Add `portfolioUrl?: String` to the `Project` model for the reverse link (shown in
project detail page as "View in portfolio →").

**Upwork connect spend import**
You already have a Node.js/Puppeteer scraper pulling connect data. Add:
```prisma
model ConnectSpend {
  id          String    @id @default(cuid())
  weekOf      DateTime
  memberId    String?
  connects    Int
  costUSD     Float
  proposalId  String?   // link to Proposal if matchable
  createdAt   DateTime  @default(now())
}
```
Import script reads from your existing CSV/SQLite Upwork output.
Analytics page gains: cost-per-proposal, connects ROI by source, spend trend.

**Founder weekly digest email**
Endpoint `POST /api/digest` (or cron — Sunday 8pm):
- Open critical bugs count
- Check-in submission rate for the week
- Projects at risk or overdue
- New lost leads this week + loss reasons
- Team scores that dropped vs previous week
- Daily plan + EOD submission rates
Send as plain text to `FOUNDER_EMAIL`. Eliminates the need to open the dashboard
to stay informed.

**Milestone status update inside dev check-in**
Currently milestones are updated separately via `ProjectActions.tsx`.
In the dev check-in form, show the project's milestones and let the submitter
mark each as done / at_risk / missed inline. Removes one extra step per week.

**Daily carry-over auto-seeding**
When a team member opens the morning plan form, check if yesterday's log has any
tasks with `status = 'moved'` or `status = 'blocked'`. Pre-populate those as
today's first tasks (greyed out, editable). Reduces friction and ensures carry-over
tasks aren't forgotten.

---

## 11. What was deliberately excluded — and why

| Excluded | Reason |
|----------|--------|
| Attendance tracking | Use Keka, Zoho People, or a sheet. Compliance complexity (leave types, carry-forward, holidays) is too high to build custom at this team size. |
| Salary / payroll | Sensitive data. Wrong access model. Use Zoho Payroll or a protected sheet. Never in this app. |
| Client portal | Future consideration. Requires auth scoping, client-facing UX, and controlled read access — out of scope for internal tool. |
| Invoicing | Use Zoho Books or similar. |
| Time tracking per-task (granular) | Daily estimated vs actual hours per task is the proxy. True time tracking (start/stop timer) adds friction without proportional insight at this team size. |
| Chat / messaging | Slack stays for communication. This app is for structured, measurable data only. |
| Real-time updates (WebSockets) | Not needed. Dashboard refresh on page load is sufficient for an internal tool with 6–10 users. |
| Multi-tenancy | One company, one SQLite file. No isolation needed until team grows past ~20 or a second client is onboarded. |

---

## 12. Context about the founder and the reset

- **Founder:** Shiven — JavaScript/React/Node.js, 10 years experience
- **Companies:** KeyMouse IT (8 years, Chandigarh), DearDev (newer, Dubai)
- **Team size:** 6–10 people — BD, Dev, QA, Project Coordinator, Founder
- **The reset:** A formal team meeting was held with a presentation (also built in
  this session) titled "Building the Team We Need to Be". This app is the operational
  system that enforces the commitments made in that meeting.
- **Tone:** Direct, no-fluff. Forms are short. Rules are enforced at the system level
  where possible. The system is designed to make accountability visible, not punitive.
- **Key insight:** The founder was doing BD, delivery oversight, estimation, and client
  communication single-handedly. This app is designed to distribute that load by making
  every person's output visible and measurable without requiring the founder to chase anyone.

---

## 13. Quick reference — the operating rhythm this app supports

| Cadence | Who | What | Where |
|---------|-----|------|-------|
| Daily 9:30am | Every team member | Submit morning plan — tasks, hours, priority | `/daily/plan` |
| Daily 7pm | Every team member | Submit EOD — task statuses, blockers, day rating | `/daily/eod` |
| Monday | Dev/QA team leads | Submit weekly project check-in | `/checkin` or `/projects/[id]` |
| Monday | QA | Submit QA check-in — test coverage + open bugs | `/qa/checkin` |
| Monday | Every team member | Submit weekly self-assessment (5 dimensions) | `/checkin` |
| Monday morning | Founder | Read dashboard — flags, daily summary, scores | `/` |
| Per scope change | Dev team lead | Log scope change + confirm CO status | `/projects/[id]` |
| Per bug found | QA | Log bug with severity, type, assignment | `/qa/[id]` |
| Before delivery | QA | Submit sign-off checklist | `/qa/[id]` |
| Within 1 week of delivery | Dev team lead | Submit post-mortem | `/projects/[id]` |
| Monthly | Founder | Review scorecards + trends, recognize or flag | `/team` |

---

*Document version: v5 — authentication implemented, QA/CO delivery gates enforced, QA test scenarios written (QA_TEST_SCENARIOS.md).*
