# E2E Test Coverage Map

**Last Updated:** 2026-05-19
**Total QA Test Cases:** 188 (144 main + 44 audit)
**Automated:** 17
**Coverage:** 9%
**Target:** 100% of P1 cases (85 main + 38 audit = 123 P1 cases)

---

## Coverage Status

✅ = Automated | 🔄 = In Progress | ⬜ = Not Started

---

## MODULE 1: CEO DASHBOARD (6 test cases)

| TC-ID | Priority | Description | E2E File | Status |
|-------|----------|-------------|----------|--------|
| TC-001 | P1 | Dashboard loads with seed data | `dashboard.spec.ts` | ⬜ |
| TC-002 | P1 | Dashboard flags are accurate | `dashboard.spec.ts` | ⬜ |
| TC-003 | P1 | KPI win rate calculation | `dashboard.spec.ts` | ⬜ |
| TC-004 | P2 | Empty database state | `dashboard.spec.ts` | ⬜ |

---

## MODULE 2: BD PIPELINE (9 test cases)

| TC-ID | Priority | Description | E2E File | Status |
|-------|----------|-------------|----------|--------|
| TC-005 | P1 | Pipeline page loads | `pipeline.spec.ts` | ⬜ |
| TC-006 | P1 | Filter by status | `pipeline.spec.ts` | ⬜ |
| TC-007 | P1 | Add new lead | `pipeline.spec.ts` | ⬜ |
| TC-008 | P1 | Lead detail page | `pipeline.spec.ts` | ⬜ |
| TC-009 | P1 | Add proposal | `pipeline.spec.ts` | ⬜ |
| TC-010 | P1 | Update lead status | `pipeline.spec.ts` | ⬜ |
| TC-011 | P1 | Loss analysis warning | `pipeline.spec.ts` | ⬜ |
| TC-012 | P1 | Add loss analysis | `pipeline.spec.ts` | ⬜ |
| TC-013 | P2 | Estimation warning | `pipeline.spec.ts` | ⬜ |

---

## MODULE 3: ESTIMATION FLOW (11 test cases)

| TC-ID | Priority | Description | E2E File | Status |
|-------|----------|-------------|----------|--------|
| TC-014 | P1 | BD requests estimation | `estimation.spec.ts` | ⬜ |
| TC-015 | P1 | Developer fills breakdown | `estimation.spec.ts` | ⬜ |
| TC-016 | P1 | Over-budget warning | `estimation.spec.ts` | ⬜ |
| TC-017 | P1 | Developer confirms estimate | `estimation.spec.ts` | ⬜ |
| TC-018 | P1 | BD approves estimate | `estimation.spec.ts` | ⬜ |
| TC-019 | P1 | BD sends for revision | `estimation.spec.ts` | ⬜ |
| TC-020 | P1 | Risk flag behaviour | `estimation.spec.ts` | ⬜ |
| TC-021 | P1 | Phase grouping in review | `estimation.spec.ts` | ⬜ |
| TC-022 | P1 | Confirmation sign-off trail | `estimation.spec.ts` | ⬜ |
| TC-023 | P2 | Empty form validation | `estimation.spec.ts` | ⬜ |
| TC-024 | P2 | Actual vs estimated post-delivery | `estimation.spec.ts` | ⬜ |

---

## MODULE 4: PROJECTS (9 test cases)

| TC-ID | Priority | Description | E2E File | Status |
|-------|----------|-------------|----------|--------|
| TC-025 | P1 | Projects page loads | `project-lifecycle.spec.ts` | ⬜ |
| TC-026 | P1 | Create new project | `project-lifecycle.spec.ts` | ⬜ |
| TC-027 | P1 | Add milestone | `milestones.spec.ts` | ✅ |
| TC-028 | P1 | Weekly check-in | `daily-workflows.spec.ts` | ⬜ |
| TC-029 | P1 | Log scope change - unsigned | `project-lifecycle.spec.ts` | ⬜ |
| TC-030 | P1 | Log scope change - signed | `project-lifecycle.spec.ts` | ⬜ |
| TC-031 | P1 | Block delivery without QA sign-off | `project-lifecycle.spec.ts` | ⬜ |
| TC-032 | P1 | Post-mortem | `project-lifecycle.spec.ts` | ⬜ |
| TC-033 | P2 | Estimation drift warning | `project-lifecycle.spec.ts` | ⬜ |

---

## MODULE 5: QA MODULE (11 test cases)

| TC-ID | Priority | Description | E2E File | Status |
|-------|----------|-------------|----------|--------|
| TC-034 | P1 | QA dashboard loads | `qa.spec.ts` | ⬜ |
| TC-035 | P1 | Client-reported bug alert | `qa.spec.ts` | ⬜ |
| TC-036 | P1 | QA weekly check-in | `qa.spec.ts` | ⬜ |
| TC-037 | P1 | Log a bug | `qa.spec.ts` | ⬜ |
| TC-038 | P1 | Log client-reported bug | `qa.spec.ts` | ⬜ |
| TC-039 | P1 | Update bug to fixed | `qa.spec.ts` | ⬜ |
| TC-040 | P1 | Verify a fixed bug | `qa.spec.ts` | ⬜ |
| TC-041 | P1 | Sign-off blocked by critical bugs | `qa.spec.ts` | ⬜ |
| TC-042 | P1 | Full QA sign-off | `milestones.spec.ts` | ✅ (partial) |
| TC-043 | P1 | Sign-off API enforcement | `qa.spec.ts` | ⬜ |
| TC-044 | P2 | Pass rate calculation | `qa.spec.ts` | ⬜ |

---

## MODULE 6: TEAM SCORECARDS (5 test cases)

| TC-ID | Priority | Description | E2E File | Status |
|-------|----------|-------------|----------|--------|
| TC-045 | P1 | Team page loads | `team.spec.ts` | ⬜ |
| TC-046 | P1 | Submit self-assessment | `team.spec.ts` | ⬜ |
| TC-047 | P1 | Colour coding accuracy | `team.spec.ts` | ⬜ |
| TC-048 | P2 | Upsert - same week overwrite | `team.spec.ts` | ⬜ |
| TC-049 | P2 | Score trend direction | `team.spec.ts` | ⬜ |

---

## MODULE 7: WEEKLY CHECK-IN (4 test cases)

| TC-ID | Priority | Description | E2E File | Status |
|-------|----------|-------------|----------|--------|
| TC-050 | P1 | Full 3-step check-in flow | `daily-workflows.spec.ts` | ⬜ |
| TC-051 | P1 | Already submitted is disabled | `auth.spec.ts` | ✅ (similar) |
| TC-052 | P1 | Projects filtered by owner | `daily-workflows.spec.ts` | ⬜ |
| TC-053 | P2 | Unlogged scope change creates flag | `daily-workflows.spec.ts` | ⬜ |

---

## MODULE 8: DAILY PLANNING (7 test cases)

| TC-ID | Priority | Description | E2E File | Status |
|-------|----------|-------------|----------|--------|
| TC-054 | P1 | Morning plan submission | `daily-workflows.spec.ts` | ⬜ |
| TC-055 | P1 | Over-capacity warning | `daily-workflows.spec.ts` | ⬜ |
| TC-056 | P1 | Already submitted marker | `daily-workflows.spec.ts` | ⬜ |
| TC-057 | P1 | Daily team view | `daily-workflows.spec.ts` | ⬜ |
| TC-058 | P1 | EOD report | `daily-workflows.spec.ts` | ⬜ |
| TC-059 | P2 | Daily analytics - completion rate | `daily-workflows.spec.ts` | ⬜ |
| TC-060 | P2 | Blocker pattern categorisation | `daily-workflows.spec.ts` | ⬜ |

---

## MODULE 9: INTELLIGENCE DASHBOARD (10 test cases)

| TC-ID | Priority | Description | E2E File | Status |
|-------|----------|-------------|----------|--------|
| TC-061 | P1 | Intelligence page loads | `intelligence.spec.ts` | ⬜ |
| TC-062 | P1 | Critical project at top | `intelligence.spec.ts` | ⬜ |
| TC-063 | P1 | Healthy project shows green | `intelligence.spec.ts` | ⬜ |
| TC-064 | P1 | Blocker age counter | `intelligence.spec.ts` | ⬜ |
| TC-065 | P1 | Resolve blocker from page | `intelligence.spec.ts` | ⬜ |
| TC-066 | P1 | Escalate blocker | `intelligence.spec.ts` | ⬜ |
| TC-067 | P1 | Loss pattern requires analyses | `intelligence.spec.ts` | ⬜ |
| TC-068 | P1 | Low activity - idle flag | `intelligence.spec.ts` | ⬜ |
| TC-069 | P2 | Phase time breakdown | `intelligence.spec.ts` | ⬜ |
| TC-070 | P2 | Margin health - over budget signal | `intelligence.spec.ts` | ⬜ |

---

## MODULE 10: GOALS / KRAS (6 test cases)

| TC-ID | Priority | Description | E2E File | Status |
|-------|----------|-------------|----------|--------|
| TC-071 | P1 | Create a goal | `goals.spec.ts` | ⬜ |
| TC-072 | P1 | Update goal progress | `goals.spec.ts` | ⬜ |
| TC-073 | P1 | Mark goal achieved | `goals.spec.ts` | ⬜ |
| TC-074 | P1 | Mark goal missed | `goals.spec.ts` | ⬜ |
| TC-075 | P2 | Goals shown on Intelligence page | `goals.spec.ts` | ⬜ |
| TC-076 | P2 | Filter by member | `goals.spec.ts` | ⬜ |

---

## MODULE 11: ANALYTICS (5 test cases)

| TC-ID | Priority | Description | E2E File | Status |
|-------|----------|-------------|----------|--------|
| TC-077 | P1 | Analytics page loads | `analytics.spec.ts` | ⬜ |
| TC-078 | P1 | Win rate calculation | `analytics.spec.ts` | ⬜ |
| TC-079 | P1 | BD performance table | `analytics.spec.ts` | ⬜ |
| TC-080 | P1 | Loss breakdown charts | `analytics.spec.ts` | ⬜ |
| TC-081 | P2 | Estimation accuracy table | `analytics.spec.ts` | ⬜ |

---

## MODULE 12: DATA INTEGRITY (8 test cases)

| TC-ID | Priority | Description | E2E File | Status |
|-------|----------|-------------|----------|--------|
| TC-082 | P1 | Required field validation | `data-integrity.spec.ts` | ⬜ |
| TC-083 | P1 | Date display format | `data-integrity.spec.ts` | ⬜ |
| TC-084 | P1 | Currency display | `data-integrity.spec.ts` | ⬜ |
| TC-085 | P1 | Zero/null value display | `data-integrity.spec.ts` | ⬜ |
| TC-086 | P2 | Concurrent check-in | `data-integrity.spec.ts` | ⬜ |
| TC-087 | P2 | Long text truncation | `data-integrity.spec.ts` | ⬜ |
| TC-088 | P1 | Form cancel behaviour | `data-integrity.spec.ts` | ⬜ |
| TC-089 | P1 | Back navigation | `data-integrity.spec.ts` | ⬜ |

---

## MODULE 13: NAVIGATION & UX (3 test cases)

| TC-ID | Priority | Description | E2E File | Status |
|-------|----------|-------------|----------|--------|
| TC-090 | P1 | All nav links functional | `navigation.spec.ts` | ⬜ |
| TC-091 | P1 | Page refresh preserves data | `navigation.spec.ts` | ⬜ |
| TC-092 | P2 | Mobile layout basics | `navigation.spec.ts` | ⬜ |

---

## MODULE 14: PERFORMANCE (2 test cases)

| TC-ID | Priority | Description | E2E File | Status |
|-------|----------|-------------|----------|--------|
| TC-093 | P2 | Dashboard load time | `performance.spec.ts` | ⬜ |
| TC-094 | P2 | Intelligence page load | `performance.spec.ts` | ⬜ |

---

## AUDIT & LOGGING MODULE (44 test cases)

### File Logging System (8 tests)
| TC-ID | Priority | Description | E2E File | Status |
|-------|----------|-------------|----------|--------|
| TC-LOG-001 | P1 | Enable file logging | `audit-logging.spec.ts` | ⬜ |
| TC-LOG-002 | P2 | Disable file logging | `audit-logging.spec.ts` | ⬜ |
| TC-LOG-003 | P1 | Log levels - INFO | `audit-logging.spec.ts` | ⬜ |
| TC-LOG-004 | P1 | Log levels - ERROR | `audit-logging.spec.ts` | ⬜ |
| TC-LOG-005 | P1 | API request logging | `audit-logging.spec.ts` | ⬜ |
| TC-LOG-006 | P1 | Notification logging | `audit-logging.spec.ts` | ⬜ |
| TC-LOG-007 | P2 | Log file rotation | `audit-logging.spec.ts` | ⬜ |
| TC-LOG-008 | P2 | Large log entry truncation | `audit-logging.spec.ts` | ⬜ |

### Audit Log Creation (12 tests)
| TC-ID | Priority | Description | E2E File | Status |
|-------|----------|-------------|----------|--------|
| TC-AUDIT-001 | P1 | Team member creation audit | `audit-logging.spec.ts` | ⬜ |
| TC-AUDIT-002 | P1 | Team member role change audit | `audit-logging.spec.ts` | ⬜ |
| TC-AUDIT-003 | P1 | Team member deactivation audit | `audit-logging.spec.ts` | ⬜ |
| TC-AUDIT-004 | P1 | Password change audit | `audit-logging.spec.ts` | ⬜ |
| TC-AUDIT-005 | P1 | Project status change audit | `audit-logging.spec.ts` | ⬜ |
| TC-AUDIT-006 | P1 | Project delivered audit | `audit-logging.spec.ts` | ⬜ |
| TC-AUDIT-007 | P1 | QA test cycle audit | `audit-logging.spec.ts` | ⬜ |
| TC-AUDIT-008 | P1 | QA release sign-off audit | `audit-logging.spec.ts` | ⬜ |
| TC-AUDIT-009 | P2 | Multiple changes in one action | `audit-logging.spec.ts` | ⬜ |
| TC-AUDIT-010 | P2 | System action (no user) | `audit-logging.spec.ts` | ⬜ |
| TC-AUDIT-011 | P2 | Concurrent audit logs | `audit-logging.spec.ts` | ⬜ |
| TC-AUDIT-012 | P2 | Audit log on failed action | `audit-logging.spec.ts` | ⬜ |

### System-wide Audit Viewer (10 tests)
| TC-ID | Priority | Description | E2E File | Status |
|-------|----------|-------------|----------|--------|
| TC-VIEWER-001 | P1 | Access audit log as Founder | `audit-logging.spec.ts` | ⬜ |
| TC-VIEWER-002 | P1 | Access denied for non-Founder | `audit-logging.spec.ts` | ⬜ |
| TC-VIEWER-003 | P1 | Filter by user | `audit-logging.spec.ts` | ⬜ |
| TC-VIEWER-004 | P1 | Filter by entity type | `audit-logging.spec.ts` | ⬜ |
| TC-VIEWER-005 | P1 | Filter by action | `audit-logging.spec.ts` | ⬜ |
| TC-VIEWER-006 | P1 | Date range filter | `audit-logging.spec.ts` | ⬜ |
| TC-VIEWER-007 | P1 | Search functionality | `audit-logging.spec.ts` | ⬜ |
| TC-VIEWER-008 | P2 | Pagination | `audit-logging.spec.ts` | ⬜ |
| TC-VIEWER-009 | P1 | View details modal | `audit-logging.spec.ts` | ⬜ |
| TC-VIEWER-010 | P2 | Export to CSV | `audit-logging.spec.ts` | ⬜ |

### Entity-specific Audit Trails (8 tests)
| TC-ID | Priority | Description | E2E File | Status |
|-------|----------|-------------|----------|--------|
| TC-ENTITY-001 | P1 | Project history display | `audit-logging.spec.ts` | ⬜ |
| TC-ENTITY-002 | P1 | Lead activity history display | `audit-logging.spec.ts` | ⬜ |
| TC-ENTITY-003 | P1 | QA history display | `audit-logging.spec.ts` | ⬜ |
| TC-ENTITY-004 | P2 | Expand/collapse audit trail | `audit-logging.spec.ts` | ⬜ |
| TC-ENTITY-005 | P1 | Entity audit detail modal | `audit-logging.spec.ts` | ⬜ |
| TC-ENTITY-006 | P2 | No history message | `audit-logging.spec.ts` | ⬜ |
| TC-ENTITY-007 | P1 | Access control - entity trail | `audit-logging.spec.ts` | ⬜ |
| TC-ENTITY-008 | P2 | Real-time update after change | `audit-logging.spec.ts` | ⬜ |

### Audit Log Security (6 tests)
| TC-ID | Priority | Description | E2E File | Status |
|-------|----------|-------------|----------|--------|
| TC-SEC-001 | P1 | Immutability - no edit | `audit-logging.spec.ts` | ⬜ |
| TC-SEC-002 | P1 | Immutability - no delete | `audit-logging.spec.ts` | ⬜ |
| TC-SEC-003 | P1 | Sensitive data not logged | `audit-logging.spec.ts` | ⬜ |
| TC-SEC-004 | P1 | User deletion handling | `audit-logging.spec.ts` | ⬜ |
| TC-SEC-005 | P2 | IP address logging | `audit-logging.spec.ts` | ⬜ |
| TC-SEC-006 | P2 | User agent logging | `audit-logging.spec.ts` | ⬜ |

---

## AUTHENTICATION & PERMISSIONS (Currently Implemented)

| Test | Description | File | Status |
|------|-------------|------|--------|
| ✅ | Login with valid credentials | `auth.spec.ts` | ✅ |
| ✅ | Login with invalid credentials | `auth.spec.ts` | ✅ |
| ✅ | Logout flow | `auth.spec.ts` | ✅ |
| ✅ | Redirect when not authenticated | `auth.spec.ts` | ✅ |
| ✅ | Session persistence | `auth.spec.ts` | ✅ |
| ✅ | Founder access all pages | `auth.spec.ts` | ✅ |
| ✅ | Dev role-based access | `auth.spec.ts` | ✅ |
| ✅ | QA role-based access | `auth.spec.ts` | ✅ |
| ✅ | BD role-based access | `auth.spec.ts` | ✅ |

---

## MILESTONES & PROGRESS (Currently Implemented)

| Test | Description | File | Status |
|------|-------------|------|--------|
| ✅ | QA can approve milestones | `milestones.spec.ts` | ✅ |
| ✅ | Progress updates after approval | `milestones.spec.ts` | ✅ |
| ✅ | Progress on project detail page | `milestones.spec.ts` | ✅ |
| ✅ | Progress on My Day page | `milestones.spec.ts` | ✅ |
| ✅ | Progress on projects list | `milestones.spec.ts` | ✅ |
| ✅ | Developers cannot approve | `milestones.spec.ts` | ✅ |
| ✅ | Overdue milestone warning | `milestones.spec.ts` | ✅ |

---

## Summary

**Main QA Scenarios:**
- Total: 94 test cases
- P1: 85 cases
- Automated: 10 cases (12%)
- Remaining: 84 cases

**Audit & Logging:**
- Total: 44 test cases
- P1: 38 cases
- Automated: 0 cases (0%)
- Remaining: 44 cases

**Overall:**
- **Total: 188 test cases**
- **Automated: 17 (9%)**
- **P1 Priority: 123 cases**
- **P1 Automated: 9 (7%)**

---

## Implementation Priority

### Phase 1: Critical Flows (Weeks 1-2)
- Project lifecycle (TC-026 to TC-032)
- QA workflow (TC-034 to TC-042)
- Daily planning & EOD (TC-054 to TC-058)
- Check-in flow (TC-050 to TC-052)

### Phase 2: Core Features (Weeks 3-4)
- BD Pipeline (TC-005 to TC-012)
- Estimation flow (TC-014 to TC-022)
- Team scorecards (TC-045 to TC-047)
- Data integrity (TC-082 to TC-089)

### Phase 3: Intelligence & Analytics (Week 5)
- Intelligence dashboard (TC-061 to TC-068)
- Analytics (TC-077 to TC-080)
- Goals (TC-071 to TC-074)

### Phase 4: Audit & Logging (Week 6)
- All audit test cases (TC-LOG-001 to TC-SEC-006)

---

## How to Add New Tests

1. **Add test case to appropriate spec file**
2. **Update this coverage map**
3. **Run test:** `npm test tests/[filename].spec.ts`
4. **Verify passes**
5. **Commit with TC-ID in message**

Example:
```bash
# Add test to project-lifecycle.spec.ts
npm test tests/project-lifecycle.spec.ts
# Mark ✅ in this document
git commit -m "test: implement TC-029 - Log unsigned scope change"
```

---

## Target Milestones

- **End of Month 1:** 50% P1 coverage (62 tests)
- **End of Month 2:** 100% P1 coverage (123 tests)
- **End of Month 3:** 100% total coverage (188 tests)
