import { NextResponse } from 'next/server'
import { authorizeRole } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { canEditMember, TEAM_EDITOR_ROLES } from '@/lib/team-permissions'
import {
  handleDocumentUpload,
  isDocumentStorageConfigured,
  listMemberDocuments,
} from '@/lib/employee-documents-server'

export const dynamic = 'force-dynamic'

async function authorize(memberId: string) {
  const authResult = await authorizeRole(TEAM_EDITOR_ROLES)
  if (authResult instanceof NextResponse) return { error: authResult }

  const member = await prisma.teamMember.findUnique({
    where: { id: memberId },
    select: { id: true, name: true, role: true },
  })
  if (!member) {
    return { error: NextResponse.json({ error: 'Team member not found' }, { status: 404 }) }
  }
  if (!canEditMember(authResult.role, member.role)) {
    return {
      error: NextResponse.json(
        { error: "You do not have permission to manage this member's documents." },
        { status: 403 },
      ),
    }
  }
  return { actor: { id: authResult.memberId }, member }
}

/** GET — a member's documents (Founder/Manager/HR; HR not for Founder/Manager). */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const result = await authorize(params.id)
  if ('error' in result) return result.error
  const documents = await listMemberDocuments(result.member.id)
  return NextResponse.json({ documents, storageConfigured: isDocumentStorageConfigured() })
}

/** POST (multipart: type, file, label?) — upload / replace a document for the member. */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const result = await authorize(params.id)
  if ('error' in result) return result.error
  return handleDocumentUpload(req, result.member, result.actor)
}
