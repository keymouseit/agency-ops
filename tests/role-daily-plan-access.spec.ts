import { test, expect } from '@playwright/test'
import { login, TEST_USERS } from './helpers/auth'

test.describe('Daily Plan Access - All Roles', () => {
  test('QA can access daily plan page', async ({ page }) => {
    await login(page, TEST_USERS.qa)
    await page.goto('/daily/plan')
    await page.waitForLoadState('networkidle')

    // Should see the daily plan page (not redirected)
    await expect(page).toHaveURL('/daily/plan')
    await expect(page.locator('h1')).toBeVisible()
  })

  test('BD can access daily plan page', async ({ page }) => {
    await login(page, TEST_USERS.bd)
    await page.goto('/daily/plan')
    await page.waitForLoadState('networkidle')

    // Should see the daily plan page (not redirected)
    await expect(page).toHaveURL('/daily/plan')
    await expect(page.locator('h1')).toBeVisible()
  })

  test('Dev can access daily plan page', async ({ page }) => {
    await login(page, TEST_USERS.dev)
    await page.goto('/daily/plan')
    await page.waitForLoadState('networkidle')

    // Should see the daily plan page (not redirected)
    await expect(page).toHaveURL('/daily/plan')
    await expect(page.locator('h1')).toBeVisible()
  })

  test('Founder can access daily plan page', async ({ page }) => {
    await login(page, TEST_USERS.founder)
    await page.goto('/daily/plan')
    await page.waitForLoadState('networkidle')

    // Should see the daily plan page (not redirected)
    await expect(page).toHaveURL('/daily/plan')
    await expect(page.locator('h1')).toBeVisible()
  })

  test('QA can access daily analytics page', async ({ page }) => {
    await login(page, TEST_USERS.qa)
    await page.goto('/daily')
    await page.waitForLoadState('networkidle')

    // Should see the daily page (not redirected)
    await expect(page).toHaveURL('/daily')
  })
})
