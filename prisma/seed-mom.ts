import { PrismaClient } from '@prisma/client'
import { addDays, subDays, subMonths, startOfDay } from 'date-fns'

const prisma = new PrismaClient()

function attendees(...people: { name: string; role: string }[]) {
  return JSON.stringify(people)
}

async function main() {
  const [shiven, kavya, priya, vishal] = await Promise.all([
    prisma.teamMember.findFirst({ where: { email: 'shiven@keymouse.com' } }),
    prisma.teamMember.findFirst({ where: { email: 'kavya@keymouse.com' } }),
    prisma.teamMember.findFirst({ where: { email: 'priya@keymouse.com' } }),
    prisma.teamMember.findFirst({ where: { email: 'vishal@keymouse.com' } }),
  ])

  if (!kavya || !priya) {
    throw new Error('BD team members not found — run npm run db:seed first')
  }

  const existing = await prisma.meetingMinute.count()
  if (existing >= 8) {
    console.log(`Skipping MOM seed — ${existing} records already in DB`)
    return
  }

  const today = startOfDay(new Date())

  const samples = [
    {
      meetingDate: subMonths(today, 3),
      meetingTime: '10:00',
      clientName: 'Marcus Chen',
      companyName: 'FinFlow Systems',
      clientEmail: 'marcus@finflow.io',
      clientPhone: '+1 415 555 0101',
      meetingType: 'Discovery Call',
      meetingOutcome: 'Interested in MVP for expense tracking dashboard. Budget range $12–15k discussed.',
      attendees: attendees({ name: kavya.name, role: 'BD' }, { name: shiven?.name ?? 'Shiven', role: 'Founder' }),
      domain: 'FinTech',
      clientPainPoints: 'Manual reconciliation taking 20+ hours per week. No real-time visibility.',
      ourApproach: 'Proposed React + Node MVP in 8 weeks with Stripe integration.',
      requirementsFromClient: 'Multi-user roles, export to CSV, mobile-responsive dashboard.',
      followUpDate: subDays(today, 5),
      leadSource: 'LinkedIn',
      nextActionItem: 'Send revised proposal with phased delivery breakdown.',
      meetingVideoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      createdById: kavya.id,
    },
    {
      meetingDate: subMonths(today, 2),
      meetingTime: '15:30',
      clientName: 'Sarah Okonkwo',
      companyName: 'MedTech Partners',
      clientEmail: 'sarah@medtechpartners.com',
      meetingType: 'Demo',
      meetingOutcome: 'Demo went well. Client wants HIPAA compliance details before proceeding.',
      attendees: attendees({ name: kavya.name, role: 'BD' }, { name: vishal?.name ?? 'Vishal', role: 'Dev' }),
      domain: 'Healthcare',
      clientPainPoints: 'Legacy patient intake forms, no portal for appointment booking.',
      ourApproach: 'Walked through HealthSync-style portal demo and security practices.',
      requirementsFromClient: 'HIPAA-ready hosting, EHR integration, patient notifications.',
      followUpDate: subDays(today, 2),
      leadSource: 'Referral',
      nextActionItem: 'Share HIPAA compliance doc and hosting architecture.',
      createdById: kavya.id,
    },
    {
      meetingDate: subMonths(today, 1),
      meetingTime: '11:00',
      clientName: 'James Wright',
      companyName: 'ShopLocal',
      clientEmail: 'james@shoplocal.co',
      meetingType: 'Follow-up',
      meetingOutcome: 'Second call — narrowed scope to inventory sync only. Price sensitivity noted.',
      attendees: attendees({ name: priya.name, role: 'Both' }),
      domain: 'E-commerce',
      clientPainPoints: 'Inventory mismatch between Shopify and warehouse system.',
      ourApproach: 'Suggested phased approach starting with read-only sync.',
      requirementsFromClient: 'Shopify + custom WMS integration, daily sync.',
      followUpDate: today,
      leadSource: 'Upwork',
      nextActionItem: 'Kavya to send fixed-price quote for phase 1.',
      createdById: priya.id,
    },
    {
      meetingDate: subDays(today, 21),
      meetingTime: '09:00',
      clientName: 'Elena Vasquez',
      companyName: 'GreenEnergy Co',
      clientEmail: 'elena@greenenergy.co',
      meetingType: 'Proposal Discussion',
      meetingOutcome: 'Proposal reviewed. Client asked for 2-week extension on decision.',
      attendees: attendees({ name: kavya.name, role: 'BD' }, { name: priya.name, role: 'Both' }),
      domain: 'CleanTech',
      clientPainPoints: 'Field technician scheduling and job tracking on paper.',
      ourApproach: 'Presented $22k proposal with mobile app + admin panel.',
      requirementsFromClient: 'Offline mode for technicians, GPS check-in, photo uploads.',
      followUpDate: addDays(today, 5),
      leadSource: 'Inbound',
      nextActionItem: 'Follow up on 28 Jun for decision.',
      createdById: kavya.id,
    },
    {
      meetingDate: subDays(today, 14),
      meetingTime: '16:00',
      clientName: 'David Park',
      companyName: 'EduLearn Academy',
      clientEmail: 'david@edulearn.edu',
      meetingType: 'Demo',
      meetingOutcome: 'Strong interest in LMS features. Wants to see student progress analytics.',
      attendees: attendees({ name: priya.name, role: 'Both' }, { name: vishal?.name ?? 'Vishal', role: 'Dev' }),
      domain: 'EdTech',
      clientPainPoints: 'Using Google Classroom but needs custom assessments and reporting.',
      ourApproach: 'Demoed quiz builder and cohort analytics module.',
      requirementsFromClient: 'Role-based access, quiz engine, parent portal.',
      followUpDate: addDays(today, 3),
      leadSource: 'LinkedIn',
      nextActionItem: 'Schedule technical deep-dive with their IT lead.',
      meetingVideoUrl: 'https://www.loom.com/share/example',
      createdById: priya.id,
    },
    {
      meetingDate: subDays(today, 10),
      meetingTime: '14:00',
      clientName: 'Rachel Kim',
      companyName: 'CloudOps Ltd',
      clientEmail: 'rachel@cloudops.io',
      meetingType: 'Discovery Call',
      meetingOutcome: 'Early-stage conversation. Needs internal buy-in from CTO.',
      attendees: attendees({ name: kavya.name, role: 'BD' }),
      domain: 'SaaS / DevOps',
      clientPainPoints: 'No unified dashboard for multi-cloud cost monitoring.',
      ourApproach: 'Shared case study from similar FinOps project.',
      requirementsFromClient: 'AWS + GCP cost aggregation, alerting, team budgets.',
      followUpDate: addDays(today, 10),
      leadSource: 'Direct',
      nextActionItem: 'Send one-pager and case study PDF.',
      createdById: kavya.id,
    },
    {
      meetingDate: subDays(today, 7),
      meetingTime: '10:30',
      clientName: 'Tom Bradley',
      companyName: 'LegalEase',
      clientEmail: 'tom@legalease.com',
      meetingType: 'Follow-up',
      meetingOutcome: 'Clarified document automation scope. Competitor also in the running.',
      attendees: attendees({ name: kavya.name, role: 'BD' }, { name: shiven?.name ?? 'Shiven', role: 'Founder' }),
      domain: 'LegalTech',
      clientPainPoints: 'Contract review bottleneck — 3-day turnaround unacceptable.',
      ourApproach: 'Positioned AI-assisted review with human-in-the-loop workflow.',
      requirementsFromClient: 'Template library, clause extraction, approval workflow.',
      leadSource: 'Referral',
      nextActionItem: 'Founder to join final call next week.',
      createdById: kavya.id,
    },
    {
      meetingDate: subDays(today, 3),
      meetingTime: '13:00',
      clientName: 'Anita Desai',
      companyName: 'RetailMax',
      clientEmail: 'anita@retailmax.in',
      meetingType: 'Demo',
      meetingOutcome: 'Positive reaction to POS integration demo. Budget approved internally.',
      attendees: attendees({ name: priya.name, role: 'Both' }),
      domain: 'Retail',
      clientPainPoints: 'Fragmented sales data across 12 store locations.',
      ourApproach: 'Live demo of unified reporting dashboard.',
      requirementsFromClient: 'Real-time sales feed, regional manager views, Excel export.',
      followUpDate: addDays(today, 7),
      leadSource: 'Upwork',
      nextActionItem: 'Draft SOW for 6-week implementation.',
      createdById: priya.id,
    },
    {
      meetingDate: subDays(today, 1),
      meetingTime: '17:00',
      clientName: 'Chris Morgan',
      companyName: 'PropStack',
      clientEmail: 'chris@propstack.com',
      meetingType: 'Proposal Discussion',
      meetingOutcome: 'Proposal accepted in principle. Contract review with their legal team.',
      attendees: attendees({ name: kavya.name, role: 'BD' }, { name: priya.name, role: 'Both' }),
      domain: 'PropTech',
      clientPainPoints: 'Tenant portal outdated, high support ticket volume.',
      ourApproach: 'Fixed-price proposal at $18k with 10-week timeline.',
      requirementsFromClient: 'Tenant portal rebuild, maintenance request flow, payment history.',
      followUpDate: addDays(today, 14),
      leadSource: 'Inbound',
      nextActionItem: 'Send MSA template and project kickoff checklist.',
      createdById: kavya.id,
    },
  ]

  for (const data of samples) {
    await prisma.meetingMinute.create({ data })
  }

  console.log(`✅ Seeded ${samples.length} meeting minutes (${existing} existing kept)`)
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
