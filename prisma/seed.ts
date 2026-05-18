import { PrismaClient } from '@prisma/client'
import { subDays, subWeeks, startOfWeek, startOfDay } from 'date-fns'

const prisma = new PrismaClient()

async function main() {
  await prisma.$executeRawUnsafe(`PRAGMA foreign_keys = ON`)

  // ── Team ─────────────────────────────────────────────────
  const shiven = await prisma.teamMember.upsert({
    where: { email: 'shiven@keymouse.com' },
    update: {},
    create: { name: 'Shiven', email: 'shiven@keymouse.com', role: 'Founder' },
  })
  const vishal = await prisma.teamMember.upsert({
    where: { email: 'vishal@keymouse.com' },
    update: {},
    create: { name: 'Vishal Sharma', email: 'vishal@keymouse.com', role: 'Dev' },
  })
  const rahul = await prisma.teamMember.upsert({
    where: { email: 'rahul@keymouse.com' },
    update: {},
    create: { name: 'Rahul Mehra', email: 'rahul@keymouse.com', role: 'Dev' },
  })
  const priya = await prisma.teamMember.upsert({
    where: { email: 'priya@keymouse.com' },
    update: {},
    create: { name: 'Priya Singh', email: 'priya@keymouse.com', role: 'Both' },
  })
  const amit = await prisma.teamMember.upsert({
    where: { email: 'amit@keymouse.com' },
    update: {},
    create: { name: 'Amit Bhatia', email: 'amit@keymouse.com', role: 'Dev' },
  })
  const kavya = await prisma.teamMember.upsert({
    where: { email: 'kavya@keymouse.com' },
    update: {},
    create: { name: 'Kavya Nair', email: 'kavya@keymouse.com', role: 'BD' },
  })

  // ── Leads & Pipeline ─────────────────────────────────────

  // Won lead → project
  const lead1 = await prisma.lead.create({
    data: {
      clientName: 'HealthSync Inc.',
      source: 'Upwork',
      description: 'Patient portal with appointment scheduling and EHR integration',
      budget: 18000,
      ownerId: kavya.id,
      status: 'won',
      createdAt: subDays(new Date(), 45),
    },
  })
  await prisma.proposal.create({
    data: {
      leadId: lead1.id,
      writtenById: kavya.id,
      sentAt: subDays(new Date(), 43),
      budgetQuoted: 17500,
      techStack: 'React, Node.js, PostgreSQL',
      connectsSpent: 6,
      status: 'won',
    },
  })

  // Active project from won lead
  const proj1 = await prisma.project.create({
    data: {
      name: 'HealthSync Patient Portal',
      leadId: lead1.id,
      developerId: vishal.id,
      bdMemberId: kavya.id,
      status: 'active',
      contractValue: 17500,
      estimatedHours: 280,
      actualHours: 195,
      startDate: subDays(new Date(), 38),
      estimatedEnd: new Date(Date.now() + 12 * 24 * 60 * 60 * 1000),
      techStack: 'React, Node.js, PostgreSQL',
      clientName: 'HealthSync Inc.',
      channel: 'Upwork',
    },
  })

  await prisma.milestone.createMany({
    data: [
      { projectId: proj1.id, title: 'Design approved', dueDate: subDays(new Date(), 28), completedAt: subDays(new Date(), 26), status: 'done' },
      { projectId: proj1.id, title: 'Auth & user management', dueDate: subDays(new Date(), 14), completedAt: subDays(new Date(), 15), status: 'done' },
      { projectId: proj1.id, title: 'Appointment module', dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), status: 'pending' },
      { projectId: proj1.id, title: 'EHR integration', dueDate: new Date(Date.now() + 12 * 24 * 60 * 60 * 1000), status: 'pending' },
    ],
  })

  await prisma.projectCheckIn.create({
    data: {
      projectId: proj1.id,
      submittedById: vishal.id,
      weekOf: startOfWeek(new Date()),
      progressPct: 72,
      onTrack: 'yes',
      scopeChange: 'none',
      clientUpdated: true,
      notes: 'Appointment module 60% done. EHR API docs received.',
    },
  })

  // Lost lead with analysis
  const lead2 = await prisma.lead.create({
    data: {
      clientName: 'FinEdge Capital',
      source: 'LinkedIn',
      description: 'Investment portfolio dashboard with real-time market data',
      budget: 35000,
      ownerId: priya.id,
      status: 'lost',
      createdAt: subDays(new Date(), 30),
    },
  })
  await prisma.proposal.create({
    data: {
      leadId: lead2.id,
      writtenById: priya.id,
      sentAt: subDays(new Date(), 28),
      budgetQuoted: 34000,
      techStack: 'Next.js, Python, WebSockets',
      status: 'rejected',
      interviewedAt: subDays(new Date(), 22),
      interviewNotes: 'Client asked about real-time data experience. Struggled to answer confidently.',
    },
  })
  await prisma.lossAnalysis.create({
    data: {
      leadId: lead2.id,
      reason: 'lost_interview',
      faultArea: 'BD',
      faultOwnerId: priya.id,
      notes: 'Interview went poorly — no concrete examples of real-time data work presented.',
      competitorWon: 'Unknown agency',
      budgetLost: 34000,
      lessonsLearned: 'Need a case study for real-time/financial dashboards. Prep interview answers with specific project references.',
    },
  })

  // At-risk project — scope creep
  const lead3 = await prisma.lead.create({
    data: {
      clientName: 'PropList UAE',
      source: 'Referral',
      description: 'Real estate listing platform with map search',
      budget: 22000,
      ownerId: kavya.id,
      status: 'won',
      createdAt: subDays(new Date(), 60),
    },
  })
  const proj2 = await prisma.project.create({
    data: {
      name: 'PropList Real Estate App',
      leadId: lead3.id,
      developerId: rahul.id,
      bdMemberId: kavya.id,
      status: 'active',
      contractValue: 21000,
      estimatedHours: 320,
      actualHours: 260,
      startDate: subDays(new Date(), 55),
      estimatedEnd: subDays(new Date(), 5),
      techStack: 'React Native, Node.js, Google Maps API',
      clientName: 'PropList UAE',
      channel: 'Referral',
    },
  })

  await prisma.scopeChange.create({
    data: {
      projectId: proj2.id,
      requestedBy: 'client',
      description: 'Add AR property preview feature',
      hoursAdded: 40,
      valueAdded: 3000,
      changeOrderSigned: false,
      approvedById: shiven.id,
    },
  })
  await prisma.scopeChange.create({
    data: {
      projectId: proj2.id,
      requestedBy: 'client',
      description: 'Multi-language support (Arabic + English)',
      hoursAdded: 25,
      valueAdded: 2000,
      changeOrderSigned: false,
    },
  })

  await prisma.projectCheckIn.create({
    data: {
      projectId: proj2.id,
      submittedById: rahul.id,
      weekOf: startOfWeek(new Date()),
      progressPct: 45,
      onTrack: 'no',
      scopeChange: 'unlogged',
      clientUpdated: false,
      blockers: 'AR SDK integration taking longer than expected',
      flags: JSON.stringify(['Scope change unlogged', 'Deadline missed', 'No client update']),
      estimateDrift: 65,
    },
  })

  // Lead in interview stage
  const lead4 = await prisma.lead.create({
    data: {
      clientName: 'LogiTrack Systems',
      source: 'Inbound',
      description: 'Fleet management SaaS with GPS tracking and driver app',
      budget: 45000,
      ownerId: kavya.id,
      status: 'interview',
      createdAt: subDays(new Date(), 7),
    },
  })
  await prisma.proposal.create({
    data: {
      leadId: lead4.id,
      writtenById: priya.id,
      sentAt: subDays(new Date(), 5),
      budgetQuoted: 42000,
      techStack: 'React Native, Node.js, WebSockets, PostgreSQL',
      status: 'interview',
      interviewedAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
    },
  })

  // New lead, proposal pending
  const lead5 = await prisma.lead.create({
    data: {
      clientName: 'NutriApp GmbH',
      source: 'LinkedIn',
      description: 'Nutrition tracking app with AI meal recommendations',
      budget: 28000,
      ownerId: kavya.id,
      status: 'proposal_sent',
      createdAt: subDays(new Date(), 3),
    },
  })
  await prisma.proposal.create({
    data: {
      leadId: lead5.id,
      writtenById: kavya.id,
      sentAt: subDays(new Date(), 2),
      budgetQuoted: 27500,
      techStack: 'React Native, Python/FastAPI, Claude API',
      connectsSpent: 8,
      status: 'sent',
    },
  })

  // Delivered project with post-mortem
  const lead6 = await prisma.lead.create({
    data: {
      clientName: 'ShopEasy AU',
      source: 'Upwork',
      description: 'E-commerce platform rebuild',
      budget: 15000,
      ownerId: kavya.id,
      status: 'won',
      createdAt: subDays(new Date(), 90),
    },
  })
  const proj3 = await prisma.project.create({
    data: {
      name: 'ShopEasy E-commerce Rebuild',
      leadId: lead6.id,
      developerId: amit.id,
      bdMemberId: kavya.id,
      status: 'delivered',
      contractValue: 14500,
      estimatedHours: 200,
      actualHours: 285,
      startDate: subDays(new Date(), 85),
      estimatedEnd: subDays(new Date(), 40),
      actualEnd: subDays(new Date(), 28),
      techStack: 'Next.js, Stripe, Shopify API',
      clientName: 'ShopEasy AU',
      channel: 'Upwork',
      clientScore: 6,
      onTime: false,
    },
  })
  await prisma.postMortem.create({
    data: {
      projectId: proj3.id,
      estimationAccuracy: 1.42,
      scopeDriftHours: 35,
      clientSatisfaction: 6,
      onTime: false,
      whatWorked: 'Stripe integration, UI consistency',
      whatBroke: 'Shopify API rate limits not accounted for in estimation. Scope expanded without change order.',
      rootCause: 'Estimation done without researching 3rd party API constraints. No scope change protocol followed.',
      preventionAction: 'Add API research checklist to estimation template. Enforce change order policy.',
    },
  })

  // ── Weekly Scores (last 6 weeks) ──────────────────────────
  const members = [vishal, rahul, priya, amit, kavya]
  const weeklyData = [
    // week 6 (oldest)
    { v: [5,5,6,5,7], r: [5,4,5,6,6], p: [6,5,6,7,7], a: [4,3,4,4,5], k: [7,6,7,7,8] },
    // week 5
    { v: [6,6,7,6,7], r: [5,5,5,6,6], p: [6,6,7,7,7], a: [4,4,5,5,5], k: [7,7,7,8,8] },
    // week 4
    { v: [7,6,7,7,8], r: [6,5,6,6,7], p: [7,6,7,7,8], a: [5,4,5,5,6], k: [8,7,8,8,9] },
    // week 3
    { v: [7,7,8,7,8], r: [6,6,6,6,7], p: [7,7,7,8,8], a: [5,5,5,5,6], k: [8,8,8,8,9] },
    // week 2
    { v: [8,7,8,7,9], r: [7,6,7,7,8], p: [8,7,8,8,8], a: [5,4,5,5,6], k: [9,8,8,9,9] },
    // week 1 (most recent)
    { v: [8,8,9,8,9], r: [7,7,7,7,8], p: [8,7,8,8,9], a: [6,5,6,6,7], k: [9,8,9,9,9] },
  ]
  const dims = ['delivery', 'process', 'communication', 'growth', 'culture'] as const
  const memberKeys = ['v', 'r', 'p', 'a', 'k'] as const

  for (let w = 0; w < 6; w++) {
    const weekOf = startOfWeek(subWeeks(new Date(), 5 - w))
    const row = weeklyData[w] as Record<string, number[]>
    for (let mi = 0; mi < members.length; mi++) {
      const key = memberKeys[mi]
      const scores = row[key]
      await prisma.weeklyScore.upsert({
        where: { memberId_weekOf_founderScore: { memberId: members[mi].id, weekOf, founderScore: false } },
        update: {},
        create: {
          memberId: members[mi].id,
          weekOf,
          delivery: scores[0],
          process: scores[1],
          communication: scores[2],
          growth: scores[3],
          culture: scores[4],
          founderScore: false,
          repeatedMistake: mi === 3 && w < 3,
        },
      })
    }
  }

  console.log('✅ Seed complete')
}

main().catch(e => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())

// ── QA Team member (append to existing seed) ──────────────────
// Already seeded above — adding QA-specific data

async function seedQA() {
  const prisma2 = prisma

  // Get existing members
  const [vishal, rahul, amit] = await Promise.all([
    prisma2.teamMember.findFirst({ where: { email: 'vishal@keymouse.com' } }),
    prisma2.teamMember.findFirst({ where: { email: 'rahul@keymouse.com' } }),
    prisma2.teamMember.findFirst({ where: { email: 'amit@keymouse.com' } }),
  ])

  // Add QA member
  const qa = await prisma2.teamMember.upsert({
    where: { email: 'neha@keymouse.com' },
    update: {},
    create: { name: 'Neha Joshi', email: 'neha@keymouse.com', role: 'QA' },
  })

  // Get active projects
  const projects = await prisma2.project.findMany({ take: 2, orderBy: { createdAt: 'asc' } })
  if (!projects.length || !vishal || !rahul || !amit) {
    // prisma2 is alias for prisma
    return
  }

  const proj1 = projects[0]
  const proj2 = projects[1]

  // QA check-ins for proj1 (healthy)
  for (let w = 3; w >= 1; w--) {
    await prisma2.qACheckIn.upsert({
      where: { projectId_weekOf: { projectId: proj1.id, weekOf: startOfWeek(subWeeks(new Date(), w)) } },
      update: {},
      create: {
        projectId: proj1.id,
        submittedById: qa.id,
        weekOf: startOfWeek(subWeeks(new Date(), w)),
        testCasesTotal: 40 + (3 - w) * 15,
        testCasesPassed: 35 + (3 - w) * 14,
        testCasesFailed: 2,
        testCasesPending: 3 + (3 - w),
        bugsOpenCritical: 0,
        bugsOpenMajor: w === 3 ? 2 : 1,
        bugsOpenMinor: w === 3 ? 5 : w === 2 ? 3 : 1,
        bugsClosedThisWeek: w === 3 ? 0 : 4,
        readyForDelivery: w === 1,
        notes: w === 1 ? 'All critical and major bugs resolved. Ready for client UAT.' : 'Testing in progress — auth module done, appointment module in progress.',
      },
    })
  }

  // Bugs for proj1
  await prisma2.bug.createMany({
    skipDuplicates: true,
    data: [
      {
        projectId: proj1.id, title: 'Session timeout not handled on appointment booking',
        description: 'User loses form data when session expires mid-booking.',
        severity: 'major', type: 'functional', status: 'verified',
        foundById: qa.id, environment: 'staging', clientReported: false,
        assignedToId: vishal.id, assignedAt: subDays(new Date(), 18),
        fixedAt: subDays(new Date(), 16), verifiedById: qa.id, verifiedAt: subDays(new Date(), 15),
        qaChecklistMiss: false,
      },
      {
        projectId: proj1.id, title: 'Date picker UI broken on mobile Safari',
        description: 'Appointment date picker does not open on iOS Safari 17.',
        severity: 'major', type: 'ui', status: 'fixed',
        foundById: qa.id, environment: 'staging', clientReported: false,
        assignedToId: vishal.id, assignedAt: subDays(new Date(), 10),
        fixedAt: subDays(new Date(), 8),
        qaChecklistMiss: false,
      },
      {
        projectId: proj1.id, title: 'EHR sync shows duplicate records under load',
        description: 'When syncing >100 records simultaneously, duplicates appear.',
        severity: 'critical', type: 'functional', status: 'in_progress',
        foundById: qa.id, environment: 'staging', clientReported: false,
        assignedToId: vishal.id, assignedAt: subDays(new Date(), 3),
        qaChecklistMiss: false,
      },
      {
        projectId: proj1.id, title: 'Notification emails have wrong sender name',
        description: 'Appointment confirmation emails show "undefined" as sender.',
        severity: 'minor', type: 'functional', status: 'open',
        foundById: qa.id, environment: 'staging', clientReported: false,
        qaChecklistMiss: false,
      },
    ],
  })

  // QA check-in for proj2 (at-risk project)
  await prisma2.qACheckIn.upsert({
    where: { projectId_weekOf: { projectId: proj2.id, weekOf: startOfWeek(new Date()) } },
    update: {},
    create: {
      projectId: proj2.id,
      submittedById: qa.id,
      weekOf: startOfWeek(new Date()),
      testCasesTotal: 20,
      testCasesPassed: 6,
      testCasesFailed: 8,
      testCasesPending: 6,
      bugsOpenCritical: 3,
      bugsOpenMajor: 5,
      bugsOpenMinor: 4,
      bugsClosedThisWeek: 1,
      readyForDelivery: false,
      blockers: 'AR module not stable enough to test. Dev changes breaking existing test cases daily.',
      notes: 'Cannot proceed with QA until dev stabilises the AR feature branch.',
    },
  })

  // Bugs for proj2 — including one client-reported (red flag)
  await prisma2.bug.createMany({
    skipDuplicates: true,
    data: [
      {
        projectId: proj2.id, title: 'Map search returns wrong results for Arabic address input',
        description: 'RTL text input breaks the geocoding query.',
        severity: 'critical', type: 'functional', status: 'open',
        foundById: qa.id, environment: 'staging', clientReported: false,
        assignedToId: rahul.id, assignedAt: subDays(new Date(), 5),
        qaChecklistMiss: false,
      },
      {
        projectId: proj2.id, title: 'Property listing images not loading on 3G connection',
        description: 'No lazy loading, no fallback. Blank boxes shown.',
        severity: 'major', type: 'performance', status: 'open',
        foundById: qa.id, environment: 'staging', clientReported: false,
        qaChecklistMiss: false,
      },
      {
        projectId: proj2.id, title: 'App crashes on Android 12 when opening AR preview',
        description: 'NullPointerException in AR module — reproduced consistently.',
        severity: 'critical', type: 'functional', status: 'open',
        foundById: qa.id, environment: 'dev', clientReported: false,
        assignedToId: rahul.id, assignedAt: subDays(new Date(), 2),
        qaChecklistMiss: false,
      },
      // This one is the red flag — client found it
      {
        projectId: proj2.id, title: 'Filter by price range not working — client demo failure',
        description: 'Client showed the app to their investors. Price filter returned no results. QA did not test this flow.',
        severity: 'critical', type: 'functional', status: 'fixed',
        foundById: qa.id, environment: 'production', clientReported: true,
        assignedToId: rahul.id, assignedAt: subDays(new Date(), 7),
        fixedAt: subDays(new Date(), 6), verifiedById: qa.id, verifiedAt: subDays(new Date(), 6),
        qaChecklistMiss: true,
        rootCause: 'Price filter test case existed but was marked skip due to time pressure. Should never have been skipped.',
      },
    ],
  })

  console.log('✅ QA seed complete — Neha Joshi added, bugs and check-ins seeded')
  // prisma2 is alias for prisma
}

seedQA().catch(console.error)

// ── Daily log seed data ───────────────────────────────────────
async function seedDailyLogs() {
  const prisma3 = prisma

  const members = await prisma3.teamMember.findMany({ where: { active: true } })
  const projects = await prisma3.project.findMany({
    where: { status: { in: ['active','qa','scoping'] } },
    take: 3,
  })

  if (!members.length || !projects.length) {
    // prisma3 is alias for prisma
    return
  }

  // Seed last 5 working days
  const workingDays: Date[] = []
  let d = new Date()
  while (workingDays.length < 5) {
    d = subDays(d, 1)
    if (d.getDay() !== 0 && d.getDay() !== 6) workingDays.push(startOfDay(d))
  }

  const taskTitles = [
    ['Build appointment booking API endpoint', 'feature'],
    ['Fix date picker bug on mobile Safari', 'bug'],
    ['Code review — auth module PR', 'review'],
    ['Write unit tests for booking service', 'qa'],
    ['Daily standup + sprint planning', 'meeting'],
    ['Map search integration with Google Maps API', 'feature'],
    ['Fix price filter returning empty results', 'bug'],
    ['Research EHR API rate limits', 'research'],
    ['Update API documentation', 'admin'],
    ['Regression testing — appointment flow', 'qa'],
  ]

  for (const member of members.slice(0, 4)) {
    for (let wi = 0; wi < workingDays.length; wi++) {
      const day = workingDays[wi]
      const numTasks = 2 + Math.floor(Math.random() * 3)
      const selectedTasks = taskTitles.sort(() => 0.5 - Math.random()).slice(0, numTasks)
      const completionRate = 0.5 + Math.random() * 0.5

      try {
        const log = await prisma3.dailyLog.upsert({
          where: { memberId_date: { memberId: member.id, date: day } },
          update: {},
          create: {
            memberId: member.id,
            date: day,
            planSubmittedAt: new Date(day.getTime() + 9 * 3600000),
            eodSubmittedAt: new Date(day.getTime() + 18 * 3600000),
            dayRating: 2 + Math.floor(Math.random() * 3),
            blockers: wi === 0 && member === members[1] ? 'Waiting on client to approve the AR feature spec before proceeding' : null,
            carryOver: completionRate < 0.8 ? 'Carry forward remaining test cases to tomorrow' : null,
            completionRate,
          },
        })

        for (let ti = 0; ti < selectedTasks.length; ti++) {
          const [title, taskType] = selectedTasks[ti]
          const estHours = 1 + Math.floor(Math.random() * 3)
          const isDone = ti / selectedTasks.length < completionRate
          const actualHours = isDone
            ? estHours + (Math.random() > 0.5 ? 0.5 : -0.5)
            : 0

          await prisma3.dailyTask.create({
            data: {
              dailyLogId: log.id,
              projectId: projects[ti % projects.length]?.id ?? null,
              title,
              taskType,
              priority: ti === 0 ? 'high' : ti === 1 ? 'medium' : 'low',
              estimatedHours: estHours,
              status: isDone ? 'done' : wi === 0 && ti === 1 ? 'blocked' : 'moved',
              actualHours: isDone ? actualHours : null,
              blockedReason: wi === 0 && ti === 1 ? 'API documentation not available yet' : null,
            },
          })
        }
      } catch (_) {
        // skip if already exists
      }
    }
  }

  console.log('✅ Daily logs seeded — last 5 working days')
  // prisma3 is alias for prisma
}

seedDailyLogs().catch(console.error)

// ── Test cycle seed (new QA model) ───────────────────────────────────────────
const seedTestCycles = async () => {
  const pr = prisma
  const projects = await pr.project.findMany({ where: { status: { in: ['qa','active'] } }, take: 2 })
  const neha = await pr.teamMember.findFirst({ where: { email: 'neha@keymouse.com' } })
  if (!projects.length || !neha) { return }

  for (const p of projects.slice(0, 1)) {
    try {
      await pr.testCycle.create({
        data: {
          projectId:       p.id,
          conductedById:   neha.id,
          cycleType:       'regression',
          environment:     'staging',
          result:          'conditional',
          completedAt:     new Date(),
          testedAuth:      true,
          testedCoreFlows: true,
          testedEdgeCases: true,
          testedMobile:    true,
          summary:         'All core flows passing on staging. Auth, booking, and dashboard confirmed. Mobile layout has one minor cosmetic issue on iOS 17 — client is aware and accepted. Regression against previous release: all passing.',
          blockerNote:     'iOS 17 button spacing issue — cosmetic only, client acknowledged.',
        },
      })
    } catch (_) {}
  }

  // Seed a post-delivery issue on a delivered project
  const delivered = await pr.project.findFirst({ where: { status: 'delivered' } })
  if (delivered) {
    try {
      await pr.postDeliveryIssue.create({
        data: {
          projectId:   delivered.id,
          description: 'Date picker not working on Android Chrome 124 — client reported via WhatsApp',
          severity:    'high',
          reportedBy:  'Client via WhatsApp',
          wasInScope:  true,
          rootCause:   'Android Chrome not included in cross-browser test matrix for this release',
        },
      })
    } catch (_) {}
  }

  console.log('✅ Test cycle + post-delivery issue seeded')
  // pr is alias for prisma
}

seedTestCycles().catch(console.error)
