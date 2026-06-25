import { PrismaClient } from '@prisma/client'
import { addDays, subDays, startOfDay } from 'date-fns'

const prisma = new PrismaClient()

async function main() {
  const kavya = await prisma.teamMember.findFirst({ where: { email: 'kavya@keymouse.com' } })
  if (!kavya) throw new Error('Kavya not found — run npm run db:seed first')

  const today = startOfDay(new Date())
  const clientName = 'Rajesh Sharma'
  const companyName = 'Nexa Solutions'

  const existing = await prisma.meetingMinute.count({
    where: { clientName, companyName },
  })
  if (existing >= 2) {
    console.log(`Skipping — ${existing} meetings already exist for ${clientName} · ${companyName}`)
    return
  }

  const samples = [
    {
      meetingDate: subDays(today, 28),
      meetingTime: '11:00',
      clientName,
      companyName,
      clientEmail: 'rajesh@nexasolutions.com',
      clientPhone: '+91 98765 43210',
      meetingType: 'Discovery Call',
      meetingOutcome: 'First call — interested in custom CRM for sales team of 15.',
      attendees: JSON.stringify([{ name: kavya.name, role: 'BD' }]),
      domain: 'SaaS',
      clientPainPoints: 'Spreadsheets for pipeline tracking, no visibility for leadership.',
      ourApproach: 'Proposed phased CRM build with HubSpot-style pipeline views.',
      requirementsFromClient: 'Lead scoring, email sync, mobile app for field reps.',
      followUpDate: subDays(today, 14),
      leadSource: 'LinkedIn',
      nextActionItem: 'Send capability deck and rough timeline.',
      createdById: kavya.id,
    },
    {
      meetingDate: subDays(today, 14),
      meetingTime: '15:30',
      clientName,
      companyName,
      clientEmail: 'rajesh@nexasolutions.com',
      clientPhone: '+91 98765 43210',
      meetingType: 'Follow-up',
      meetingOutcome: 'Second call — scope narrowed to pipeline + reporting. Budget ~AED 45k discussed.',
      attendees: JSON.stringify([{ name: kavya.name, role: 'BD' }]),
      domain: 'SaaS',
      clientPainPoints: 'Needs approval workflow before sending proposals to clients.',
      ourApproach: 'Walked through similar CRM project; offered 10-week delivery.',
      requirementsFromClient: 'Pipeline stages, custom fields, PDF quote generation.',
      followUpDate: addDays(today, 7),
      leadSource: 'LinkedIn',
      nextActionItem: 'Send formal proposal by end of week.',
      createdById: kavya.id,
    },
  ]

  for (const data of samples) {
    await prisma.meetingMinute.create({ data })
  }

  console.log(`✅ Added 2 grouped meetings for ${clientName} · ${companyName}`)
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
