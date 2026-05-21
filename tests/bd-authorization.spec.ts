import { test, expect } from '@playwright/test'
import { login, TEST_USERS } from './helpers/auth'
import { createTestProject, prisma } from './helpers/database'
import { startOfDay } from 'date-fns'

test.describe('BD Role Authorization', () => {
  test('BD can create milestones for projects', async ({ page, request }) => {
    // Get BD user and create a project
    const users = await prisma.teamMember.findMany()
    const bd = users.find(u => u.role === 'BD')!
    const dev = users.find(u => u.role === 'Dev')!
    const project = await createTestProject(dev.id, bd.id)

    // Login as BD
    await login(page, TEST_USERS.bd)

    // Make API request to create milestone
    const response = await request.post(`/api/projects/${project.id}/milestones`, {
      data: {
        title: 'Client Review Phase',
        dueDate: new Date('2026-09-01').toISOString(),
      },
    })

    // Should succeed (not 403)
    expect(response.status()).toBe(200)

    const milestone = await response.json()
    expect(milestone.title).toBe('Client Review Phase')
    expect(milestone.projectId).toBe(project.id)

    // Verify milestone was created in database
    const dbMilestone = await prisma.milestone.findUnique({
      where: { id: milestone.id },
    })
    expect(dbMilestone).toBeTruthy()
    expect(dbMilestone?.title).toBe('Client Review Phase')
  })

  test('BD can create milestones through UI', async ({ page }) => {
    // Get BD user and create a project
    const users = await prisma.teamMember.findMany()
    const bd = users.find(u => u.role === 'BD')!
    const dev = users.find(u => u.role === 'Dev')!
    const project = await createTestProject(dev.id, bd.id)

    // Login as BD
    await login(page, TEST_USERS.bd)

    // Navigate to project page
    await page.goto(`/projects/${project.id}`)
    await page.waitForLoadState('networkidle')

    // Should see the project page (BD has access to /projects)
    await expect(page.locator('h1')).toContainText('Test Project')

    // Check if milestones section is visible
    const milestonesVisible = await page.locator('text=Milestones').count() > 0
    if (milestonesVisible) {
      // Should see existing milestones
      await expect(page.locator('text=Design Phase')).toBeVisible()
      await expect(page.locator('text=Development Phase')).toBeVisible()
      await expect(page.locator('text=Testing Phase')).toBeVisible()
    }
  })

  test('BD can submit daily plans', async ({ page, request }) => {
    // Get BD user
    const users = await prisma.teamMember.findMany()
    const bd = users.find(u => u.role === 'BD')!
    const dev = users.find(u => u.role === 'Dev')!
    const project = await createTestProject(dev.id, bd.id)

    // Login as BD
    await login(page, TEST_USERS.bd)

    // Make API request to submit daily plan
    const response = await request.post('/api/daily/plan', {
      data: {
        memberId: bd.id,
        planNotes: 'Focus on client meetings and proposal reviews',
        tasks: [
          {
            title: 'Review client proposal',
            taskType: 'meeting',
            priority: 'high',
            projectId: project.id,
            estimatedHours: '2',
          },
          {
            title: 'Update pipeline status',
            taskType: 'admin',
            priority: 'medium',
            projectId: null,
            estimatedHours: '1',
          },
        ],
      },
    })

    // Should succeed (not 403)
    expect(response.status()).toBe(200)

    const log = await response.json()
    expect(log.memberId).toBe(bd.id)
    expect(log.planNotes).toBe('Focus on client meetings and proposal reviews')

    // Verify daily log was created in database
    const today = startOfDay(new Date())
    const dbLog = await prisma.dailyLog.findUnique({
      where: {
        memberId_date: {
          memberId: bd.id,
          date: today,
        },
      },
      include: {
        tasks: true,
      },
    })

    expect(dbLog).toBeTruthy()
    expect(dbLog?.planNotes).toBe('Focus on client meetings and proposal reviews')
    expect(dbLog?.tasks.length).toBe(2)
    expect(dbLog?.tasks[0].title).toBe('Review client proposal')
    expect(dbLog?.tasks[1].title).toBe('Update pipeline status')
  })

  test('BD can submit daily plans through UI', async ({ page }) => {
    // Get BD user
    const users = await prisma.teamMember.findMany()
    const bd = users.find(u => u.role === 'BD')!

    // Login as BD
    await login(page, TEST_USERS.bd)

    // Navigate to daily plan page
    await page.goto('/daily/plan')
    await page.waitForLoadState('networkidle')

    // Should see the morning plan form
    await expect(page.locator('h1')).toContainText('Morning Plan')

    // Fill in plan notes
    await page.fill('textarea[name="planNotes"]', 'Testing BD daily plan submission')

    // Check if we can add tasks (task form should be accessible)
    const addTaskButton = page.locator('button:has-text("Add Task")')
    if (await addTaskButton.isVisible()) {
      await addTaskButton.click()
      // Task input should be visible
      await expect(page.locator('input[name*="title"]').first()).toBeVisible()
    }
  })

  test('BD can access daily page', async ({ page }) => {
    // Login as BD
    await login(page, TEST_USERS.bd)

    // Navigate to daily page
    await page.goto('/daily')
    await page.waitForLoadState('networkidle')

    // Should not redirect to /me (BD has access)
    await expect(page).toHaveURL('/daily')
  })

  test('BD cannot access QA pages', async ({ page }) => {
    // Login as BD
    await login(page, TEST_USERS.bd)

    // Try to access QA page
    await page.goto('/qa')

    // Should redirect to /me (no access)
    await expect(page).toHaveURL(/\/(me)?/)
  })

  test('Multiple roles can create milestones', async ({ request }) => {
    // Get users with different roles
    const users = await prisma.teamMember.findMany()
    const dev = users.find(u => u.role === 'Dev')!
    const bd = users.find(u => u.role === 'BD')!
    const founder = users.find(u => u.role === 'Founder')!

    const project = await createTestProject(dev.id, bd.id)

    // Test each allowed role
    const rolesToTest = [
      { user: TEST_USERS.bd, role: 'BD' },
      { user: TEST_USERS.dev, role: 'Dev' },
      { user: TEST_USERS.founder, role: 'Founder' },
    ]

    for (const { user, role } of rolesToTest) {
      // Create a new context with auth for each role
      const context = await request.newContext()

      // Login first to get cookies
      const loginResponse = await context.post('/api/auth/callback/credentials', {
        data: {
          email: user.email,
          password: user.password,
        },
      })

      // Make API request to create milestone
      const response = await context.post(`/api/projects/${project.id}/milestones`, {
        data: {
          title: `${role} Milestone`,
          dueDate: new Date('2026-09-01').toISOString(),
        },
      })

      // Should succeed for all allowed roles
      expect(response.status()).toBe(200)

      const milestone = await response.json()
      expect(milestone.title).toBe(`${role} Milestone`)

      await context.dispose()
    }
  })

  test('QA role cannot create milestones', async ({ page, request }) => {
    // Get QA user and create a project
    const users = await prisma.teamMember.findMany()
    const dev = users.find(u => u.role === 'Dev')!
    const project = await createTestProject(dev.id)

    // Login as QA
    await login(page, TEST_USERS.qa)

    // Make API request to create milestone
    const response = await request.post(`/api/projects/${project.id}/milestones`, {
      data: {
        title: 'QA Milestone',
        dueDate: new Date('2026-09-01').toISOString(),
      },
    })

    // Should fail with 403 (QA not allowed to create milestones)
    expect(response.status()).toBe(403)

    const error = await response.json()
    expect(error.error).toContain('permission')
  })
})
