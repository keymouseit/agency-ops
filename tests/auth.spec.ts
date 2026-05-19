import { test, expect } from '@playwright/test'
import { login, logout, TEST_USERS } from './helpers/auth'

test.describe('Authentication', () => {
  test('should login successfully with valid credentials', async ({ page }) => {
    await login(page, TEST_USERS.founder)
    // After login, should be on My Day or home page
    await expect(page).toHaveURL(/\/(me)?/)
    await expect(page.locator('nav')).toBeVisible() // Navigation visible when logged in
  })

  test('should fail login with invalid credentials', async ({ page }) => {
    await page.goto('/login')
    await page.waitForSelector('input[type="email"]')
    await page.fill('input[type="email"]', 'wrong@example.com')
    await page.fill('input[type="password"]', 'wrongpassword')
    await page.click('button[type="submit"]')

    // Should stay on login page with error
    await page.waitForTimeout(1000)
    await expect(page).toHaveURL('/login')
    await expect(page.locator('text=Incorrect email or password')).toBeVisible()
  })

  test('should logout successfully', async ({ page }) => {
    await login(page, TEST_USERS.founder)
    await logout(page)
    await expect(page).toHaveURL('/login')
  })

  test('should redirect to login when accessing protected pages while logged out', async ({ page }) => {
    await page.goto('/projects')
    await page.waitForLoadState('networkidle')
    // Should redirect to login (may include callback URL)
    await expect(page.url()).toContain('/login')
  })

  test('should persist session after page reload', async ({ page }) => {
    await login(page, TEST_USERS.founder)
    await page.reload()
    await expect(page).toHaveURL('/')
    await expect(page.locator('nav')).toBeVisible()
  })
})

test.describe('Role-Based Access Control', () => {
  test('Founder should access all pages', async ({ page }) => {
    await login(page, TEST_USERS.founder)

    // Test navigation access
    await page.goto('/projects')
    await expect(page).not.toHaveURL('/login')

    await page.goto('/pipeline')
    await expect(page).not.toHaveURL('/login')

    await page.goto('/intelligence')
    await expect(page).not.toHaveURL('/login')

    await page.goto('/team')
    await expect(page).not.toHaveURL('/login')
  })

  test('Dev should only access dev-allowed pages', async ({ page }) => {
    await login(page, TEST_USERS.dev)

    // Should access My Day
    await page.goto('/me')
    await expect(page).toHaveURL('/me')

    // Should access projects
    await page.goto('/projects')
    await expect(page).toHaveURL('/projects')

    // Should NOT access pipeline (redirects to /me or /)
    await page.goto('/pipeline')
    await expect(page).toHaveURL(/\/(me)?/)

    // Should NOT access intelligence
    await page.goto('/intelligence')
    await expect(page).toHaveURL(/\/(me)?/)
  })

  test('QA should only access QA-allowed pages', async ({ page }) => {
    await login(page, TEST_USERS.qa)

    // Should access My Day
    await page.goto('/me')
    await expect(page).toHaveURL('/me')

    // Should access QA dashboard
    await page.goto('/qa')
    await expect(page).toHaveURL('/qa')

    // Should NOT access projects list
    await page.goto('/projects')
    await expect(page).toHaveURL(/\/(me)?/)

    // Should NOT access pipeline
    await page.goto('/pipeline')
    await expect(page).toHaveURL(/\/(me)?/)
  })

  test('BD should only access BD-allowed pages', async ({ page }) => {
    await login(page, TEST_USERS.bd)

    // Should access pipeline
    await page.goto('/pipeline')
    await expect(page).toHaveURL('/pipeline')

    // Should access projects
    await page.goto('/projects')
    await expect(page).toHaveURL('/projects')

    // Should NOT access QA
    await page.goto('/qa')
    await expect(page).toHaveURL(/\/(me)?/)
  })
})
