# Agency Ops E2E Testing

Automated end-to-end tests using Playwright to catch bugs before QA testing.

**Current Coverage:** 24/188 test cases (13%) | **Target:** 123/188 P1 cases (65%)
**See:** `TEST_COVERAGE.md` for complete mapping

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   npx playwright install
   ```

2. **Configure test environment:**
   - Copy `.env` to `.env.test`
   - Update `DATABASE_URL` to point to a separate test database
   ```env
   DATABASE_URL="postgresql://user:password@localhost:5432/agency_ops_test"
   ```

3. **Create test database:**
   ```bash
   # Create the test database
   createdb agency_ops_test

   # Push schema
   DATABASE_URL="postgresql://user:password@localhost:5432/agency_ops_test" npm run db:push
   ```

## Running Tests

```bash
# Run all tests (headless)
npm test

# Run tests with UI (see browser)
npm run test:headed

# Run tests in debug mode
npm run test:debug

# Run tests with interactive UI
npm run test:ui

# Run specific test file
npm test tests/auth.spec.ts

# Run tests matching pattern
npm test -- --grep "milestone"
```

## Test Structure

```
tests/
├── auth.spec.ts              # Authentication & permissions
├── milestones.spec.ts        # Milestone approval & progress
├── helpers/
│   ├── auth.ts              # Login/logout helpers
│   └── database.ts          # Database utilities
└── setup/
    ├── global-setup.ts      # Runs before all tests
    └── global-teardown.ts   # Runs after all tests
```

## Writing Tests

### Example test:
```typescript
import { test, expect } from '@playwright/test'
import { login, TEST_USERS } from './helpers/auth'

test('should create project', async ({ page }) => {
  await login(page, TEST_USERS.founder)
  await page.goto('/projects')
  await page.click('button:has-text("+ New project")')
  await page.fill('input[name="name"]', 'Test Project')
  await page.click('button:has-text("Create")')
  await expect(page.locator('text=Test Project')).toBeVisible()
})
```

## What's Tested

✅ **Auth & Permissions** (10 tests)
- Login/logout flows
- Role-based access control
- Session persistence

✅ **Milestones & Progress** (7 tests)
- QA milestone approval
- Progress calculation
- Display across all pages

✅ **Project Lifecycle** (7 tests)
- Project creation
- Scope changes (signed/unsigned)
- QA sign-off requirement
- Post-mortem creation
- Complete status flow (scoping → delivered)

🔄 **In Progress**
- Daily workflows (plan, EOD, check-in)
- BD Pipeline
- QA Module
- Estimation workflow

⬜ **Not Started (164 cases)**
See `TEST_COVERAGE.md` for complete list

## CI/CD Integration

Tests run automatically on:
- Every pull request
- Push to main branch
- Manual trigger via GitHub Actions

See `.github/workflows/test.yml` for configuration.

## Debugging Failed Tests

1. **Check screenshots:** `test-results/` folder contains screenshots of failures
2. **Watch video:** `test-results/` folder contains video recordings
3. **View HTML report:** `npm run test:report`
4. **Run in debug mode:** `npm run test:debug`

## Best Practices

1. **Isolate tests:** Each test should be independent
2. **Use helpers:** Reuse login, database helpers
3. **Clear names:** Test names should describe what they test
4. **Wait properly:** Use `waitForURL`, `waitForSelector` instead of fixed timeouts
5. **Clean data:** Tests reset database before running

## Adding New Tests

### Step-by-Step Process:

1. **Find test case in QA docs:**
   - Check `QA_TEST_SCENARIOS.md` or `QA_TEST_CASES_AUDIT_LOGGING.md`
   - Note the TC-ID (e.g., TC-054)

2. **Determine which spec file:**
   - Auth tests → `auth.spec.ts`
   - Project tests → `project-lifecycle.spec.ts`
   - QA tests → `qa.spec.ts`
   - Daily tests → `daily-workflows.spec.ts`
   - New module? Create new file: `[module].spec.ts`

3. **Write the test:**
   ```typescript
   test('TC-054: should submit morning plan', async ({ page }) => {
     await login(page, TEST_USERS.dev)
     await page.goto('/daily/plan')
     // ... test steps
     await expect(page.locator('text=Success')).toBeVisible()
   })
   ```

4. **Run and verify:**
   ```bash
   npm test tests/[your-file].spec.ts
   ```

5. **Update coverage map:**
   - Edit `TEST_COVERAGE.md`
   - Change status from ⬜ to ✅
   - Add test file name

6. **Commit:**
   ```bash
   git add .
   git commit -m "test: implement TC-054 - Morning plan submission"
   git push
   ```

### Test Writing Guidelines:

✅ **DO:**
- Use descriptive test names with TC-ID
- Use page object helpers (login, createTestProject, etc.)
- Wait for UI updates with `waitForTimeout` or `waitForURL`
- Test both success and error cases
- Verify data persists after page reload

❌ **DON'T:**
- Hardcode IDs or database values
- Skip database cleanup (global-setup handles this)
- Use fixed timeouts > 2000ms
- Test multiple unrelated things in one test
- Assume test order (each test should be independent)

### Example Test Template:

```typescript
test('TC-XXX: [description]', async ({ page }) => {
  // 1. Setup (create data if needed)
  const project = await createTestProject(devId)

  // 2. Login as appropriate role
  await login(page, TEST_USERS.founder)

  // 3. Navigate to page
  await page.goto(`/projects/${project.id}`)

  // 4. Perform action
  await page.click('button:has-text("Action")')
  await page.fill('input[name="field"]', 'value')
  await page.click('button:has-text("Submit")')

  // 5. Verify result
  await page.waitForTimeout(1000)
  await expect(page.locator('text=Success')).toBeVisible()

  // 6. Verify persistence (optional)
  await page.reload()
  await expect(page.locator('text=value')).toBeVisible()
})
```

## Troubleshooting

**Tests timing out:**
- Check if dev server is running on port 3004
- Verify test database is accessible
- Increase timeout in playwright.config.ts

**Database errors:**
- Ensure test database exists
- Run `npm run db:push` with test DATABASE_URL
- Check connection string in .env.test

**Login failing:**
- Verify test users were seeded (check global-setup.ts)
- Check password hashing matches production code
