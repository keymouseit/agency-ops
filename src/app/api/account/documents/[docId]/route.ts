import { NextResponse } from 'next/server'
import {
  findDocumentWithMember,
  getActor,
  handleDocumentDelete,
} from '@/lib/employee-documents-server'

export const dynamic = 'force-dynamic'

/** DELETE — remove one of the logged-in user's own documents. */
export async function DELETE(req: Request, { params }: { params: { docId: string } }) {
  const actor = await getActor()
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const doc = await findDocumentWithMember(params.docId)
  // 404 (not 403) for other people's documents so ids can't be probed.
  if (!doc || doc.memberId !== actor.id) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 })
  }
  return handleDocumentDelete(req, doc, doc.member, actor)
}
