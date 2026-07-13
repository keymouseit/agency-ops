/**
 * Fix daily tasks marked "moved" → "done" after EOD was already submitted.
 *
 * Usage:
 *   npx tsx scripts/fix-daily-tasks.ts
 *   npx tsx scripts/fix-daily-tasks.ts vishal@keymouse.com
 *   npx tsx scripts/fix-daily-tasks.ts vishal@keymouse.com 2026-06-26
 *   npx tsx scripts/fix-daily-tasks.ts --list vishal@keymouse.com
 *
 * --list  Show recent daily logs and task statuses (no changes)
 */

import { PrismaClient } from '@prisma/client'
import { startOfDay, parseISO, isValid } from 'date-fns'

const prisma = new PrismaClient()

async function listLogs(email: string) {
  const member = await prisma.teamMember.findUnique({ where: { email } })
  if (!member) {
    console.error(`No member found: ${email}`)
    process.exit(1)
  }

  const logs = await prisma.dailyLog.findMany({
    where: { memberId: member.id },
    include: {
      tasks: { orderBy: { createdAt: 'asc' } },
    },
    orderBy: { date: 'desc' },
    take: 10,
  })

  console.log(`\nRecent daily logs for ${member.name}:\n`)
  for (const log of logs) {
    const dateStr = log.date.toISOString().slice(0, 10)
    const moved = log.tasks.filter(t => t.status === 'moved').length
    const done = log.tasks.filter(t => t.status === 'done').length
    console.log(`  ${dateStr}  logId=${log.id}`)
    console.log(`    EOD: ${log.eodSubmittedAt ? 'submitted' : 'pending'}  tasks: ${done} done, ${moved} moved, ${log.tasks.length} total`)
    for (const t of log.tasks) {
      console.log(`      [${t.status}] ${t.title}`)
    }
    console.log()
  }
}

async function main() {
  const args = process.argv.slice(2)

  if (args[0] === '--list') {
    const email = args[1] ?? 'vishal@keymouse.com'
    await listLogs(email)
    return
  }

  const email = args[0] ?? 'vishal@keymouse.com'
  const dateArg = args[1]

  const member = await prisma.teamMember.findUnique({ where: { email } })
  if (!member) {
    console.error(`No member found: ${email}`)
    process.exit(1)
  }

  let date = startOfDay(new Date())
  if (dateArg) {
    const parsed = parseISO(dateArg)
    if (!isValid(parsed)) {
      console.error(`Invalid date: ${dateArg} (use YYYY-MM-DD)`)
      process.exit(1)
    }
    date = startOfDay(parsed)
  }

  const log = await prisma.dailyLog.findUnique({
    where: { memberId_date: { memberId: member.id, date } },
    include: { tasks: true },
  })

  if (!log) {
    console.error(`No daily log for ${member.name} on ${date.toISOString().slice(0, 10)}`)
    console.log('\nRun with --list to see available logs:')
    console.log(`  npx tsx scripts/fix-daily-tasks.ts --list ${email}`)
    process.exit(1)
  }

  const toFix = log.tasks.filter(t => t.status === 'moved')
  if (!toFix.length) {
    console.log(`No "moved" tasks on ${date.toISOString().slice(0, 10)} for ${member.name}.`)
    log.tasks.forEach(t => console.log(`  [${t.status}] ${t.title}`))
    return
  }

  console.log(`Fixing ${toFix.length} task(s) for ${member.name} on ${date.toISOString().slice(0, 10)}:\n`)
  for (const t of toFix) {
    console.log(`  moved → done: ${t.title}`)
  }

  await prisma.dailyTask.updateMany({
    where: { id: { in: toFix.map(t => t.id) } },
    data: { status: 'done' },
  })

  const tasks = await prisma.dailyTask.findMany({ where: { dailyLogId: log.id } })
  const completionRate = tasks.length > 0
    ? tasks.filter(t => t.status === 'done').length / tasks.length
    : null

  await prisma.dailyLog.update({
    where: { id: log.id },
    data: { completionRate },
  })

  console.log(`\n✅ Updated. Completion rate: ${completionRate != null ? Math.round(completionRate * 100) : 0}%`)
  console.log('Refresh /daily to see the change.\n')
}

main()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
