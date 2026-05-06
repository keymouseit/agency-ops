# Agency Ops — QA Test Scenarios
**Version:** v4 · **Total test cases:** 96 P1 + 46 P2 + 2 P3 = 144 total
**Instruction:** Run `npm run db:reset && npm run db:seed` before starting. Test as each role specified.
**Record:** PASS / FAIL / BLOCKED for every case. FAIL requires: exact step, expected vs actual, screenshot.

---

## ROLES IN SEED DATA

| Name | Role | Use for |
|------|------|---------|
| Shiven | Founder | Dashboard, Intelligence, Goals, all review actions |
| Kavya Nair | BD | Pipeline, proposals, estimation requests |
| Vishal Sharma | Dev | Projects, check-ins, daily logs, estimation |
| Rahul Mehra | Dev | Projects, check-ins, daily logs |
| Priya Singh | Both | Both BD and Dev flows |
| Amit Bhatia | Dev | Daily plans (low activity scenario) |
| Neha Joshi | QA | QA dashboard, bugs, check-ins, sign-off |

---

## MODULE 1 — CEO DASHBOARD (`/`)
*Test as: Founder*

### TC-001 · Dashboard loads with seed data [P1]
1. Open `http://localhost:3000`
2. **Expect:** 4 KPI cards render with real numbers (pipeline value, won revenue, active projects, avg team score). No "NaN" or blank cards.
3. **Expect:** Flags section shows at least 1 flag from seed data.
4. **Expect:** Project health section shows 2–4 active project rows with progress bars.
5. **Expect:** Team scores table shows at least 3 members with scores.
6. **Expect:** Daily summary bar shows today's date and is weekday-only (hides on weekends).

### TC-002 · Dashboard flags are accurate [P1]
1. In seed data, PropList Real Estate App has unsigned scope changes.
2. **Expect:** Dashboard flags section includes a "Scope change logged without CO" flag for PropList.
3. Seed data also has a client-reported bug — **Expect** a red "Client found a bug" flag.

### TC-003 · KPI win rate calculation [P1]
1. Note the win rate % on dashboard.
2. Go to `/pipeline`, manually count won leads vs total closed (won + lost).
3. **Expect:** Dashboard win rate % matches manual count.

### TC-004 · Empty database state [P2]
1. Run `npm run db:reset` (no seed).
2. Open dashboard.
3. **Expect:** No crash. KPIs show 0 or "—". Flags section shows "No flags". Scores section shows "No check-ins submitted yet."

---

## MODULE 2 — BD PIPELINE
*Test as: BD (Kavya)*

### TC-005 · Pipeline page loads [P1]
1. Open `/pipeline`.
2. **Expect:** 5 stage cards (New, Proposal sent, Interview, Won, Lost) with correct counts from seed data. Lead table shows all leads.

### TC-006 · Filter by status [P1]
1. Click "Won" stage card.
2. **Expect:** URL = `/pipeline?status=won`. Table shows only won leads. "Won" card has a ring highlight.
3. Click "Lost". **Expect:** Only lost leads shown.

### TC-007 · Add new lead [P1]
1. Click "+ Add lead".
2. Fill: Client = "Acme Corp", Source = LinkedIn, Owner = Kavya, Budget = 18000, Currency = USD, Description = "CRM integration project".
3. Click "Add lead".
4. **Expect:** Modal closes without error. Lead appears in table with status "new". "New" stage count increments by 1.

### TC-008 · Lead detail page [P1]
1. Click "View" on any seeded lead.
2. **Expect:** Page shows client name, source, owner, budget, status badge, description.
3. **Expect:** "Estimation" card present — shows either active estimation or amber "No estimation started" warning.
4. **Expect:** "Proposals & interactions" section present.
5. **Expect:** Loss analysis section only visible when status = "lost".

### TC-009 · Add proposal [P1]
1. Open a "new" lead. Click "+ Log proposal".
2. Fill: Written by = Kavya, Budget quoted = 17000, Tech stack = "Next.js, PostgreSQL", Connects spent = 6, Status = sent.
3. **Expect:** Proposal saved and appears in proposals list. No crash.

### TC-010 · Update lead status [P1]
1. Open any lead. Click "Update status". Change to "interview". Save.
2. **Expect:** Status badge updates on lead detail. Pipeline table shows updated status.

### TC-011 · Loss analysis warning [P1]
1. Update a lead status to "lost".
2. **Expect:** "Add loss analysis" button appears. Warning: "No loss analysis recorded. This is required for every lost lead."

### TC-012 · Add loss analysis [P1]
1. On a "lost" lead, click "+ Add loss analysis".
2. Fill: Reason = lost_interview, Fault area = BD, Competitor = "Agency X", Notes = "Demo went poorly", Lessons = "Prepare live demo next time".
3. **Expect:** Loss analysis saved and displayed. Warning disappears. `/analytics` reflects this new loss reason in breakdown.

### TC-013 · Estimation warning on lead without estimate [P2]
1. Open a lead with no estimation request.
2. **Expect:** Estimation card shows amber text: "BD should request an estimate from a developer before sending any proposal."

---

## MODULE 3 — ESTIMATION FLOW
*Test as: BD (Kavya) for Step 1 & 3, Dev (Vishal) for Step 2*

### TC-014 · BD requests estimation [P1]
1. Open any "new" lead. In the Estimation card, click "Request estimate".
2. **Expect:** Redirected to `/estimate/[leadId]`. Step 1 tab active.
3. Fill: Requested by = Kavya, Assigned to = Vishal, Due by = tomorrow 17:00, Scope notes = "Patient portal with EHR integration. 8 weeks."
4. Click "Send estimation request".
5. **Expect:** Status badge → "pending". Step tabs visible. Lead detail Estimation card now shows assignment info.

### TC-015 · Developer fills breakdown [P1]
1. Navigate to the estimate page. Click "2. Dev Estimate" tab.
2. Select: Estimated by = Vishal. Buffer = 20%, Rate = $25/hr.
3. Add 4 lines:
   - design / "UX wireframes" / 16h / medium
   - frontend / "Patient dashboard" / 40h / complex / risk flag: "EHR API docs unclear"
   - backend / "Appointment booking API" / 32h / medium
   - qa / "Testing & bug fixes" / 20h / simple
4. **Expect:** Live totals bar shows Raw = 108h, Buffered = ~130h, Price = ~$3,250. Updates with each change.
5. Fill Assumptions: "Client provides EHR API credentials by week 2".
6. Fill Exclusions: "Mobile app not included".
7. Click "Save draft".
8. **Expect:** Saved. Status → "in_progress". No crash.

### TC-016 · Over-budget warning [P1]
1. On a lead with budget = $2,000, enter estimation lines producing total > $2,000.
2. **Expect:** Totals bar turns red. Shows "over client budget" with exact overage amount.

### TC-017 · Developer confirms estimate [P1]
1. With estimate from TC-015 filled, click "Confirm & submit to BD".
2. **Expect:** Status → "confirmed". Lead detail Estimation card shows "✓ Developer confirmed".

### TC-018 · BD approves estimate [P1]
1. Open estimate, go to "3. Review" tab.
2. **Expect:** Full breakdown shown by phase. Totals summary matches what dev entered. "Dev confirmed" indicator green. "BD not yet approved" indicator shown.
3. Click "✓ Approve — ready to quote".
4. **Expect:** BD approved indicator turns green. Approve button disappears.

### TC-019 · BD sends for revision [P1]
1. After TC-017 (confirmed but not approved), click "Send back for revision".
2. Fill: "Backend estimate too low for EHR integration. Please revise."
3. **Expect:** Status → "revision". Estimate page shows revision note in red banner.
4. Dev updates hours and re-confirms.
5. **Expect:** Status → "confirmed". Revision note cleared.

### TC-020 · Risk flag behaviour [P1]
1. On any estimation line, check "Risk flag".
2. **Expect:** Risk note input appears. Row background turns amber.
3. Uncheck risk flag.
4. **Expect:** Risk note input hides. Background returns to normal.
5. **Expect:** In the Review tab, risk-flagged rows show ⚠ icon.

### TC-021 · Phase grouping in review [P1]
1. After approving an estimate, view the Review tab.
2. **Expect:** Lines grouped by phase (design, frontend, backend, qa). Phase header shows subtotal hours for that phase.

### TC-022 · Confirmation sign-off trail [P1]
1. Check the lead detail Estimation card after TC-018.
2. **Expect:** Shows "✓ Developer confirmed" AND "✓ BD approved" with green indicators. Approved date/name shown.

### TC-023 · Empty form validation [P2]
1. On the estimation form with no lines filled, click "Confirm & submit".
2. **Expect:** Button disabled (rawHours = 0) OR validation error. Cannot confirm an estimate with 0 hours.

### TC-024 · Actual vs estimated — post-delivery [P2]
1. Create a project from a won lead that has an approved estimation.
2. Log daily tasks against that project via EOD (any actual hours).
3. Open the estimation Review tab.
4. **Expect:** "Actual" column shows hours logged. Variance % calculated and shown in colour (green/amber/red).

---

## MODULE 4 — PROJECTS
*Test as: Dev (Vishal) and Founder*

### TC-025 · Projects page loads [P1]
1. Open `/projects`.
2. **Expect:** Active projects as cards. Delivered projects in table. Red alert shown for unsigned scope changes (from seed data).

### TC-026 · Create new project [P1]
1. Click "+ New project".
2. Fill: Name = "Portal Rebuild", Owner = Vishal, Client = "HealthCo", Contract value = 22000, USD, Estimated hours = 240, End date = 6 weeks from today.
3. **Expect:** Project appears in active list. No undefined values.

### TC-027 · Add milestone [P1]
1. Open any active project. Click "+ Milestone".
2. Fill: Title = "Backend APIs complete", Due = 3 weeks from today.
3. **Expect:** Milestone appears in project detail. Milestone progress shows 0/1.

### TC-028 · Weekly check-in [P1]
1. Open an active project. Click "+ Weekly check-in".
2. Fill: By = Vishal, Progress = 55%, On track = At risk, Scope change = None, Client updated = Yes, Blockers = "Awaiting client design approval".
3. **Expect:** Check-in saved. Project card shows 55% amber progress bar. Blocker visible on card. Intelligence dashboard reflects at-risk status.

### TC-029 · Log scope change — unsigned [P1]
1. Open an active project. Click "+ Scope change".
2. Fill: Description = "Add SMS notifications", By = Client, Hours = 12, Value = 400, CO signed = No.
3. **Expect:** Red "CO missing" badge on project card. Dashboard and Intelligence flag it. Project detail shows red warning.

### TC-030 · Log scope change — signed [P1]
1. Click "+ Scope change" again.
2. Fill same fields but CO signed = Yes.
3. **Expect:** This change shows green "CO signed" badge. The unsigned one remains red (both visible).

### TC-031 · Block delivery without QA sign-off [P1]
1. Open any active project with no QA sign-off.
2. Click "Update status", set to "delivered".
3. **Expect:** Error displayed: "QA sign-off required before delivery." Status does NOT change.

### TC-032 · Post-mortem [P1]
1. Open a project in "qa" or later status.
2. Click "+ Post-mortem".
3. Fill: Accuracy = 1.25, Client satisfaction = 8, On time = Yes, What worked = "Clear milestones", What broke = "Underestimated QA time", Root cause = "No prior mobile QA experience", Prevention = "Add mobile QA checklist to estimate template".
4. **Expect:** Post-mortem saved and shown on project detail. `/analytics` shows updated accuracy.

### TC-033 · Estimation drift warning [P2]
1. Set a project with estimatedHours = 100. Log 130h of actual hours via daily logs.
2. Open `/projects`.
3. **Expect:** Project card shows "Est. usage: 130%" in red.

---

## MODULE 5 — QA MODULE
*Test as: QA (Neha)*

### TC-034 · QA dashboard loads [P1]
1. Open `/qa`.
2. **Expect:** 4 KPI cards: Critical bugs open, Major bugs open, Projects ready for delivery, Client-reported bugs. Values match seed data.

### TC-035 · Client-reported bug alert visible [P1]
1. Seed data has a client-reported bug on PropList app.
2. **Expect:** Red alert banner at top of QA page shows the bug title. Same bug also flagged on main dashboard.

### TC-036 · QA weekly check-in [P1]
1. Open `/qa/checkin`. Select a project.
2. Fill: Total = 60, Passed = 48, Failed = 7, Pending = 5, Critical open = 0, Major open = 2, Minor open = 5, Closed = 8, Ready for delivery = No, Blocker = "Frontend not stable enough to test".
3. Submit.
4. **Expect:** Check-in saved. QA project page shows updated test counts. Pass rate = 80% (48/60). Blocker visible.

### TC-037 · Log a bug [P1]
1. Open `/qa/[projectId]`. Click "+ Log bug".
2. Fill: Title = "Submit button inactive on iOS 17", Severity = major, Type = ui, Environment = staging, Found by = Neha, Assign to = Vishal, Client reported = No.
3. **Expect:** Bug in table with "major" amber badge. Open bug count increments. Assigned to Vishal.

### TC-038 · Log client-reported bug [P1]
1. Log a bug with Client reported = YES.
2. **Expect:** "YES ⚠" in client column. Alert immediately visible on QA dashboard AND main dashboard flags. "Checklist miss" field shown.

### TC-039 · Update bug to fixed [P1]
1. Click "Update bug status".
2. Select the bug from TC-037. Status = fixed. Fix notes = "Added pointer-events fix for iOS".
3. **Expect:** Bug shows "fixed" badge in purple. Open count decrements. Fix notes visible.

### TC-040 · Verify a fixed bug [P1]
1. Update bug from TC-039 to status = verified. Verified by = Neha.
2. **Expect:** Bug shows "verified" teal badge. Neha's name shown as verifier.

### TC-041 · Sign-off blocked by open critical bugs [P1]
1. Open a project that has open critical bugs.
2. **Expect:** Red banner: "Cannot sign off: X critical bug(s) open." Sign-off button disabled or clicking shows error.

### TC-042 · Full QA sign-off [P1]
1. Close all critical and major bugs on a test project (mark all as "verified").
2. **Expect:** Green banner: "No critical or major bugs open. Ready to submit sign-off."
3. Click "Submit QA sign-off".
4. Tick all 8 checklist items. Quality score = 9. Notes = "Clean delivery, no blockers."
5. Submit.
6. **Expect:** Sign-off saved. Project QA page shows "QA signed off" with date and Neha's name.
7. Go to `/projects/[id]`. Update status to "delivered".
8. **Expect:** Status successfully changes to "delivered". No error.

### TC-043 · Sign-off API enforcement [P1]
1. Using browser devtools (Network tab), find the sign-off endpoint URL.
2. In console, run: `fetch('/api/qa/[projectId]/signoff', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({signedOffById:'any-id'})}).then(r=>r.json()).then(console.log)`
3. Test on a project that still has open critical/major bugs.
4. **Expect:** API returns `{error: "..."}` with status 422. Sign-off NOT created in DB.

### TC-044 · Pass rate calculation [P2]
1. Submit QA check-in: total=40, passed=34, failed=4, pending=2.
2. Open project QA page.
3. **Expect:** Pass rate shown as 85% (34/40 × 100). Green (≥90% = green, ≥70% = amber, else red).

---

## MODULE 6 — TEAM SCORECARDS
*Test as: Individual members and Founder*

### TC-045 · Team page loads [P1]
1. Open `/team`.
2. **Expect:** Score definitions shown. Scorecard table shows all active members. 5 dimension columns + Overall + vs last week trend. 6-week trend bars below for each member.

### TC-046 · Submit self-assessment [P1]
1. Click "+ Submit this week's score". Select Vishal.
2. Rate: Delivery=8, Process=7, Communication=9, Growth=7, Culture=8. Notes = "Good week overall". Repeated mistake = No.
3. **Expect:** Scores appear in table for Vishal. Overall = 7.8 (avg of 8+7+9+7+8÷5). Correct colour (green ≥8, amber 6–7, red <6).

### TC-047 · Colour coding accuracy [P1]
1. Submit a score with Delivery = 5 (below 6).
2. **Expect:** Delivery cell shows in red. Overall dragged down, reflected in overall colour.

### TC-048 · Upsert — same week overwrite [P2]
1. Submit scores for Vishal twice in the same week.
2. **Expect:** Second submission overwrites first. Only 1 record in DB. No duplicate row in table.

### TC-049 · Score trend direction [P2]
1. Ensure Vishal has scores for last week (from seed) and this week (from TC-046).
2. **Expect:** "vs last wk" column shows ▲ or ▼ with delta value in correct colour.

---

## MODULE 7 — WEEKLY CHECK-IN
*Test as: Each team member*

### TC-050 · Full 3-step check-in flow [P1]
1. Open `/checkin`. Step 1: click Vishal.
2. Step 2: Select "HealthSync Patient Portal". Progress = 68%, On track = Yes, Scope change = None, Client updated = Yes, no blockers.
3. Click "Save & continue".
4. Step 3: Rate all 5 dimensions. Notes = "Strong week". Repeated = No. Submit.
5. **Expect:** Success screen shows "EOD report due by 7pm." Dashboard shows updated weekly scores.

### TC-051 · Already submitted is disabled [P1]
1. After TC-050, return to `/checkin`.
2. **Expect:** Vishal's card shows "✓ Submitted" and is greyed/disabled. Cannot be selected again.

### TC-052 · Projects filtered by owner [P1]
1. In Step 2 as Vishal.
2. **Expect:** Only projects where Vishal is listed as owner appear in the dropdown. Projects in "delivered" or "cancelled" do NOT appear.

### TC-053 · Unlogged scope change creates flag [P2]
1. In check-in Step 2, select "Scope change = Yes — NOT logged yet".
2. Complete and submit check-in.
3. **Expect:** Dashboard and Intelligence show flag: "Scope change logged without CO" for that project.

---

## MODULE 8 — DAILY PLANNING
*Test as: Each team member*

### TC-054 · Morning plan submission [P1]
1. Open `/daily/plan`. Select Amit.
2. Add 3 tasks: (1) backend/"Fix price filter"/3h/high, (2) review/"Code review PR #42"/1.5h/medium, (3) meeting/"Sprint planning"/1h/low.
3. **Expect:** Live total shows 5.5h. No over-capacity warning.
4. Plan notes = "Blocked on Rahul's AR branch". Submit.
5. **Expect:** Success screen. "EOD due by 7pm" shown.

### TC-055 · Over-capacity warning [P1]
1. Add tasks totalling more than 8h.
2. **Expect:** Hours counter turns red. "Over capacity" warning appears. Can still submit (it's a warning).

### TC-056 · Already submitted marker [P1]
1. After TC-054, return to `/daily/plan`.
2. **Expect:** Amit's card shows "✓ Submitted" and is disabled. Others still selectable.

### TC-057 · Daily team view [P1]
1. Submit morning plans for 2+ people. Open `/daily`.
2. **Expect:** Each submitter shows a card with tasks, priority colour dots, type badges, hours.
3. **Expect:** Non-submitters listed in red "No morning plan" alert at top.

### TC-058 · EOD report [P1]
1. Open `/daily/eod`, find Amit's log (or follow success screen link).
2. For task 1: status = done, actual = 3.5h.
3. For task 2: status = partial, actual = 1h, notes = "Only reviewed half the PR".
4. For task 3: status = blocked, blocked reason = "Meeting cancelled, rescheduled".
5. Day rating = 2. Blockers = "Still waiting on AR branch". Carry over = "PR review moves to tomorrow".
6. Submit.
7. **Expect:** Success. Daily view shows "EOD done" badge. Tasks show status colours.

### TC-059 · Daily analytics — completion rate [P2]
1. After TC-058 (1 done, 1 partial, 1 blocked of 3).
2. Open `/daily/analytics`.
3. **Expect:** For that day, completion rate ≈ 33%. Bar chart reflects it.

### TC-060 · Blocker pattern categorisation [P2]
1. Multiple EODs with blockers containing "client" in the text.
2. Open `/daily/analytics`.
3. **Expect:** "Blocker patterns" section shows "Waiting on client" with count ≥ 1.

---

## MODULE 9 — INTELLIGENCE DASHBOARD
*Test as: Founder only*

### TC-061 · Intelligence page loads [P1]
1. Open `/intelligence`.
2. **Expect:** All 8 sections render: Project health, Open blockers, People vs goals, Why we lose leads, Where time goes, Estimation accuracy, Team productivity, Margin health. No crash.

### TC-062 · Critical project at top [P1]
1. E-commerce Rebuild in seed data is late/at-risk.
2. **Expect:** It appears at the TOP of the project health list (sorted critical first). Score ≤ 5 in red.

### TC-063 · Healthy project shows green [P1]
1. HealthSync Patient Portal in seed data is on-track.
2. **Expect:** Score ≥ 7, label = "healthy", green styling. Progress bars look reasonable (timeline, hours, milestones).

### TC-064 · Blocker age counter [P1]
1. In seed data, PropList App has a blocker from a check-in.
2. If no explicit blocker exists, create one via `/api/blockers` POST.
3. Manually set `raisedAt` to 2 days ago in Prisma Studio.
4. **Expect:** Intelligence page shows "2d open" in red for that blocker.

### TC-065 · Resolve blocker from page [P1]
1. With a blocker visible on Intelligence page, click "Resolve".
2. **Expect:** Blocker disappears from the list. No page crash.

### TC-066 · Escalate blocker [P1]
1. Click "Escalate" on an open blocker.
2. **Expect:** Blocker status updates to "escalated". May remain visible with escalated badge or move to a different section.

### TC-067 · Loss pattern requires analyses [P1]
1. Ensure at least 2 loss analyses exist (seed has 1; add a second via pipeline).
2. Open Intelligence page.
3. **Expect:** "Why we lose leads" section shows bar charts. Numbers match actual loss analysis records.

### TC-068 · Low activity — idle flag [P1]
1. Amit in seed data has low daily log hours.
2. **Expect:** Amit appears with red "Low activity" badge in Team Productivity section. He appears at the TOP (sorted by lowest utilisation).

### TC-069 · Phase time breakdown [P2]
1. Log daily tasks of different types via EOD (feature, bug, meeting).
2. Open Intelligence page.
3. **Expect:** "Where time goes" shows bars for each task type. Percentages add up to 100%.

### TC-070 · Margin health — over budget signal [P2]
1. Project with contractValue = 20000, estimatedHours = 200. Log 250 actual hours.
2. **Expect:** Margin health shows "Over budget" red badge for that project.

---

## MODULE 10 — GOALS / KRAs
*Test as: Founder (set), Members (update progress)*

### TC-071 · Create a goal [P1]
1. Open `/goals`. Click "+ Set goal".
2. Fill: Member = Vishal, Category = delivery, Quarter = Q3-2025, Title = "Zero client-reported bugs for 4 consecutive weeks", Success metric = "4 weeks with zero client-reported bugs logged", Target date = end of quarter.
3. **Expect:** Goal appears under Vishal's section. Progress bar at 0%. Status = "active".

### TC-072 · Update goal progress [P1]
1. Drag the slider to 50%.
2. **Expect:** Progress bar updates to 50% amber colour in real time.

### TC-073 · Mark goal achieved [P1]
1. Click "Mark achieved".
2. **Expect:** Goal shows "✓ Achieved" green badge. Action buttons disappear.

### TC-074 · Mark goal missed [P1]
1. Create another goal. Click "Mark missed".
2. **Expect:** Goal shows "✗ Missed" red badge.

### TC-075 · Goals shown on Intelligence page [P2]
1. Create 2 goals for Vishal.
2. Open `/intelligence`. Find "People vs goals" table row for Vishal.
3. **Expect:** Mini progress bars for Vishal's goals shown with truncated titles.

### TC-076 · Filter by member [P2]
1. Select Kavya from the member filter on `/goals`.
2. **Expect:** Only Kavya's goals shown.

---

## MODULE 11 — ANALYTICS
*Test as: Founder*

### TC-077 · Analytics page loads [P1]
1. Open `/analytics`.
2. **Expect:** All sections render: Win rate KPIs, BD performance table, Loss reason breakdown, Estimation accuracy table, Score trends table. No crash.

### TC-078 · Win rate calculation [P1]
1. Note the overall win rate from analytics.
2. Manually count: won leads ÷ (won + lost) leads from pipeline.
3. **Expect:** Numbers match.

### TC-079 · BD performance table [P1]
1. Check the BD performance table.
2. **Expect:** Only BD/Both/Founder members with at least one closed lead appear. Won/lost counts match pipeline. Won value matches sum of won budgets per owner.

### TC-080 · Loss breakdown charts [P1]
1. Add a second loss analysis with a different reason (e.g. price_too_high).
2. Open analytics.
3. **Expect:** Loss reason breakdown chart shows both reasons as bars. Bar lengths proportional to count.

### TC-081 · Estimation accuracy table [P2]
1. Ensure one delivered project has both estimatedHours and actualHours filled.
2. **Expect:** Table shows that project. Accuracy % = (actualHours / estimatedHours × 100). On-time shows ✓ or ✗. Score colour matches value.

---

## MODULE 12 — DATA INTEGRITY & EDGE CASES

### TC-082 · Required field validation [P1]
Test each form with missing required fields:
- Add lead with no client name → form should not save, required marker shown
- Add project with no owner → should not save
- Submit estimation with no lines (0 hours) → Confirm button disabled
- Submit weekly score without rating all 5 dimensions → button disabled
- Submit loss analysis with no reason selected → should not save

### TC-083 · Date display format [P1]
1. Check dates displayed throughout the app (lead dates, project dates, check-in dates).
2. **Expect:** All dates shown as "15 Jun 2025" format. No raw ISO strings (2025-06-15T00:00:00.000Z) ever visible to users.

### TC-084 · Currency display [P1]
1. Create a lead with currency = AED.
2. **Expect:** Budget displayed as "AED 15,000" or similar — not "$15,000". Consistent throughout pipeline and project views.

### TC-085 · Zero/null value display [P1]
1. Create a project with no contract value, no estimated hours.
2. View in projects list, project detail, Intelligence margin health.
3. **Expect:** Shows "—" everywhere, not "NaN", "$0", or blank. No crash.

### TC-086 · Concurrent check-in [P2]
1. Submit a check-in for Vishal for the same project this week.
2. Submit again with different values.
3. **Expect:** Second submission overwrites first (upsert). No duplicate records. No crash. Last values shown.

### TC-087 · Long text truncation [P2]
1. Enter 500+ character text in any notes/description field.
2. **Expect:** Saved correctly. In list/card views, text truncates with "…". In detail view, full text visible.

### TC-088 · Form cancel behaviour [P1]
1. Open any modal form. Fill some fields. Click "Cancel".
2. **Expect:** Modal closes. No data saved. No page crash. Previously visible data unchanged.

### TC-089 · Back navigation [P1]
1. From `/pipeline/[id]`, click "← Pipeline" breadcrumb.
2. From `/projects/[id]`, click "← Projects".
3. From `/qa/[id]`, click "← QA Dashboard".
4. **Expect:** Each takes you back to the correct parent page without errors.

---

## MODULE 13 — NAVIGATION & UX

### TC-090 · All nav links functional [P1]
Click every link in the top navigation:
- Dashboard, ⚡ Intelligence, BD Pipeline, Projects, QA, Team Scores, Check-In, Daily, Analytics, Goals
- **Expect:** Each page loads without error. Active link has dark background highlight.

### TC-091 · Page refresh preserves data [P1]
1. Navigate to any data-filled page.
2. Hard refresh (Ctrl/Cmd + Shift + R).
3. **Expect:** Data reloads correctly. No blank state where data exists.

### TC-092 · Mobile layout basics [P2]
1. Open in browser responsive mode at 375px width.
2. **Expect:** Nav is readable. Forms are usable. Cards stack vertically. No content overflows horizontally (tables may scroll, which is acceptable).

---

## MODULE 14 — PERFORMANCE

### TC-093 · Dashboard load time [P2]
1. Open dashboard with seed data.
2. **Expect:** Fully loaded in under 3 seconds on local machine.

### TC-094 · Intelligence page load [P2]
1. Open `/intelligence`.
2. **Expect:** Fully loaded in under 5 seconds. (Runs many queries — acceptable to be slower than other pages.)

---

## KNOWN LIMITATIONS — DO NOT RAISE AS BUGS

- All pages are publicly accessible — authentication is handled separately (next implementation step).
- `planMissed` / `eodMissed` flags are never set automatically (requires background cron job — not yet built).
- `ProjectHealthSnapshot` and `UtilisationWeek` models exist in schema but are computed on-the-fly, not stored.
- No email notifications sent for any events.
- No real-time updates — pages must be manually refreshed to see changes made by others.
- Prisma engine binaries require internet to download on first `npm install` / `prisma generate`. This is expected.

---

## BUG REPORT TEMPLATE

```
TC-ID: [e.g. TC-042]
Title: [brief description]
Priority: P1 / P2 / P3
Tester: [name]
Date: [date]

Steps to reproduce:
1.
2.
3.

Expected: [what should happen]
Actual: [what happened]
Error message (if any): [exact text or screenshot]
Browser + version: [e.g. Chrome 124]
```

---

## SIGN-OFF CHECKLIST

All P1 tests must PASS before go-live. P2 failures need a documented fix timeline.

| Module | P1 tests | Status |
|--------|----------|--------|
| Dashboard | 3 | |
| BD Pipeline | 8 | |
| Estimation | 9 | |
| Projects | 8 | |
| QA Module | 12 | |
| Team Scores | 3 | |
| Weekly Check-In | 3 | |
| Daily Planning | 5 | |
| Intelligence | 8 | |
| Goals / KRAs | 4 | |
| Analytics | 4 | |
| Data Integrity | 7 | |
| Navigation | 3 | |
| **TOTAL P1** | **85** | |

**QA Lead sign-off:** _________________________ Date: _____________
**Founder sign-off:** _________________________ Date: _____________
