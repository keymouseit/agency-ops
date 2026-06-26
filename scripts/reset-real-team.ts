/**
 * Reset Agency Ops to a clean slate with the real KeyMouse team.
 *
 * Wipes ALL existing data (leads, projects, MOMs, scores, etc.)
 * and creates fresh accounts for:
 *   Shiven      — Founder
 *   Vikas       — BD
 *   Vishal Sharma — Dev
 *   Gurleen     — QA
 *   Reema       — HR
 *
 * Usage:
 *   npx tsx scripts/reset-real-team.ts
 *   npm run db:reset-team
 *
 * Default password for everyone: AgencyOps2025!
 */

import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

const DEFAULT_PASSWORD = 'AgencyOps2025!'

const REAL_TEAM = [
  { name: 'Shiven', email: 'shiven@keymouse.com', role: 'Founder' },
  { name: 'Vikas', email: 'vikas@keymouse.com', role: 'BD' },
  { name: 'Vishal Sharma', email: 'vishal@keymouse.com', role: 'Dev' },
  { name: 'Gurleen', email: 'gurleen@keymouse.com', role: 'QA' },
  { name: 'Reema', email: 'reema@keymouse.com', role: 'HR' },
] as const

/** Delete all rows — child tables first to satisfy SQLite FK constraints */
async function wipeDatabase() {
  const tables = [
    'EstimationLine',
    'EstimationRecord',
    'EstimationRequest',
    'DailyTask',
    'DailyLog',
    'Notification',
    'NotificationPreference',
    'AuditLog',
    'MeetingMinute',
    'TestCycle',
    'ReleaseSignOff',
    'PostDeliveryIssue',
    'Blocker',
    'UtilisationWeek',
    'Goal',
    'ProjectHealthSnapshot',
    'WeeklyScore',
    'MonthlyReview',
    'ProjectCheckIn',
    'ScopeChange',
    'Milestone',
    'PostMortem',
    'Project',
    'LossAnalysis',
    'Proposal',
    'Lead',
    'UserAccount',
    'TeamMember',
  ]

  await prisma.$executeRawUnsafe('PRAGMA foreign_keys = OFF')
  for (const table of tables) {
    await prisma.$executeRawUnsafe(`DELETE FROM "${table}"`)
  }
  await prisma.$executeRawUnsafe('PRAGMA foreign_keys = ON')
}

async function main() {
  console.log('⚠️  Wiping all existing data...\n')
  await wipeDatabase()
  console.log('✓ Database cleared\n')

  console.log('Creating real team members...\n')
  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 12)

  for (const person of REAL_TEAM) {
    const member = await prisma.teamMember.create({
      data: {
        name: person.name,
        email: person.email,
        role: person.role,
        active: true,
      },
    })

    await prisma.userAccount.create({
      data: {
        memberId: member.id,
        passwordHash,
      },
    })

    console.log(`  ✓ ${person.name.padEnd(18)} ${person.email.padEnd(28)} [${person.role}]`)
  }

  console.log('\n✅ Real team ready — clean database, no dummy data.')
  console.log(`\nEveryone logs in at http://localhost:3000/login`)
  console.log(`Default password: ${DEFAULT_PASSWORD}`)
  console.log('\nAccounts:')
  console.log('  Shiven         shiven@keymouse.com   Founder')
  console.log('  Vikas          vikas@keymouse.com    BD')
  console.log('  Vishal Sharma  vishal@keymouse.com   Dev')
  console.log('  Gurleen        gurleen@keymouse.com  QA')
  console.log('  Reema          reema@keymouse.com    HR')
  console.log('\n⚠  Ask everyone to change their password after first login.\n')
}

main()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
