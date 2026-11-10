import { NextResponse } from 'next/server'
import {
  canAccessMemberDocuments,
  findDocumentWithMember,
  getActor,
  getBlob,
  isDocumentStorageConfigured,
  storageNotConfiguredResponse,
} from '@/lib/employee-documents-server'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

/**
 * GET — stream a document from the private blob store.
 * Allowed for the owner, or Founder/Manager/HR (HR not for Founder/Manager documents).
 * `?download=1` forces a download instead of opening inline.
 */
export async function GET(req: Request, { params }: { params: { docId: string } }) {
  const actor = await getActor()
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const doc = await findDocumentWithMember(params.docId)
  if (!doc || !canAccessMemberDocuments(actor, doc.member)) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 })
  }
  if (!isDocumentStorageConfigured()) return storageNotConfiguredResponse()

  let result: Awaited<ReturnType<typeof getBlob>>
  try {
    result = await getBlob(doc.blobPathname, { access: 'private', useCache: false })
  } catch (error) {
    logger.error('Employee document download failed', error as Error, { documentId: doc.id })
    return NextResponse.json({ error: 'Could not load the document. Please try again.' }, { status: 502 })
  }
  // get() returns null when the blob does not exist. We never send ifNoneMatch,
  // so a 304 (null stream) is not expected; treat it as missing too.
  if (result === null || result.statusCode !== 200) {
    return NextResponse.json({ error: 'Document file not found' }, { status: 404 })
  }

  const download = new URL(req.url).searchParams.get('download') === '1'
  const asciiName = doc.fileName.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_')
  const disposition = `${download ? 'attachment' : 'inline'}; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(doc.fileName)}`

  return new NextResponse(result.stream, {
    headers: {
      'Content-Type': result.blob.contentType || doc.mimeType,
      'Content-Disposition': disposition,
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'private, no-store',
      'Content-Length': String(result.blob.size),
    },
  })
}
