import 'dotenv/config'
import { runSalesRobotSync } from '../src/lib/salesrobot/sync'

async function main() {
  const full = process.argv.includes('--full')
  const result = await runSalesRobotSync({
    daysBack: 42,
    syncProspects: full,
  })
  console.log(JSON.stringify(result, null, 2))
  if (!result.ok && result.campaigns === 0 && result.dailyRows === 0 && result.prospects === 0) {
    process.exit(1)
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
