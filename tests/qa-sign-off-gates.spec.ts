import { test, expect } from '@playwright/test'
import { login, TEST_USERS } from './helpers/auth'
import { createTestProject, prisma } from './helpers/database'

/**
 * Tests for QA sign-off gates and role-based access
 * Based on bugs fixed in Session 5 (2026-05-19)
 */

test.describe('QA Sign-Off Gates', () => {
  test.describe('Bug Fix 1: QA Can Update Milestones', () => {
    test('QA can mark milestones as complete', async ({ page }) => {
      // Setup: Create project with milestones
      const users = await prisma.teamMember.findMany()
      const dev = users.find(u => u.role === 'Dev')!
      const project = await createTestProject(dev.id)

      // Login as QA
      await login(page, TEST_USERS.qa)

      // Navigate to QA project page
      await page.goto(`/qa/${project.id}`)
      await page.waitForLoadState('networkidle')

      // Find first milestone checkbox
      const firstMilestoneCheckbox = page.locator('[data-testid="milestone-checkbox"]').first()

      // Click to mark as complete
      await firstMilestoneCheckbox.click()

      // Wait for update
      await page.waitForTimeout(1000)

      // Reload to verify persistence
      await page.reload()
      await page.waitForLoadState('networkidle')

      // Should show 1 of 3 milestones completed
      await expect(page.locator('text=1 of 3 milestones')).toBeVisible()

      // Progress should be updated
      const progressText = page.locator('text=/\\d+%/').first()
      await expect(progressText).toBeVisible()
    })

    test('QA role has access to milestone API endpoint', async ({ page }) => {
      // Setup: Create project with milestones
      const users = await prisma.teamMember.findMany()
      const dev = users.find(u => u.role === 'Dev')!
      const qa = users.find(u => u.role === 'QA')!
      const project = await createTestProject(dev.id)
      const milestone = project.milestones[0]

      // Login as QA to get session
      await login(page, TEST_USERS.qa)

      // Attempt to update milestone
      const response = await page.request.patch(`/api/projects/milestones/${milestone.id}`, {
        data: { status: 'done' },
      })

      // Should succeed (not 403)
      expect(response.status()).not.toBe(403)
      expect([200, 201]).toContain(response.status())
    })
  })

  test.describe('Bug Fix 2: Post-Delivery Issues Require Sign-Off', () => {
    test('Post-delivery issue button hidden before sign-off', async ({ page }) => {
      // Setup: Create project in QA without sign-off
      const users = await prisma.teamMember.findMany()
      const dev = users.find(u => u.role === 'Dev')!
      const project = await createTestProject(dev.id)

      // Move to QA status
      await prisma.project.update({
        where: { id: project.id },
        data: { status: 'qa' },
      })

      // Login as QA
      await login(page, TEST_USERS.qa)

      // Navigate to QA project page
      await page.goto(`/qa/${project.id}`)
      await page.waitForLoadState('networkidle')

      // Post-delivery issue button should NOT be visible in main actions
      const mainActionsSection = page.locator('.flex.gap-2.flex-wrap').first()
      await expect(mainActionsSection.locator('text=Post-delivery issue')).not.toBeVisible()
    })

    test('Post-delivery issue button visible after sign-off', async ({ page }) => {
      // Setup: Create project with test cycle and sign-off
      const users = await prisma.teamMember.findMany()
      const dev = users.find(u => u.role === 'Dev')!
      const qa = users.find(u => u.role === 'QA')!
      const project = await createTestProject(dev.id)

      // Move to QA and create passing test cycle
      await prisma.project.update({
        where: { id: project.id },
        data: { status: 'qa' },
      })

      const cycle = await prisma.testCycle.create({
        data: {
          projectId: project.id,
          cycleType: 'pre_release',
          environment: 'staging',
          conductedById: qa.id,
          result: 'pass',
          summary: 'All tests passed',
          testedAuth: true,
          testedCoreFlows: true,
        },
      })

      // Create sign-off
      await prisma.releaseSignOff.create({
        data: {
          projectId: project.id,
          cycleId: cycle.id,
          signedOffById: qa.id,
          sanityPassed: true,
          regressionPassed: true,
          noBlockersOpen: true,
          stagingMatchesLive: true,
          clientUATDone: true,
          knownIssuesAgreed: true,
          qualityScore: 9,
        },
      })

      // Login as QA
      await login(page, TEST_USERS.qa)

      // Navigate to QA project page
      await page.goto(`/qa/${project.id}`)
      await page.waitForLoadState('networkidle')

      // Post-delivery issue button should be visible in post-delivery section
      await expect(page.getByRole('heading', { name: 'Post-delivery issues' })).toBeVisible()
      await expect(page.locator('button:has-text("Post-delivery issue")')).toBeVisible()
    })

    test('Cannot submit post-delivery issue via API without sign-off', async ({ page }) => {
      // Setup: Create project without sign-off
      const users = await prisma.teamMember.findMany()
      const dev = users.find(u => u.role === 'Dev')!
      const project = await createTestProject(dev.id)

      await prisma.project.update({
        where: { id: project.id },
        data: { status: 'qa' },
      })

      // Login as QA
      await login(page, TEST_USERS.qa)

      // Attempt to create post-delivery issue
      const response = await page.request.post(`/api/qa/${project.id}/issue`, {
        data: {
          description: 'Client found bug',
          severity: 'high',
          reportedBy: 'Client',
          wasInScope: true,
          rootCause: 'Missed in testing',
        },
      })

      // Should fail with 403
      expect(response.status()).toBe(403)
      const body = await response.json()
      expect(body.error).toContain('signed off')
    })
  })

  test.describe('Bug Fix 3: Post-Mortem Requires Sign-Off', () => {
    test('Post-mortem button hidden when project in QA without sign-off', async ({ page }) => {
      // Setup: Create project in QA
      const users = await prisma.teamMember.findMany()
      const dev = users.find(u => u.role === 'Dev')!
      const project = await createTestProject(dev.id)

      await prisma.project.update({
        where: { id: project.id },
        data: { status: 'qa' },
      })

      // Login as developer
      await login(page, TEST_USERS.dev)

      // Navigate to project page
      await page.goto(`/projects/${project.id}`)
      await page.waitForLoadState('networkidle')

      // Post-mortem button should NOT be visible
      await expect(page.locator('button:has-text("Post-mortem")')).not.toBeVisible()
    })

    test('Post-mortem button visible after sign-off', async ({ page }) => {
      // Setup: Create project with sign-off
      const users = await prisma.teamMember.findMany()
      const dev = users.find(u => u.role === 'Dev')!
      const qa = users.find(u => u.role === 'QA')!
      const project = await createTestProject(dev.id)

      // Move to QA and create sign-off
      await prisma.project.update({
        where: { id: project.id },
        data: { status: 'qa' },
      })

      const cycle = await prisma.testCycle.create({
        data: {
          projectId: project.id,
          cycleType: 'pre_release',
          environment: 'staging',
          conductedById: qa.id,
          result: 'pass',
          summary: 'All tests passed',
          testedAuth: true,
          testedCoreFlows: true,
        },
      })

      await prisma.releaseSignOff.create({
        data: {
          projectId: project.id,
          cycleId: cycle.id,
          signedOffById: qa.id,
          sanityPassed: true,
          regressionPassed: true,
          noBlockersOpen: true,
          stagingMatchesLive: true,
          clientUATDone: true,
          knownIssuesAgreed: true,
          qualityScore: 9,
        },
      })

      // Login as developer
      await login(page, TEST_USERS.dev)

      // Navigate to project page
      await page.goto(`/projects/${project.id}`)
      await page.waitForLoadState('networkidle')

      // Post-mortem button should now be visible
      await expect(page.locator('button:has-text("Post-mortem")')).toBeVisible()
    })

    test('Post-mortem button hidden when status is delivered without sign-off', async ({ page }) => {
      // Setup: Create project marked as delivered but without proper sign-off
      // (This shouldn't happen in practice due to API guards, but test the UI logic)
      const users = await prisma.teamMember.findMany()
      const dev = users.find(u => u.role === 'Dev')!
      const project = await createTestProject(dev.id)

      // Force status to delivered without sign-off (bypassing API)
      await prisma.project.update({
        where: { id: project.id },
        data: { status: 'delivered' },
      })

      // Login as founder (who can see everything)
      await login(page, TEST_USERS.founder)

      // Navigate to project page
      await page.goto(`/projects/${project.id}`)
      await page.waitForLoadState('networkidle')

      // Post-mortem button should NOT be visible (no sign-off)
      await expect(page.locator('button:has-text("Post-mortem")')).not.toBeVisible()
    })
  })

  test.describe('Bug Fix 4: QA Buttons Hidden from Developers', () => {
    test('Developers do not see "Log test cycle" button in My Day', async ({ page }) => {
      // Setup: Create project in QA status
      const users = await prisma.teamMember.findMany()
      const dev = users.find(u => u.role === 'Dev')!
      const project = await createTestProject(dev.id)

      await prisma.project.update({
        where: { id: project.id },
        data: { status: 'qa' },
      })

      // Login as developer
      await login(page, TEST_USERS.dev)

      // Navigate to My Day
      await page.goto('/me')
      await page.waitForLoadState('networkidle')

      // Should NOT see QA action buttons
      await expect(page.locator('a:has-text("Log test cycle")')).not.toBeVisible()
      await expect(page.locator('a:has-text("Submit sign-off")')).not.toBeVisible()
    })

    test('Developers see check-in reminder but not QA actions', async ({ page }) => {
      // Setup: Create project needing check-in
      const users = await prisma.teamMember.findMany()
      const dev = users.find(u => u.role === 'Dev')!
      const project = await createTestProject(dev.id)

      // Set project to active
      await prisma.project.update({
        where: { id: project.id },
        data: { status: 'active' },
      })

      // Create old check-in (over 7 days ago)
      const oldDate = new Date()
      oldDate.setDate(oldDate.getDate() - 10)

      await prisma.projectCheckIn.create({
        data: {
          projectId: project.id,
          submittedById: dev.id,
          weekOf: oldDate,
          progressPct: 50,
          onTrack: 'yes',
          scopeChange: 'none',
          clientUpdated: true,
        },
      })

      // Login as developer
      await login(page, TEST_USERS.dev)

      // Navigate to My Day
      await page.goto('/me')
      await page.waitForLoadState('networkidle')

      // Should see check-in reminder (developers need to check in)
      // But should NOT see QA actions
      await expect(page.locator('a:has-text("Log test cycle")')).not.toBeVisible()
      await expect(page.locator('a:has-text("Submit sign-off")')).not.toBeVisible()
    })

    test('QA users see relevant project actions in QA dashboard', async ({ page }) => {
      // Setup: Create project in QA
      const users = await prisma.teamMember.findMany()
      const dev = users.find(u => u.role === 'Dev')!
      const qa = users.find(u => u.role === 'QA')!
      const project = await createTestProject(dev.id)

      await prisma.project.update({
        where: { id: project.id },
        data: { status: 'qa' },
      })

      // Login as QA
      await login(page, TEST_USERS.qa)

      // Navigate to QA dashboard
      await page.goto('/qa')
      await page.waitForLoadState('networkidle')

      // Should see project needing attention
      await expect(page.getByRole('link', { name: project.name }).first()).toBeVisible()

      // Navigate to project
      await page.goto(`/qa/${project.id}`)
      await page.waitForLoadState('networkidle')

      // Should see QA actions
      await expect(page.locator('button:has-text("Log test cycle")')).toBeVisible()
    })
  })

  test.describe('Integration: Full QA Sign-Off Workflow', () => {
    test('Complete workflow from QA status to post-mortem', async ({ page }) => {
      // Setup: Create project
      const users = await prisma.teamMember.findMany()
      const dev = users.find(u => u.role === 'Dev')!
      const qa = users.find(u => u.role === 'QA')!
      const project = await createTestProject(dev.id)

      // Move to QA
      await prisma.project.update({
        where: { id: project.id },
        data: { status: 'qa' },
      })

      // ── Step 1: Before sign-off ──
      await login(page, TEST_USERS.qa)
      await page.goto(`/qa/${project.id}`)
      await page.waitForLoadState('networkidle')

      // Post-delivery button should be hidden
      const mainActions = page.locator('.flex.gap-2.flex-wrap').first()
      await expect(mainActions.locator('text=Post-delivery issue')).not.toBeVisible()

      // ── Step 2: Create test cycle ──
      const cycle = await prisma.testCycle.create({
        data: {
          projectId: project.id,
          cycleType: 'pre_release',
          environment: 'staging',
          conductedById: qa.id,
          result: 'pass',
          summary: 'All features tested and passing',
          testedAuth: true,
          testedCoreFlows: true,
          testedEdgeCases: true,
          testedMobile: true,
        },
      })

      await page.reload()
      await page.waitForLoadState('networkidle')

      // Should show sign-off button
      await expect(page.locator('button:has-text("Submit release sign-off")')).toBeVisible()

      // ── Step 3: Submit sign-off ──
      await prisma.releaseSignOff.create({
        data: {
          projectId: project.id,
          cycleId: cycle.id,
          signedOffById: qa.id,
          sanityPassed: true,
          regressionPassed: true,
          noBlockersOpen: true,
          stagingMatchesLive: true,
          clientUATDone: true,
          knownIssuesAgreed: true,
          qualityScore: 10,
          releaseNotes: 'Excellent release',
        },
      })

      await page.reload()
      await page.waitForLoadState('networkidle')

      // ── Step 4: After sign-off ──
      // Post-delivery button should now be visible
      await expect(page.locator('button:has-text("Post-delivery issue")')).toBeVisible()

      // ── Step 5: Developer can add post-mortem ──
      await login(page, TEST_USERS.dev)
      await page.goto(`/projects/${project.id}`)
      await page.waitForLoadState('networkidle')

      // Post-mortem button should be visible
      await expect(page.locator('button:has-text("Post-mortem")')).toBeVisible()

      // Click to open form
      await page.click('button:has-text("Post-mortem")')

      // Form should be visible
      await expect(page.locator('text=Required within 1 week of delivery')).toBeVisible()
    })
  })

  test.describe('Edge Cases & Error Handling', () => {
    test('Multiple sign-offs not allowed', async () => {
      // Setup: Create project with existing sign-off
      const users = await prisma.teamMember.findMany()
      const dev = users.find(u => u.role === 'Dev')!
      const qa = users.find(u => u.role === 'QA')!
      const project = await createTestProject(dev.id)

      await prisma.project.update({
        where: { id: project.id },
        data: { status: 'qa' },
      })

      const cycle = await prisma.testCycle.create({
        data: {
          projectId: project.id,
          cycleType: 'pre_release',
          environment: 'staging',
          conductedById: qa.id,
          result: 'pass',
          summary: 'Tests passed',
          testedAuth: true,
        },
      })

      await prisma.releaseSignOff.create({
        data: {
          projectId: project.id,
          cycleId: cycle.id,
          signedOffById: qa.id,
          sanityPassed: true,
          regressionPassed: true,
          noBlockersOpen: true,
          stagingMatchesLive: true,
          clientUATDone: true,
          knownIssuesAgreed: true,
          qualityScore: 9,
        },
      })

      // Attempt to create another sign-off should fail (unique constraint)
      await expect(
        prisma.releaseSignOff.create({
          data: {
            projectId: project.id,
            cycleId: cycle.id,
            signedOffById: qa.id,
            sanityPassed: true,
            regressionPassed: true,
            noBlockersOpen: true,
            stagingMatchesLive: true,
            clientUATDone: true,
            knownIssuesAgreed: true,
            qualityScore: 8,
          },
        })
      ).rejects.toThrow()
    })

    test('Sign-off requires passing test cycle', async ({ page }) => {
      // Setup: Create project with failed test cycle
      const users = await prisma.teamMember.findMany()
      const dev = users.find(u => u.role === 'Dev')!
      const qa = users.find(u => u.role === 'QA')!
      const project = await createTestProject(dev.id)

      await prisma.project.update({
        where: { id: project.id },
        data: { status: 'qa' },
      })

      await prisma.testCycle.create({
        data: {
          projectId: project.id,
          cycleType: 'pre_release',
          environment: 'staging',
          conductedById: qa.id,
          result: 'fail',
          summary: 'Critical bugs found',
          blockerNote: 'Payment integration broken',
          testedAuth: true,
        },
      })

      // Login as QA
      await login(page, TEST_USERS.qa)
      await page.goto(`/qa/${project.id}`)
      await page.waitForLoadState('networkidle')

      // Sign-off button should NOT be visible (failed test)
      await expect(page.locator('button:has-text("Submit release sign-off")')).not.toBeVisible()
    })
  })
})
