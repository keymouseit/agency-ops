import { chromium, FullConfig } from '@playwright/test'
import { resetDatabase, seedTestUsers, closeDatabaseConnection } from '../helpers/database'

async function globalSetup(config: FullConfig) {
  console.log('🧪 Setting up test environment...')

  // Reset and seed database
  await resetDatabase()
  console.log('  ✓ Database reset')

  await seedTestUsers()
  console.log('  ✓ Test users seeded')

  await closeDatabaseConnection()
  console.log('✅ Test environment ready\n')
}

export default globalSetup
