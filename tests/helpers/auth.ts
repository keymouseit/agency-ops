import { Page } from '@playwright/test'

export interface TestUser {
  email: string
  password: string
  role: string
  name: string
}

export const TEST_USERS = {
  founder: {
    email: 'shiven@example.com',
    password: 'password123',
    role: 'Founder',
    name: 'Shiven',
  },
  dev: {
    email: 'vishal@example.com',
    password: 'password123',
    role: 'Dev',
    name: 'Vishal',
  },
  qa: {
    email: 'qa@example.com',
    password: 'password123',
    role: 'QA',
    name: 'QA Tester',
  },
  bd: {
    email: 'bd@example.com',
    password: 'password123',
    role: 'BD',
    name: 'BD Member',
  },
} as const

/**
 * Login to the application
 */
export async function login(page: Page, user: TestUser) {
  await page.goto('/login')

  // Wait for login form to be visible
  await page.waitForSelector('input[type="email"]', { timeout: 10000 })

  // Fill in credentials
  await page.fill('input[type="email"]', user.email)
  await page.fill('input[type="password"]', user.password)
  await page.click('button[type="submit"]')

  // Wait for navigation to complete
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 10000 })
}

/**
 * Logout from the application
 */
export async function logout(page: Page) {
  await page.click('button:has-text("Shiven")') // User dropdown
  await page.click('button:has-text("Sign out")')
  await page.waitForURL('/login')
}

/**
 * Check if user is logged in
 */
export async function isLoggedIn(page: Page): Promise<boolean> {
  try {
    await page.waitForSelector('nav', { timeout: 2000 })
    return true
  } catch {
    return false
  }
}
