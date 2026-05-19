# Next Steps - Testing Roadmap

**Last Updated:** May 19, 2026
**Current Status:** ✅ 21/21 tests passing (100%) - Foundation complete

---

## 📊 Current Progress

### Completed ✅
- **Testing Infrastructure** - Playwright, helpers, CI/CD pipeline
- **Authentication Tests** - 9 tests covering all roles and permissions
- **Milestone Tests** - 6 tests covering progress tracking and QA approval
- **Project Lifecycle Tests** - 6 tests covering full project flow
- **Test Coverage Mapping** - All 188 test cases documented in `tests/TEST_COVERAGE.md`

### Test Stats
- **Total tests implemented:** 21/188 (11%)
- **Pass rate:** 100%
- **Execution time:** ~45 seconds
- **Flaky tests:** 0

---

## 🎯 Next Priority: Implement Remaining Tests

### Phase 1: QA Module (12 tests) - HIGH PRIORITY
**File:** `tests/qa-module.spec.ts` (create new)

These tests are critical for QA workflow:

1. **TC-012:** Test cycle creation (sanity/regression/pre-release)
2. **TC-013:** Test cycle completion with pass/fail/conditional
3. **TC-014:** QA cannot sign off without passing test cycle
4. **TC-015:** Release sign-off with all checklist items
5. **TC-016:** Release sign-off with exceptions noted
6. **TC-017:** Quality score recording (1-10)
7. **TC-018:** Release notes capture
8. **TC-019:** Post-delivery issue creation (only after sign-off)
9. **TC-020:** Post-delivery issue severity tracking
10. **TC-021:** Post-delivery issue resolution tracking
11. **TC-022:** QA metrics calculation (avg quality score, issues per project)
12. **TC-023:** QA dashboard displays all projects correctly

**Estimated Time:** 3-4 hours

---

### Phase 2: Daily Workflows (7 tests) - MEDIUM PRIORITY
**File:** `tests/daily-workflows.spec.ts` (create new)

1. **TC-034:** Weekly check-in submission (Monday only)
2. **TC-035:** Prevent duplicate check-ins same week
3. **TC-036:** Check-in progress percentage validation
4. **TC-037:** Check-in blockers capture
5. **TC-038:** Daily standup task creation
6. **TC-039:** Daily standup task completion
7. **TC-040:** My Day page shows today's tasks

**Estimated Time:** 2-3 hours

---

### Phase 3: BD Pipeline (8 tests) - MEDIUM PRIORITY
**File:** `tests/bd-pipeline.spec.ts` (create new)

1. **TC-041:** Create new lead
2. **TC-042:** Lead qualification scoring
3. **TC-043:** Move lead through pipeline stages
4. **TC-044:** Create proposal for lead
5. **TC-045:** Proposal approval workflow
6. **TC-046:** Convert lead to project
7. **TC-047:** Loss analysis for rejected leads
8. **TC-048:** BD dashboard metrics (conversion rate, pipeline value)

**Estimated Time:** 3-4 hours

---

### Phase 4: Team & Analytics (remaining 140 tests)

See `tests/TEST_COVERAGE.md` for full breakdown:
- Intelligence & Analytics (15 tests)
- Team Management (10 tests)
- Settings & Configuration (8 tests)
- Notifications (6 tests)
- And more...

**Estimated Total Time:** 40-50 hours for all 188 tests

---

## 📁 Key Reference Files

### 1. **tests/STATUS.md** ⭐ MAIN REFERENCE
**Purpose:** Current test suite status
**Contains:**
- List of all passing tests
- Test coverage summary
- Performance metrics
- How to run tests locally

**Use this to:** See what's currently tested

---

### 2. **tests/TEST_COVERAGE.md** ⭐ ROADMAP
**Purpose:** Complete test coverage plan (188 tests)
**Contains:**
- All 188 test cases organized by module
- Test IDs (TC-001 to TC-188)
- Implementation status for each test
- Priority levels

**Use this to:** Pick next tests to implement

---

### 3. **tests/auth.spec.ts, tests/milestones.spec.ts, tests/project-lifecycle.spec.ts**
**Purpose:** Example test implementations
**Use these as:** Templates for writing new tests

**Common patterns to copy:**
```typescript
// Login helper
await login(page, TEST_USERS.qa)

// Database setup
const project = await createTestProject(dev.id)

// Database cleanup (automatic via global setup)

// Assertions
await expect(page.locator('text=...')).toBeVisible()
await expect(page).toHaveURL(/pattern/)
```

---

### 4. **tests/helpers/auth.ts**
**Contains:** Login/logout helpers, test user credentials

### 5. **tests/helpers/database.ts**
**Contains:** Database cleanup, seedTestUsers(), createTestProject()

### 6. **playwright.config.ts**
**Contains:** Test configuration, auto-start dev server

---

## 🚀 How to Continue Development

### Step 1: Pick Next Test Module
Look at `tests/TEST_COVERAGE.md` and choose a module (recommend starting with QA Module)

### Step 2: Create New Test File
```bash
# Create new test file
touch tests/qa-module.spec.ts
```

### Step 3: Copy Test Template
Use this template:
```typescript
import { test, expect } from '@playwright/test'
import { login, TEST_USERS } from './helpers/auth'
import { prisma } from './helpers/database'

test.describe('QA Module', () => {
  test('TC-012: should create test cycle', async ({ page }) => {
    // 1. Setup test data
    const users = await prisma.teamMember.findMany()
    const qa = users.find(u => u.role === 'QA')!

    // 2. Login
    await login(page, TEST_USERS.qa)

    // 3. Navigate to page
    await page.goto('/qa')

    // 4. Interact with UI
    await page.click('button:has-text("+ Log test cycle")')

    // 5. Fill form and submit
    // ...

    // 6. Assert results
    await expect(page.locator('text=Test cycle created')).toBeVisible()
  })
})
```

### Step 4: Run Your Test
```bash
# Run in headed mode to see what's happening
npm run test:headed -- qa-module.spec.ts

# Debug mode
npm run test:debug -- qa-module.spec.ts
```

### Step 5: Update STATUS.md
After adding tests, update the counts in `tests/STATUS.md`

---

## 🛠️ Useful Commands

```bash
# Run all tests
npm test

# Run specific file
npm test -- auth.spec.ts

# Run tests matching pattern
npm test -- -g "QA"

# Watch mode (re-run on file changes)
npm test -- --watch

# Generate HTML report
npm run test:report
```

---

## 💡 Tips for Writing Tests

### 1. Always Read Before Edit
```typescript
// DON'T guess selectors
await page.click('button')  // ❌

// DO inspect the actual component first
await page.click('button:has-text("+ Log test cycle")')  // ✅
```

### 2. Use Database Helpers
```typescript
// Clean test data setup
const project = await createTestProject(dev.id)
// Automatic cleanup via global teardown
```

### 3. Wait for Network Idle
```typescript
await page.goto('/projects')
await page.waitForLoadState('networkidle')  // ✅
```

### 4. Use Specific Selectors
```typescript
// Generic
page.locator('button')  // ❌

// Specific
page.locator('button:has-text("Submit")')  // ✅
page.getByRole('button', { name: 'Submit' })  // ✅✅
```

### 5. Test One Thing Per Test
```typescript
// Good
test('should create project', ...)
test('should update project', ...)

// Bad
test('should create and update and delete project', ...)
```

---

## 📈 Progress Tracking

Update this section as you add tests:

- [x] Phase 0: Infrastructure & Foundation (21 tests) ✅
- [ ] Phase 1: QA Module (12 tests) - **START HERE**
- [ ] Phase 2: Daily Workflows (7 tests)
- [ ] Phase 3: BD Pipeline (8 tests)
- [ ] Phase 4: Team & Analytics (remaining 140 tests)

---

## 🎯 Success Criteria

**Target:** 188/188 tests passing (100% coverage)

**Milestones:**
- ✅ 21 tests (11%) - DONE
- [ ] 50 tests (27%) - Foundation solid
- [ ] 100 tests (53%) - Core features covered
- [ ] 150 tests (80%) - Near complete
- [ ] 188 tests (100%) - Full coverage 🎉

---

## 📞 Questions?

- Check Playwright docs: https://playwright.dev
- Review existing tests for patterns
- Test selectors in browser DevTools first
- Use `--headed` mode to debug visually

---

**Start with:** `tests/TEST_COVERAGE.md` → Pick QA Module tests → Create `tests/qa-module.spec.ts`

**Good luck! The foundation is solid.** 🚀
