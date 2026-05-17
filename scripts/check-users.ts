import { prisma } from '../src/lib/prisma'

async function checkUsers() {
  const users = await prisma.userAccount.findMany({
    include: { member: true }
  })

  console.log(`\n=== User Accounts in Database ===\n`)

  if (users.length === 0) {
    console.log('No user accounts found in the database.')
    console.log('You need to create a user account first.')
  } else {
    console.log(`Found ${users.length} user account(s):\n`)
    users.forEach((user, i) => {
      console.log(`${i + 1}. Email: ${user.member.email}`)
      console.log(`   Name:  ${user.member.name}`)
      console.log(`   Role:  ${user.member.role}`)
      console.log(`   Last login: ${user.lastLoginAt || 'Never'}`)
      console.log()
    })
  }
}

checkUsers()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
