import { FullConfig } from '@playwright/test'
import { closeDatabaseConnection } from '../helpers/database'

async function globalTeardown(config: FullConfig) {
  console.log('\n🧹 Cleaning up test environment...')
  await closeDatabaseConnection()
  console.log('✅ Cleanup complete')
}

export default globalTeardown
