import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import AccountClient from './AccountClient'
import ProfileDetailsCard from './ProfileDetailsCard'
import { prisma } from '@/lib/prisma'
import EmployeeDocumentsCard from '@/components/EmployeeDocumentsCard'
import { isDocumentStorageConfigured, listMemberDocumentsSafe } from '@/lib/employee-documents-server'

export const dynamic = 'force-dynamic'

export default async function AccountPage() {
  const session = await auth()

  // All authenticated users can access account settings
  if (!session?.user?.id) {
    redirect('/login')
  }

  // Always read the member fresh from the DB (not the session/JWT) so changes
  // made by Admin/HR (designation, birthday, joining date) show up immediately.
  const member = await prisma.teamMember.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      active: true,
      createdAt: true,
      designation: true,
      birthday: true,
      joiningDate: true,
    },
  })

  if (!member) {
    redirect('/login')
  }

  const documents = await listMemberDocumentsSafe(member.id)

  return (
    <AccountClient
      member={member}
      profileDetails={
        <div className="space-y-6">
          <ProfileDetailsCard member={member} />
          <EmployeeDocumentsCard
            apiBase="/api/account/documents"
            initialDocuments={documents}
            storageConfigured={isDocumentStorageConfigured()}
          />
        </div>
      }
    />
  )
}
