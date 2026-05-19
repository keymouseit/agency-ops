import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { startOfWeek } from 'date-fns'

const prisma = new PrismaClient()

/**
 * Reset database to clean state for testing
 */
export async function resetDatabase() {
  // Delete in correct order to respect foreign key constraints
  await prisma.auditLog.deleteMany()
  await prisma.postDeliveryIssue.deleteMany()
  await prisma.releaseSignOff.deleteMany()
  await prisma.testCycle.deleteMany()
  await prisma.projectHealthSnapshot.deleteMany()
  await prisma.blocker.deleteMany()
  await prisma.postMortem.deleteMany()
  await prisma.projectCheckIn.deleteMany()
  await prisma.scopeChange.deleteMany()
  await prisma.milestone.deleteMany()
  await prisma.dailyTask.deleteMany()
  await prisma.dailyLog.deleteMany()
  await prisma.weeklyScore.deleteMany()
  await prisma.goal.deleteMany()
  await prisma.utilisationWeek.deleteMany()
  await prisma.notification.deleteMany()
  await prisma.project.deleteMany()

  // Delete estimation data in correct order (children first)
  await prisma.estimationLine.deleteMany()
  await prisma.estimationRecord.deleteMany()
  await prisma.estimationRequest.deleteMany()

  // Delete lead-related data
  await prisma.lossAnalysis.deleteMany()
  await prisma.proposal.deleteMany()
  await prisma.lead.deleteMany()
  await prisma.userAccount.deleteMany()
  await prisma.teamMember.deleteMany()
}

/**
 * Seed basic test users
 */
export async function seedTestUsers() {
  const hashedPassword = await bcrypt.hash('password123', 10)

  const founder = await prisma.teamMember.create({
    data: {
      name: 'Shiven',
      email: 'shiven@example.com',
      role: 'Founder',
      active: true,
    },
  })

  const dev = await prisma.teamMember.create({
    data: {
      name: 'Vishal',
      email: 'vishal@example.com',
      role: 'Dev',
      active: true,
    },
  })

  const qa = await prisma.teamMember.create({
    data: {
      name: 'QA Tester',
      email: 'qa@example.com',
      role: 'QA',
      active: true,
    },
  })

  const bd = await prisma.teamMember.create({
    data: {
      name: 'BD Member',
      email: 'bd@example.com',
      role: 'BD',
      active: true,
    },
  })

  // Create user accounts
  await prisma.userAccount.createMany({
    data: [
      { memberId: founder.id, passwordHash: hashedPassword },
      { memberId: dev.id, passwordHash: hashedPassword },
      { memberId: qa.id, passwordHash: hashedPassword },
      { memberId: bd.id, passwordHash: hashedPassword },
    ],
  })

  return { founder, dev, qa, bd }
}

/**
 * Create a test project with milestones
 */
export async function createTestProject(developerId: string, bdMemberId?: string) {
  const project = await prisma.project.create({
    data: {
      name: 'Test Project',
      status: 'active',
      developerId,
      bdMemberId,
      estimatedHours: 100,
      clientName: 'Test Client',
      milestones: {
        create: [
          { title: 'Design Phase', dueDate: new Date('2026-06-01'), status: 'pending' },
          { title: 'Development Phase', dueDate: new Date('2026-07-01'), status: 'pending' },
          { title: 'Testing Phase', dueDate: new Date('2026-08-01'), status: 'pending' },
        ],
      },
    },
    include: {
      milestones: true,
    },
  })

  return project
}

/**
 * Close database connection after tests
 */
export async function closeDatabaseConnection() {
  await prisma.$disconnect()
}

export { prisma }
