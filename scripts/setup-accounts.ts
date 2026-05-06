/**
 * Agency Ops — User Account Management
 * 
 * Creates login accounts for all active team members.
 * Run this ONCE after seeding, or to reset a password.
 * 
 * Usage:
 *   npx tsx scripts/setup-accounts.ts
 *   npx tsx scripts/setup-accounts.ts --reset vishal@keymouse.com newpassword123
 * 
 * Default password for all seeded accounts: AgencyOps2025!
 * (Change immediately after first login)
 */

import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

const DEFAULT_PASSWORD = 'AgencyOps2025!'

// Custom passwords per person (optional — all get DEFAULT if not listed)
const CUSTOM_PASSWORDS: Record<string, string> = {
  // 'shiven@keymouse.com': 'FounderPass123!',
}

async function main() {
  const args = process.argv.slice(2)

  // Reset a single user's password
  if (args[0] === '--reset' && args[1] && args[2]) {
    const email = args[1]
    const newPassword = args[2]
    await resetPassword(email, newPassword)
    return
  }

  // Show all users
  if (args[0] === '--list') {
    await listUsers()
    return
  }

  // Default: setup all accounts
  await setupAllAccounts()
}

async function setupAllAccounts() {
  console.log('Setting up user accounts for all active team members...\n')

  const members = await prisma.teamMember.findMany({
    where: { active: true },
    orderBy: { name: 'asc' },
  })

  if (members.length === 0) {
    console.log('No team members found. Run db:seed first.')
    return
  }

  for (const member of members) {
    const plainPassword = CUSTOM_PASSWORDS[member.email] ?? DEFAULT_PASSWORD
    const passwordHash = await bcrypt.hash(plainPassword, 12)

    await prisma.userAccount.upsert({
      where: { memberId: member.id },
      update: { passwordHash },
      create: {
        memberId: member.id,
        passwordHash,
      },
    })

    console.log(`✓ ${member.name.padEnd(20)} ${member.email.padEnd(30)} [${member.role}]`)
  }

  console.log(`\n✅ ${members.length} accounts created/updated.`)
  console.log(`\nDefault password: ${DEFAULT_PASSWORD}`)
  console.log('⚠  Change passwords before sharing with team.\n')
  console.log('To reset one person\'s password:')
  console.log('  npx tsx scripts/setup-accounts.ts --reset email@domain.com NewPassword123!\n')
}

async function resetPassword(email: string, newPassword: string) {
  const member = await prisma.teamMember.findUnique({ where: { email } })

  if (!member) {
    console.error(`❌ No team member found with email: ${email}`)
    process.exit(1)
  }

  if (newPassword.length < 8) {
    console.error('❌ Password must be at least 8 characters.')
    process.exit(1)
  }

  const passwordHash = await bcrypt.hash(newPassword, 12)

  await prisma.userAccount.upsert({
    where: { memberId: member.id },
    update: { passwordHash },
    create: { memberId: member.id, passwordHash },
  })

  console.log(`✅ Password reset for ${member.name} (${email})`)
}

async function listUsers() {
  const accounts = await prisma.userAccount.findMany({
    include: { member: true },
    orderBy: { member: { name: 'asc' } },
  })

  if (accounts.length === 0) {
    console.log('No accounts found. Run: npx tsx scripts/setup-accounts.ts')
    return
  }

  console.log('\nActive user accounts:\n')
  console.log('Name'.padEnd(20), 'Email'.padEnd(30), 'Role'.padEnd(10), 'Last login')
  console.log('-'.repeat(80))

  for (const acc of accounts) {
    const lastLogin = acc.lastLoginAt
      ? acc.lastLoginAt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
      : 'Never'
    console.log(
      acc.member.name.padEnd(20),
      acc.member.email.padEnd(30),
      acc.member.role.padEnd(10),
      lastLogin
    )
  }
  console.log()
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
