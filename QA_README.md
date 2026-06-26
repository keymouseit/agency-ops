# Agency Ops — QA Getting Started Guide
**For:** Neha Joshi (QA)
**App:** Internal operations platform for KeyMouse IT
**Your role in testing:** Find anything that crashes, behaves incorrectly, or makes no sense before the team starts using this for real data.

---

## Before you start — setup

Ask Vishal or Rahul to do this on a laptop. You just need the URL once it's running.

```bash
npm install
npx prisma db push
npm run dev
```

**Option A — Dummy demo data** (leads, projects, scores pre-filled for QA testing):

```bash
npx prisma db seed
npx tsx scripts/setup-accounts.ts
```

**Option B — Real team only** (clean slate, no dummy data):

```bash
npm run db:reset-team
```

Open **http://localhost:3000** in your browser.

If the app asks you to log in, use any account from the tables below.
Default password for all accounts: `AgencyOps2025!`

---

## Test accounts to use

You will need to test as different people throughout.

### Real team (after `npm run db:reset-team`)

| Who | Email | Password | Role | Test as them when... |
|-----|-------|----------|------|---------------------|
| Shiven | shiven@keymouse.com | AgencyOps2025! | Founder | Dashboard, intelligence, team scores, goals, settings |
| Vikas | vikas@keymouse.com | AgencyOps2025! | BD | Pipeline, leads, MOM, estimates |
| Vishal Sharma | vishal@keymouse.com | AgencyOps2025! | Dev | Projects, daily plans, estimation filling |
| Gurleen | gurleen@keymouse.com | AgencyOps2025! | QA | QA test cycles, release sign-off |
| Reema | reema@keymouse.com | AgencyOps2025! | HR | Team page, daily overview |

### Dummy demo accounts (after `npx prisma db seed`)

| Who | Email | Password | Role | Test as them when... |
|-----|-------|----------|------|---------------------|
| Shiven | shiven@keymouse.com | AgencyOps2025! | Founder | Testing the dashboard, intelligence page, team scores, goals |
| Kavya | kavya@keymouse.com | AgencyOps2025! | BD | Testing pipeline, adding leads, requesting estimates |
| Vishal | vishal@keymouse.com | AgencyOps2025! | Dev | Testing projects, daily plans, estimation filling |
| Neha | neha@keymouse.com | AgencyOps2025! | QA | Testing everything QA-related |
| Priya | priya@keymouse.com | AgencyOps2025! | Both | Testing both BD and Dev flows |
| Rahul | rahul@keymouse.com | AgencyOps2025! | Dev | Second dev on at-risk project scenarios |
| Amit | amit@keymouse.com | AgencyOps2025! | Dev | Low-activity daily log scenarios |

**How to switch accounts:** Click "Sign out" in the top right. Then log in as the new person.

---

## What you are testing

Agency Ops covers 7 main areas. Each has its own section in the test scenarios document (`QA_TEST_SCENARIOS.md`). Here is a plain-English summary of each:

### 1. BD Pipeline (test as Kavya)
Kavya manages leads — potential clients. She should be able to:
- Add a new lead (client name, source, budget)
- Update a lead's status as it progresses (new → proposal sent → interview → won/lost)
- Log a proposal with the budget quoted
- Add a loss analysis when a lead is lost (why did we lose it?)
- Request an estimate from a developer for any active lead

### 2. Estimation (test as Kavya first, then Vishal)
When a client needs a quote, BD asks a developer to estimate the work:
- Kavya creates an estimation request, assigns it to Vishal
- Vishal opens `/estimate`, sees his pending request, fills in the breakdown line by line
- Vishal confirms his estimate — BD gets notified
- Kavya reviews the breakdown and either approves it or sends it back for changes
- If sent back, Vishal revises and resubmits

### 3. Projects (test as Vishal)
Projects are the active work after a lead is won:
- Vishal should be able to create a project and set milestones
- He submits a weekly check-in: how much progress, is he on track, any blockers?
- He logs scope changes if the client asks for more work (each one needs a signed change order)
- He cannot mark a project as "delivered" without QA sign-off first

### 4. QA (test as Neha)
This is the release gate — not a bug tracker:
- Neha logs a test cycle before each release: what was tested, pass/fail/conditional
- If it fails, she describes the blocker. The dev fixes it and she tests again
- When it passes, she submits the sign-off checklist
- After delivery, if the client reports an issue, she logs it as a post-delivery issue

### 5. Daily planning (test as Vishal or Rahul)
Every team member plans their day and closes it:
- Morning plan by 9:30am — specific tasks with estimated hours
- EOD report by 7pm — status on each task (done/partial/blocked), actual hours, blockers
- **Important:** If you submitted a morning plan yesterday but forgot the EOD, the app will block your morning plan today until you close yesterday first

### 6. Weekly check-in (test as any team member)
Every Monday before 10am:
- Team members update their project status and score themselves on 5 dimensions
- There is NO "who are you?" step — the app knows who you are from login
- If you have no projects assigned to you, you go straight to the self-assessment

### 7. Personal home — /me (test as each role)
When you log in, you land on "My Day":
- **Dev (Vishal):** sees his tasks for today, his projects, any estimation requests assigned to him
- **BD (Kavya):** sees her leads needing follow-up, any estimates ready for her review
- **QA (Neha):** sees projects needing QA attention, her goals
- **Founder (Shiven):** redirected to the main dashboard instead

---

## What to look for

### Crashes (P1 — must report)
- Any page that shows a blank white screen or a stack trace error
- Any button that stops working with no feedback
- Any form that submits and nothing happens (no success message, no error)

### Wrong data (P1 — must report)
- Data appearing for the wrong person (e.g. Vishal seeing Kavya's tasks)
- Numbers that don't add up (e.g. win rate doesn't match the actual leads)
- Dates showing as ugly ISO strings (e.g. `2025-06-15T00:00:00.000Z` instead of `15 Jun 2025`)

### Blocked flows (P1 — must report)
- Cannot complete a full flow from start to finish (e.g. create lead → estimate → approve → create project → deliver)
- A form that appears to save but the data doesn't show up on the next page
- A gate that should block but doesn't (e.g. can mark project delivered without QA sign-off)

### Confusing UX (P2 — nice to fix)
- A label or button that doesn't make sense
- A form that asks for something twice
- Something you had to think about for more than a few seconds to understand
- Missing feedback — you clicked something and don't know if it worked

---

## How to log a bug

Open a new note (or use the bug report template below) and include:

```
Test case: [TC-XXX or describe in words]
Testing as: [who you were logged in as]
What I did:
  1. [step]
  2. [step]
What I expected: [what should happen]
What actually happened: [what did happen]
Screenshot: [attach if possible]
Browser: [Chrome/Firefox/Safari + version]
Priority: P1 (blocking) / P2 (wrong but usable) / P3 (minor)
```

Send bugs to Shiven via WhatsApp with the format above.

---

## Test execution order

Run through the tests in this order. Each section builds on the previous one — you need leads before you can test estimation, projects before you can test QA sign-off.

**Day 1 — Foundation**
1. Login and navigation (TC-001 to TC-005 in QA_TEST_SCENARIOS.md)
2. BD Pipeline — add leads, update statuses (TC-006 to TC-013)
3. Estimation flow — request, fill, confirm, approve (TC-014 to TC-024)

**Day 2 — Projects and QA**
4. Create projects from won leads (TC-025 to TC-033)
5. QA module — test cycles, sign-off, post-delivery issues (TC-034 to TC-043)
6. Project delivery gate — confirm it blocks without sign-off (TC-039)

**Day 3 — People and daily**
7. Weekly check-in — as Vishal, then as Kavya (TC-044 to TC-053)
8. Team scores — submit as Vishal, view as Shiven (TC-054 to TC-060)
9. Daily planning — morning plan, EOD, EOD enforcement (TC-061 to TC-070)

**Day 4 — Intelligence and goals**
10. Intelligence dashboard as Shiven (TC-071 to TC-080)
11. Goals — create, update progress, mark achieved (TC-081 to TC-086)
12. Analytics pages (TC-087 to TC-092)

**Day 5 — Security and edge cases**
13. Cross-role access — confirm each role can only see what they should (TC-093 to TC-105)
14. Data integrity — empty fields, long text, duplicate submission (TC-106 to TC-115)
15. Settings — password change (TC-116 to TC-120)

---

## Key things to verify for security

These are important. The whole point of the login system is that each person can only see and submit their own data.

**Test each of these:**

1. Log in as Vishal. Go to `/daily`. You should only see Vishal's tasks — not Kavya's, not Rahul's.

2. Log in as Kavya (BD). Try to go to `/projects` by typing it in the URL. You should be redirected away — BD doesn't have access to projects.

3. Log in as Neha (QA). Try to go to `/pipeline`. You should be redirected — QA doesn't have access to the pipeline.

4. Log in as Vishal. Submit a morning plan. Go to `/daily` and confirm only Vishal's plan is visible. Sign out, log in as Rahul. Go to `/daily` — you should see Rahul's own (empty) view, not Vishal's plan.

5. Log in as Vishal. Go to `/checkin`. The "Who are you?" step should NOT appear — the app should already know it's Vishal and take you straight to the project status step.

6. Log in as Kavya. Go to `/checkin`. Kavya has no projects assigned to her (she's BD). The project step should say "No projects assigned to you" and let you continue to self-assessment.

---

## Things that are NOT bugs

The following are intentional — do not report them as bugs:

- **The morning plan blocks you if yesterday's EOD is missing.** This is by design. Submit yesterday's EOD first.
- **BD cannot see the Projects page.** BD manages leads, not projects. Devs own projects.
- **QA cannot see the BD Pipeline.** Same reason — different role, different access.
- **Submitting your weekly score twice in the same week overwrites the first.** Intentional — the system keeps "current state" not "history of submissions".
- **The Intelligence page takes a few seconds to load.** It runs 8 database queries simultaneously. This is acceptable.
- **There are no individual bug tickets in the QA module.** The QA module is a release gate, not a bug tracker. Bugs live in Jira or wherever the client uses. The system only tracks: did the release pass testing?
- **The Founder sees a different home page than everyone else.** Founder goes to the main dashboard, not the "My Day" page.

---

## Quick links when running locally

| Page | URL | Who can see it |
|------|-----|---------------|
| My Day | http://localhost:3000/me | BD, Dev, QA, Both |
| CEO Dashboard | http://localhost:3000/ | Founder only |
| ⚡ Intelligence | http://localhost:3000/intelligence | Founder only |
| BD Pipeline | http://localhost:3000/pipeline | Founder, BD, Both |
| Estimates | http://localhost:3000/estimate | Founder, BD, Both, Dev |
| Projects | http://localhost:3000/projects | Founder, Dev, Both |
| QA Dashboard | http://localhost:3000/qa | Founder, QA |
| Team Scores | http://localhost:3000/team | Founder only |
| Check-In | http://localhost:3000/checkin | Everyone |
| Daily | http://localhost:3000/daily | Everyone |
| Goals | http://localhost:3000/goals | Founder only |
| Analytics | http://localhost:3000/analytics | Founder only |
| Settings | http://localhost:3000/settings | Everyone |

---

## Questions?

If something is unclear or you're not sure if it's a bug:
- WhatsApp Shiven directly
- Screenshot + describe what you expected vs what happened
- Don't try to figure out if it's "supposed" to work that way — just report it and let the team decide

Thank you for doing this properly. Good QA now means fewer problems when the real data goes in.
