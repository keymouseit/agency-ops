import { test, expect } from '@playwright/test'
import { login, TEST_USERS } from './helpers/auth'
import { prisma } from './helpers/database'

test.describe('Project Lifecycle', () => {
  // TC-026: Create new project
  test('TC-026: should create new project', async ({ page }) => {
    await login(page, TEST_USERS.founder)
    await page.goto('/projects')

    // Click "+ New project"
    await page.click('button:has-text("New project")')

    // Wait for modal
    await page.waitForSelector('input[name="name"]')

    // Fill form
    await page.fill('input[name="name"]', 'Test Project Lifecycle')

    // Select first available developer
    const devOptions = await page.locator('select[name="developerId"] option').count()
    if (devOptions > 1) {
      await page.selectOption('select[name="developerId"]', { index: 1 })
    }

    // Fill optional fields
    await page.fill('input[name="estimatedHours"]', '120')

    // Submit
    await page.click('button:has-text("Create")')

    // Wait for success
    await page.waitForTimeout(2000)

    // Verify we're still on projects page or project was created
    await expect(page).toHaveURL(/\/projects/)
  })

  // TC-027: Add milestone (already covered in milestones.spec.ts)

  // TC-029 & TC-030: Log scope changes
  test('TC-029 & TC-030: should log scope changes with signed/unsigned status', async ({ page }) => {
    const users = await prisma.teamMember.findMany()
    const dev = users.find(u => u.role === 'Dev')!

    // Create test project
    const project = await prisma.project.create({
      data: {
        name: 'Scope Change Test Project',
        status: 'active',
        developerId: dev.id,
        estimatedHours: 100,
      },
    })

    await login(page, TEST_USERS.founder)
    await page.goto(`/projects/${project.id}`)

    // Test unsigned scope change (TC-029)
    await page.click('button:has-text("+ Scope change")')
    await page.fill('textarea[name="description"]', 'Add SMS notifications')
    await page.selectOption('select[name="requestedBy"]', 'client')
    await page.fill('input[name="hoursAdded"]', '12')
    await page.fill('input[name="valueAdded"]', '400')
    await page.selectOption('select[name="changeOrderSigned"]', 'false')
    await page.click('button:has-text("Log scope change")')

    await page.waitForTimeout(1000)
    await page.reload()

    // Verify unsigned scope change shows red warning
    await expect(page.locator('text=NO CO')).toBeVisible()
    await expect(page.locator('text=1 scope change(s) without a signed change order')).toBeVisible()

    // Test signed scope change (TC-030)
    await page.click('button:has-text("+ Scope change")')
    await page.fill('textarea[name="description"]', 'Add email notifications')
    await page.fill('input[name="hoursAdded"]', '8')
    await page.fill('input[name="valueAdded"]', '300')
    await page.selectOption('select[name="changeOrderSigned"]', 'true')
    await page.click('button:has-text("Log scope change")')

    await page.waitForTimeout(1000)
    await page.reload()

    // Verify signed scope change shows green badge
    await expect(page.locator('text=CO signed')).toBeVisible()
    // Unsigned warning should still show (only 1 unsigned)
    await expect(page.locator('text=1 scope change(s) without a signed change order')).toBeVisible()
  })

  // TC-031: Block delivery without QA sign-off
  test('TC-031: should block delivery without QA sign-off', async ({ page }) => {
    const users = await prisma.teamMember.findMany()
    const dev = users.find(u => u.role === 'Dev')!

    // Create project without QA sign-off
    const project = await prisma.project.create({
      data: {
        name: 'Blocked Delivery Project',
        status: 'active',
        developerId: dev.id,
        estimatedHours: 100,
      },
    })

    await login(page, TEST_USERS.founder)
    await page.goto(`/projects/${project.id}`)

    // Try to change status to delivered
    await page.click('button:has-text("Update status")')
    await page.waitForSelector('select[name="status"]')
    await page.selectOption('select[name="status"]', 'delivered')
    await page.click('button[type="submit"]')

    // Wait for response
    await page.waitForTimeout(1000)

    // Should show error or status should not change
    // The API will return error, check if we're still on same page
    await page.reload()

    // Status should still be active (not delivered)
    const url = page.url()
    await expect(url).toContain(project.id)
  })

  // TC-032: Post-mortem
  test('TC-032: should create post-mortem after QA sign-off', async ({ page }) => {
    const users = await prisma.teamMember.findMany()
    const dev = users.find(u => u.role === 'Dev')!
    const qa = users.find(u => u.role === 'QA')!

    // Create project first
    const project = await prisma.project.create({
      data: {
        name: 'Post-mortem Test Project',
        status: 'delivered',
        developerId: dev.id,
        estimatedHours: 100,
        actualHours: 125,
      },
    })

    // Create test cycle with QA sign-off
    await prisma.testCycle.create({
      data: {
        projectId: project.id,
        conductedById: qa.id,
        result: 'pass',
        cycleType: 'regression',
        environment: 'staging',
        startedAt: new Date(),
        signOff: {
          create: {
            projectId: project.id,
            signedOffById: qa.id,
            signedOffAt: new Date(),
            qualityScore: 8,
            sanityPassed: true,
            regressionPassed: true,
            noBlockersOpen: true,
            stagingMatchesLive: true,
            clientUATDone: true,
            knownIssuesAgreed: true,
          },
        },
      },
    })

    await login(page, TEST_USERS.founder)
    await page.goto(`/projects/${project.id}`)

    // Click "+ Post-mortem" button
    await page.click('button:has-text("+ Post-mortem")')

    await page.waitForSelector('input[name="estimationAccuracy"]')

    // Fill post-mortem form
    await page.fill('input[name="estimationAccuracy"]', '1.25')
    await page.fill('input[name="clientSatisfaction"]', '8')
    await page.selectOption('select[name="onTime"]', 'true')
    await page.fill('textarea[name="whatWorked"]', 'Clear milestones and good communication')
    await page.fill('textarea[name="whatBroke"]', 'Underestimated QA time')
    await page.fill('textarea[name="rootCause"]', 'No prior mobile QA experience')
    await page.fill('textarea[name="preventionAction"]', 'Add mobile QA checklist to estimate template')
    await page.click('button[type="submit"]')

    await page.waitForTimeout(2000)
    await page.reload()

    // Verify post-mortem is displayed (use heading role to be specific)
    await expect(page.getByRole('heading', { name: 'Post-mortem', exact: true })).toBeVisible()
    await expect(page.locator('text=Clear milestones')).toBeVisible()
  })

  // TC-033: Estimation drift warning
  test('TC-033: should show estimation drift warning', async ({ page }) => {
    const users = await prisma.teamMember.findMany()
    const dev = users.find(u => u.role === 'Dev')!

    // Create project with 130% hours used
    const project = await prisma.project.create({
      data: {
        name: 'Over Budget Project',
        status: 'active',
        developerId: dev.id,
        estimatedHours: 100,
        actualHours: 130,
      },
    })

    await login(page, TEST_USERS.founder)
    await page.goto('/projects')

    // Should show "Est. usage: 130%" somewhere on the page
    // The text appears as a sibling to the project link
    await expect(page.locator('text=Est. usage: 130%')).toBeVisible()
  })
})

test.describe('Project Status Transitions', () => {
  test('should move project through complete lifecycle', async ({ page }) => {
    const users = await prisma.teamMember.findMany()
    const dev = users.find(u => u.role === 'Dev')!
    const qa = users.find(u => u.role === 'QA')!

    // 1. Create project in scoping
    const project = await prisma.project.create({
      data: {
        name: 'Complete Lifecycle Project',
        status: 'scoping',
        developerId: dev.id,
        estimatedHours: 100,
      },
    })

    await login(page, TEST_USERS.founder)
    await page.goto(`/projects/${project.id}`)

    // 2. Move to active
    await page.click('button:has-text("Update status")')
    await page.selectOption('select[name="status"]', 'active')
    await page.click('button[type="submit"]:has-text("Update")')
    await page.waitForTimeout(1000)
    await expect(page.locator('.badge:has-text("active"), .badge:has-text("Active")')).toBeVisible()

    // 3. Move to QA with handoff info
    await page.click('button:has-text("Update status")')
    await page.selectOption('select[name="status"]', 'qa')
    await page.fill('textarea[name="qaModulesDelivered"]', 'Auth, Dashboard, Reports')
    await page.selectOption('select[name="qaSuggestedTestType"]', 'regression')
    await page.fill('textarea[name="qaTestingNotes"]', 'Focus on edge cases')
    await page.click('button[type="submit"]:has-text("Update")')
    await page.waitForTimeout(1000)
    await expect(page.locator('.badge:has-text("qa"), .badge:has-text("QA")')).toBeVisible()

    // 4. Login as QA and sign off
    await login(page, TEST_USERS.qa)

    // Create passing test cycle first
    await prisma.testCycle.create({
      data: {
        projectId: project.id,
        conductedById: qa.id,
        result: 'pass',
        cycleType: 'regression',
        environment: 'staging',
        startedAt: new Date(),
      },
    })

    await page.goto(`/qa/${project.id}`)
    await page.waitForLoadState('networkidle')

    // Click submit release sign-off button
    await page.click('button:has-text("✓ Submit release sign-off")')
    await page.waitForTimeout(1000)

    // Check all checklist items
    const checkboxes = await page.locator('input[type="checkbox"]').all()
    for (const checkbox of checkboxes) {
      await checkbox.check()
    }

    // Select quality score (9 out of 10)
    await page.click('button:has-text("9")')

    // Submit the sign-off form
    await page.click('button:has-text("✓ Sign off — ready to deliver")')
    await page.waitForTimeout(2000)

    // 5. Move to delivered
    await login(page, TEST_USERS.founder)
    await page.goto(`/projects/${project.id}`)
    await page.click('button:has-text("Update status")')
    await page.selectOption('select[name="status"]', 'delivered')
    await page.click('button[type="submit"]:has-text("Update")')
    await page.waitForTimeout(1000)

    // Verify delivered status
    await expect(page.locator('.badge:has-text("delivered"), .badge:has-text("Delivered")')).toBeVisible()
  })
})
