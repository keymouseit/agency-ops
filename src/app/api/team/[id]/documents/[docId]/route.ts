import { NextResponse } from 'next/server'
import { authorizeRole } from '@/lib/auth'
import { canEditMember, TEAM_EDITOR_ROLES } from '@/lib/team-permissions'
import { findDocumentWithMember, handleDocumentDelete } from '@/lib/employee-documents-server'

export const dynamic = 'force-dynamic'

/** DELETE — remove a member's document (Founder/Manager/HR; HR not for Founder/Manager). */
export async function DELETE(
  req: Request,
  { params }: { params: { id: string; docId: string } },
) {
  const authResult = await authorizeRole(TEAM_EDITOR_ROLES)
  if (authResult instanceof NextResponse) return authResult

  const doc = await findDocumentWithMember(params.docId)
  if (!doc || doc.memberId !== params.id) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 })
  }
  if (!canEditMember(authResult.role, doc.member.role)) {
    return NextResponse.json(
      { error: "You do not have permission to manage this member's documents." },
      { status: 403 },
    )
  }
  return handleDocumentDelete(req, doc, doc.member, { id: authResult.memberId })
}
