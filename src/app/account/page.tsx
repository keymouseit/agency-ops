import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import AccountClient from './AccountClient'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export default async function AccountPage() {
  const session = await auth()

  // All authenticated users can access account settings
  if (!session?.user?.id) {
    redirect('/login')
  }

  // Fetch user's current data
  const member = await prisma.teamMember.findUnique({
    where: { id: session.user.id }
  })

  if (!member) {
    redirect('/login')
  }

  return <AccountClient member={member} />
}
