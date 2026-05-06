# Agency Ops — Internal Operations Platform

A full-stack Next.js app for tracking your agency's BD pipeline, project lifecycle, and team accountability — all in one place, running locally on SQLite.

## What this tracks

### BD Pipeline
- Every lead from every channel (Upwork, LinkedIn, Referral, Inbound, Direct)
- Proposal log — who wrote it, budget quoted, tech stack, connects spent
- Interview notes and shortlist outcomes
- **Loss analysis on every lost lead** — reason, fault area, fault owner, lessons learned
- Win rate by owner, revenue won, pipeline value

### Project Lifecycle
- Scoping → Active → QA → Delivered
- Milestones with due dates and status
- **Scope change log** — every change captured, change order signed status enforced
- Weekly check-ins (progress %, on-track, blockers, client updated?)
- Estimation accuracy tracking (estimated vs actual hours)
- **Post-mortem** — required within 1 week of delivery

### Team Scorecards
- 5-dimension weekly scores per person: Delivery, Process, Communication, Growth, Culture
- Self-assessment by team members + founder review
- 6-week trend bars per person
- Repeated mistake flag
- Monthly review aggregation

### Analytics
- Win rate by owner
- Loss pattern breakdown — why we lose, which fault area, which person
- Estimation accuracy by project owner
- On-time delivery rate
- Score trends over 8 weeks

---

## Setup (5 commands)

```bash
# 1. Install dependencies
npm install

# 2. Create the database and push schema
npx prisma db push

# 3. Seed with sample data (6 team members, leads, projects, scores)
npx prisma db seed

# 4. Run the app
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## Other useful commands

```bash
# Open Prisma Studio (visual DB browser)
npm run db:studio

# Reset database and re-seed (WARNING: deletes all data)
npm run db:reset

# Build for production
npm run build && npm start
```

---

## File structure

```
agency-ops/
├── prisma/
│   ├── schema.prisma        # Full data model — edit to add fields
│   └── seed.ts              # Sample data — edit team names/emails here
├── src/
│   ├── app/
│   │   ├── page.tsx                    # Dashboard (founder view)
│   │   ├── pipeline/
│   │   │   ├── page.tsx                # BD pipeline list
│   │   │   ├── AddLeadForm.tsx         # Add lead modal
│   │   │   └── [id]/
│   │   │       ├── page.tsx            # Lead detail
│   │   │       └── LeadActions.tsx     # Proposal/loss/status forms
│   │   ├── projects/
│   │   │   ├── page.tsx                # Projects list
│   │   │   ├── AddProjectForm.tsx      # New project modal
│   │   │   └── [id]/
│   │   │       ├── page.tsx            # Project detail
│   │   │       └── ProjectActions.tsx  # Check-in/scope/milestone forms
│   │   ├── team/
│   │   │   ├── page.tsx                # Team scorecards + trends
│   │   │   └── SubmitScoreForm.tsx     # Weekly score submission
│   │   ├── checkin/
│   │   │   ├── page.tsx                # Check-in landing
│   │   │   └── CheckInClient.tsx       # 3-step check-in form for team
│   │   ├── analytics/
│   │   │   └── page.tsx                # All analytics views
│   │   └── api/                        # REST API routes
│   ├── components/
│   │   └── Nav.tsx                     # Navigation
│   └── lib/
│       ├── prisma.ts                   # DB client singleton
│       └── utils.ts                    # Shared types, helpers, constants
```

---

## First-time setup — customise for your team

### 1. Edit team members in `prisma/seed.ts`

Replace the sample names/emails with your actual team:

```ts
const vishal = await prisma.teamMember.upsert({
  where: { email: 'vishal@youragency.com' },
  update: {},
  create: { name: 'Vishal Sharma', email: 'vishal@youragency.com', role: 'Dev' },
})
```

Roles: `"BD"` | `"Dev"` | `"Both"` | `"Founder"`

### 2. Add real leads and projects

Use the UI — everything has a form. Or edit the seed file to pre-load real data.

### 3. Share with the team (optional — local network)

Run `next start` on a machine on your local network and access via its local IP:
```bash
npm run build
npm start -- --hostname 0.0.0.0
# Team accesses via http://192.168.x.x:3000
```

---

## The weekly operating rhythm

| When | Who | What |
|------|-----|------|
| Monday before 10am | Every team member | Submit check-in at `/checkin` |
| Monday | Founder | Review dashboard — flags, scores, at-risk projects |
| Friday | Founder | 1-on-1 with anyone scoring below 6 in any dimension |
| Within 1 week of delivery | Project owner | Post-mortem on `/projects/[id]` |
| Monthly | Founder | Full scorecard review — trends, recognition, PIPs |

---

## Escalation rules (enforce these from day 1)

| Trigger | Action |
|---------|--------|
| Scope change without CO signed | Flag shown on dashboard — work should pause |
| Client finds a bug before the team | Immediate flag — QA failure |
| Deadline missed, no prior warning raised | Mandatory post-mortem within 48h |
| Same mistake repeated 2+ weeks | 1-on-1 required, noted in monthly review |
| Check-in not submitted by Monday 10am | Process score hit for that week |

---

## Score interpretation

| Score | Meaning | Action |
|-------|---------|--------|
| 8–10 | Strong | Recognise publicly |
| 6–7 | Acceptable | Maintain, watch for drift |
| 4–5 | Needs improvement | 1-on-1 this week |
| 1–3 | At risk | PIP or role review conversation |

---

## Tech stack

- **Next.js 14** (App Router, Server Components)
- **Prisma** + **SQLite** — file-based, zero infrastructure
- **Tailwind CSS** — utility-first styling
- **TypeScript** — fully typed throughout
- **date-fns** — date handling

The database lives at `prisma/agency-ops.db`. Back it up by copying that file.

---

## Adding fields

To add a field (e.g. "tech stack" to weekly scores):

1. Add the field to `prisma/schema.prisma`
2. Run `npx prisma db push`
3. Add the input to the relevant form component
4. Add it to the API route handler

The schema is the single source of truth — Prisma generates all the types automatically.
