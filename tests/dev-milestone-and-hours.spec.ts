import { test, expect } from '@playwright/test'
import { login, TEST_USERS } from './helpers/auth'
import { createTestProject, prisma } from './helpers/database'
import { startOfDay } from 'date-fns'

test.describe('Developer Milestone Updates & Actual Hours Tracking', () => {
  test('Developer can send milestone to QA', async ({ page }) => {
    // Setup: Create project with milestones
    const users = await prisma.teamMember.findMany()
    const dev = users.find(u => u.role === 'Dev')!
    const project = await createTestProject(dev.id)

    // Login as developer
    await login(page, TEST_USERS.dev)

    // Navigate to project page
    await page.goto(`/projects/${project.id}`)
    await page.waitForLoadState('networkidle')

    // Verify milestones section is visible
    await expect(page.locator('h2:has-text("Milestones")')).toBeVisible()

    // Verify milestone is in 'Not Started' status - find the specific milestone card within the milestones section
    const milestonesSection = page.locator('.card:has(h2:has-text("Milestones"))')
    const firstMilestone = milestonesSection.locator('div').filter({ hasText: 'Design Phase' }).first()
    await expect(firstMilestone).toContainText('Not Started')

    // Click "Send to QA" button for the first milestone
    const sendToQAButton = firstMilestone.locator('button:has-text("Send to QA")').first()
    await expect(sendToQAButton).toBeVisible()
    await sendToQAButton.click()

    // Wait for the update to complete
    await page.waitForTimeout(1000)

    // Reload page to see the updated status
    await page.reload()
    await page.waitForLoadState('networkidle')

    // Verify milestone status changed to 'Ready for QA'
    const milestonesSection2 = page.locator('.card:has(h2:has-text("Milestones"))')
    const updatedMilestone = milestonesSection2.locator('div').filter({ hasText: 'Design Phase' }).first()
    await expect(updatedMilestone).toContainText('Ready for QA')

    // Verify "Not Ready" button is now shown instead of "Send to QA"
    await expect(updatedMilestone.locator('button:has-text("Not Ready")').first()).toBeVisible()
    // Don't check for Send to QA visibility as other milestones will have that button

    // Verify the milestone count shows correctly
    await expect(page.locator('text=1 ready for QA')).toBeVisible()
  })

  test('Developer can move milestone back from Ready for QA to pending', async ({ page }) => {
    // Setup: Create project with a milestone already in ready_for_qa status
    const users = await prisma.teamMember.findMany()
    const dev = users.find(u => u.role === 'Dev')!
    const project = await createTestProject(dev.id)

    // Set first milestone to ready_for_qa
    const firstMilestone = project.milestones[0]
    await prisma.milestone.update({
      where: { id: firstMilestone.id },
      data: { status: 'ready_for_qa' },
    })

    // Login as developer
    await login(page, TEST_USERS.dev)

    // Navigate to project page
    await page.goto(`/projects/${project.id}`)
    await page.waitForLoadState('networkidle')

    // Verify milestone is in 'Ready for QA' status
    const milestonesSection = page.locator('.card:has(h2:has-text("Milestones"))')
    const milestoneCard = milestonesSection.locator('div').filter({ hasText: 'Design Phase' }).first()
    await expect(milestoneCard).toContainText('Ready for QA')

    // Click "Not Ready" button
    const notReadyButton = milestoneCard.locator('button:has-text("Not Ready")').first()
    await expect(notReadyButton).toBeVisible()
    await notReadyButton.click()

    // Wait for the update to complete
    await page.waitForTimeout(1000)

    // Reload page to see the updated status
    await page.reload()
    await page.waitForLoadState('networkidle')

    // Verify milestone status changed back to 'Not Started'
    const milestonesSection2 = page.locator('.card:has(h2:has-text("Milestones"))')
    const updatedMilestone = milestonesSection2.locator('div').filter({ hasText: 'Design Phase' }).first()
    await expect(updatedMilestone).toContainText('Not Started')

    // Verify "Send to QA" button is shown again
    await expect(updatedMilestone.locator('button:has-text("Send to QA")').first()).toBeVisible()
  })

  test('Actual hours update correctly when EOD is submitted', async ({ page }) => {
    // Setup: Create project and daily log for developer
    const users = await prisma.teamMember.findMany()
    const dev = users.find(u => u.role === 'Dev')!
    const project = await createTestProject(dev.id)

    // Use a specific date to avoid conflicts with other tests
    const testDate = new Date('2026-05-19')

    // Create a daily log for the developer
    const dailyLog = await prisma.dailyLog.create({
      data: {
        memberId: dev.id,
        date: testDate,
      },
    })

    // Create daily tasks for the project
    await prisma.dailyTask.createMany({
      data: [
        {
          dailyLogId: dailyLog.id,
          title: 'Implement login feature',
          taskType: 'feature',
          priority: 'high',
          status: 'planned',
          estimatedHours: 5,
          projectId: project.id,
        },
        {
          dailyLogId: dailyLog.id,
          title: 'Fix bug in header',
          taskType: 'bug',
          priority: 'medium',
          status: 'planned',
          estimatedHours: 2,
          projectId: project.id,
        },
      ],
    })

    // Login as developer
    await login(page, TEST_USERS.dev)

    // Navigate to EOD page
    await page.goto(`/daily/eod?logId=${dailyLog.id}`)
    await page.waitForLoadState('networkidle')

    // Verify EOD form is visible
    await expect(page.locator('h1:has-text("EOD report")')).toBeVisible()

    // Verify tasks are shown
    await expect(page.locator('text=Implement login feature')).toBeVisible()
    await expect(page.locator('text=Fix bug in header')).toBeVisible()

    // Fill in actual hours for first task (different from estimated)
    const firstTaskCard = page.locator('.card').filter({ hasText: 'Implement login feature' }).first()
    const firstActualHoursInput = firstTaskCard.locator('input[type="number"]').first()
    await firstActualHoursInput.clear()
    await firstActualHoursInput.fill('6.5') // Took longer than estimated

    // Fill in actual hours for second task
    const secondTaskCard = page.locator('.card').filter({ hasText: 'Fix bug in header' }).first()
    const secondActualHoursInput = secondTaskCard.locator('input[type="number"]').first()
    await secondActualHoursInput.clear()
    await secondActualHoursInput.fill('1.5') // Took less time than estimated

    // Verify total hours are calculated correctly (should show 8.0h)
    await expect(page.locator('text=8h').or(page.locator('text=8.0h'))).toBeVisible()

    // Select day rating (required)
    await page.locator('button:has-text("4")').click()

    // Submit EOD
    const submitButton = page.locator('button[type="submit"]:has-text("Submit EOD report")')
    await expect(submitButton).toBeEnabled()
    await submitButton.click()

    // Wait for submission to complete
    await page.waitForLoadState('networkidle')

    // Should see confirmation message
    await expect(page.locator('text=EOD submitted')).toBeVisible()
    await expect(page.locator('text=2 of 2 tasks done')).toBeVisible()

    // Verify actual hours were saved in database
    const tasks = await prisma.dailyTask.findMany({
      where: { dailyLogId: dailyLog.id },
    })

    const task1 = tasks.find(t => t.title === 'Implement login feature')
    const task2 = tasks.find(t => t.title === 'Fix bug in header')

    expect(task1?.actualHours).toBe(6.5)
    expect(task2?.actualHours).toBe(1.5)

    // Verify project actualHours was updated (should be 8.0 total)
    const updatedProject = await prisma.project.findUnique({
      where: { id: project.id },
    })

    expect(updatedProject?.actualHours).toBe(8)

    // Navigate to project page to verify UI shows updated actual hours
    await page.goto(`/projects/${project.id}`)
    await page.waitForLoadState('networkidle')

    // Should see actual hours displayed - look for it in the stats section
    const actualHoursCard = page.locator('.card').filter({ hasText: 'Actual hours' })
    await expect(actualHoursCard).toBeVisible()
    await expect(actualHoursCard.locator('.text-xl')).toContainText('8')

    // Verify estimation accuracy is calculated (8h actual / 100h estimated from project = 8%)
    const estAccuracy = Math.round((8 / 100) * 100)
    const estAccuracyCard = page.locator('.card').filter({ hasText: 'Est. accuracy' })
    await expect(estAccuracyCard.locator('.text-xl')).toContainText(`${estAccuracy}%`)
  })

  test('Actual hours accumulate correctly across multiple EOD submissions', async ({ page }) => {
    // Setup: Create project and multiple daily logs
    const users = await prisma.teamMember.findMany()
    const dev = users.find(u => u.role === 'Dev')!
    const project = await createTestProject(dev.id)

    // Create first daily log and submit it via API
    const log1 = await prisma.dailyLog.create({
      data: {
        memberId: dev.id,
        date: new Date('2026-05-16'),
      },
    })

    const task1 = await prisma.dailyTask.create({
      data: {
        dailyLogId: log1.id,
        title: 'Task Day 1',
        taskType: 'feature',
        priority: 'high',
        status: 'done',
        estimatedHours: 5,
        actualHours: 6,
        projectId: project.id,
      },
    })

    // Submit first EOD to trigger sync
    await prisma.dailyLog.update({
      where: { id: log1.id },
      data: {
        eodSubmittedAt: new Date(),
        dayRating: 4,
      },
    })

    // Trigger sync manually (simulating what the EOD endpoint does)
    const agg1 = await prisma.dailyTask.aggregate({
      where: {
        projectId: project.id,
        actualHours: { not: null },
      },
      _sum: { actualHours: true },
    })

    await prisma.project.update({
      where: { id: project.id },
      data: { actualHours: agg1._sum.actualHours ?? 0 },
    })

    // Verify project has 6 hours after first day
    let updatedProject = await prisma.project.findUnique({
      where: { id: project.id },
    })
    expect(updatedProject?.actualHours).toBe(6)

    // Create second daily log with a different date
    const log2 = await prisma.dailyLog.create({
      data: {
        memberId: dev.id,
        date: new Date('2026-05-17'),
      },
    })

    await prisma.dailyTask.create({
      data: {
        dailyLogId: log2.id,
        title: 'Task Day 2',
        taskType: 'feature',
        priority: 'high',
        status: 'planned',
        estimatedHours: 4,
        projectId: project.id,
      },
    })

    // Login and submit second EOD
    await login(page, TEST_USERS.dev)
    await page.goto(`/daily/eod?logId=${log2.id}`)
    await page.waitForLoadState('networkidle')

    // Fill in actual hours for day 2 task
    const taskCard = page.locator('.card').filter({ hasText: 'Task Day 2' }).first()
    const actualHoursInput = taskCard.locator('input[type="number"]').first()
    await actualHoursInput.clear()
    await actualHoursInput.fill('4.5')

    // Select day rating and submit
    await page.locator('button:has-text("4")').click()
    await page.locator('button[type="submit"]').click()
    await page.waitForLoadState('networkidle')

    // Verify EOD submitted
    await expect(page.locator('text=EOD submitted')).toBeVisible()

    // Verify project actualHours is now 10.5 (6 + 4.5)
    updatedProject = await prisma.project.findUnique({
      where: { id: project.id },
    })
    expect(updatedProject?.actualHours).toBe(10.5)

    // Navigate to project page and verify
    await page.goto(`/projects/${project.id}`)
    await page.waitForLoadState('networkidle')

    // Should show accumulated hours
    const actualHoursSection = page.locator('text=Actual hours').locator('..')
    await expect(actualHoursSection).toContainText('10.5')
  })

  test('Project actual hours display on founders dashboard (intelligence page)', async ({ page }) => {
    // Setup: Create project with logged hours
    const users = await prisma.teamMember.findMany()
    const dev = users.find(u => u.role === 'Dev')!
    const project = await createTestProject(dev.id)

    // Use a specific date - if it exists from a retry, delete it first
    const testDate = new Date('2026-05-14')
    await prisma.dailyLog.deleteMany({
      where: {
        memberId: dev.id,
        date: testDate,
      },
    })

    // Create daily log with actual hours
    const dailyLog = await prisma.dailyLog.create({
      data: {
        memberId: dev.id,
        date: testDate,
        eodSubmittedAt: new Date(),
        dayRating: 4,
      },
    })

    await prisma.dailyTask.create({
      data: {
        dailyLogId: dailyLog.id,
        title: 'Development work',
        taskType: 'feature',
        priority: 'high',
        status: 'done',
        estimatedHours: 10,
        actualHours: 12,
        projectId: project.id,
      },
    })

    // Update project with actual hours
    await prisma.project.update({
      where: { id: project.id },
      data: { actualHours: 12 },
    })

    // Login as founder
    await login(page, TEST_USERS.founder)

    // Navigate to intelligence/founders dashboard
    await page.goto('/intelligence', { timeout: 60000 })
    await page.waitForLoadState('domcontentloaded')

    // Verify the page loaded (use longer timeout for intelligence page which has complex queries)
    await expect(page.locator('h1:has-text("Intelligence")')).toBeVisible({ timeout: 30000 })

    // Find the project card/row
    const projectSection = page.locator('text=Test Project').first()
    await expect(projectSection).toBeVisible({ timeout: 10000 })

    // Verify actual hours are displayed somewhere on the page
    // Note: The exact location depends on the intelligence page layout
    // We just verify the data is present
    const actualHoursText = page.locator('text=/12h?/i').or(page.locator('text=/12 h/i'))
    await expect(actualHoursText.first()).toBeVisible({ timeout: 10000 })
  })
})
