import { NextResponse } from 'next/server'
import {
  getActor,
  handleDocumentUpload,
  isDocumentStorageConfigured,
  listMemberDocuments,
} from '@/lib/employee-documents-server'

export const dynamic = 'force-dynamic'

/** GET — the logged-in user's own documents. */
export async function GET() {
  const actor = await getActor()
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const documents = await listMemberDocuments(actor.id)
  return NextResponse.json({ documents, storageConfigured: isDocumentStorageConfigured() })
}

/** POST (multipart: type, file, label?) — upload / replace one of the user's own documents. */
export async function POST(req: Request) {
  const actor = await getActor()
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  return handleDocumentUpload(req, { id: actor.id, name: actor.name }, actor)
}
