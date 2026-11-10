import { randomUUID } from 'crypto'
import { NextResponse } from 'next/server'
import { put, del, get } from '@vercel/blob'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { logAudit, getClientIP } from '@/lib/audit'
import { logger } from '@/lib/logger'
import { canEditMember, TEAM_EDITOR_ROLES } from '@/lib/team-permissions'
import {
  detectDocumentMime,
  documentTypeLabel,
  EXTENSION_FOR_MIME,
  getDocumentType,
  invalidDocumentContentMessage,
  MAX_DOCUMENT_LABEL_LENGTH,
  validateDocumentFile,
  type EmployeeDocumentDTO,
} from '@/lib/employee-documents'

/**
 * Blob auth, mirroring @vercel/blob's own resolution order:
 * - On Vercel, a connected store provides BLOB_STORE_ID and the SDK uses the
 *   request's Vercel OIDC token automatically.
 * - Locally (or anywhere without OIDC), BLOB_READ_WRITE_TOKEN is used.
 * BLOB_STORE_ID alone (without OIDC) is not enough, so it is not treated as configured.
 */
export function isDocumentStorageConfigured(): boolean {
  if (process.env.BLOB_READ_WRITE_TOKEN) return true
  const onVercelWithOidc = !!(process.env.VERCEL || process.env.VERCEL_OIDC_TOKEN)
  return !!process.env.BLOB_STORE_ID && onVercelWithOidc
}

export function storageNotConfiguredResponse() {
  return NextResponse.json({ error: 'Document storage is not configured.' }, { status: 503 })
}

const documentSelect = {
  id: true,
  type: true,
  label: true,
  fileName: true,
  mimeType: true,
  size: true,
  createdAt: true,
  updatedAt: true,
  uploadedBy: { select: { id: true, name: true } },
} as const

type DocumentRow = {
  id: string
  type: string
  label: string | null
  fileName: string
  mimeType: string
  size: number
  createdAt: Date
  updatedAt: Date
  uploadedBy: { id: string; name: string } | null
}

export function toDocumentDTO(d: DocumentRow): EmployeeDocumentDTO {
  return {
    id: d.id,
    type: d.type,
    label: d.label,
    fileName: d.fileName,
    mimeType: d.mimeType,
    size: d.size,
    createdAt: d.createdAt.toISOString(),
    updatedAt: d.updatedAt.toISOString(),
    uploadedBy: d.uploadedBy,
  }
}

export async function listMemberDocuments(memberId: string): Promise<EmployeeDocumentDTO[]> {
  const rows = await prisma.employeeDocument.findMany({
    where: { memberId },
    orderBy: [{ type: 'asc' }, { createdAt: 'desc' }],
    select: documentSelect,
  })
  return rows.map(toDocumentDTO)
}

/**
 * For server-rendered pages: never let a documents query failure (e.g. table not
 * created yet) take down the whole page.
 */
export async function listMemberDocumentsSafe(memberId: string): Promise<EmployeeDocumentDTO[]> {
  try {
    return await listMemberDocuments(memberId)
  } catch (error) {
    logger.error('Failed to load employee documents', error as Error, { memberId })
    return []
  }
}

/** Logged-in actor resolved from the DB (role/active checked against the DB, not the JWT). */
export async function getActor(): Promise<{ id: string; name: string; role: string } | null> {
  const session = await auth()
  if (!session?.user?.id) return null
  const member = await prisma.teamMember.findUnique({
    where: { id: session.user.id },
    select: { id: true, name: true, role: true, active: true },
  })
  if (!member?.active) return null
  return { id: member.id, name: member.name, role: member.role }
}

/** Owner always; otherwise Founder/Manager/HR subject to canEditMember (HR ≠ Founder/Manager). */
export function canAccessMemberDocuments(
  actor: { id: string; role: string },
  target: { id: string; role: string },
): boolean {
  if (actor.id === target.id) return true
  return TEAM_EDITOR_ROLES.includes(actor.role) && canEditMember(actor.role, target.role)
}

function auditInfo(req: Request) {
  return {
    ipAddress: getClientIP(req),
    userAgent: req.headers.get('user-agent') || undefined,
  }
}

/**
 * Handles a multipart upload (`type`, `file`, optional `label`) for `member`.
 * Single-file types replace the existing document (old blob deleted after the new one saves).
 */
export async function handleDocumentUpload(
  req: Request,
  member: { id: string; name: string },
  actor: { id: string },
): Promise<NextResponse> {
  if (!isDocumentStorageConfigured()) return storageNotConfiguredResponse()

  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid upload. Please choose a file and try again.' }, { status: 400 })
  }

  const typeDef = getDocumentType(String(form.get('type') ?? ''))
  if (!typeDef) {
    return NextResponse.json({ error: 'Please choose a valid document type.' }, { status: 400 })
  }

  const file = form.get('file')
  if (!file || typeof file === 'string') {
    return NextResponse.json({ error: 'Please choose a file to upload.' }, { status: 400 })
  }

  const fileError = validateDocumentFile(file)
  if (fileError) return NextResponse.json({ error: fileError }, { status: 400 })

  // The real type comes from the file bytes, not the browser MIME/extension: browsers send
  // '', image/x-png etc., and files are often renamed (e.g. a JPEG saved as .png). Any
  // genuine PDF/JPEG/PNG is accepted and stored with its detected type.
  const bytes = new Uint8Array(await file.arrayBuffer())
  const mimeType = detectDocumentMime(bytes)
  if (!mimeType) {
    return NextResponse.json({ error: invalidDocumentContentMessage(bytes) }, { status: 400 })
  }
  const ext = EXTENSION_FOR_MIME[mimeType]

  const rawLabel = typeDef.multiple ? String(form.get('label') ?? '').trim() : ''
  const label = rawLabel ? rawLabel.slice(0, MAX_DOCUMENT_LABEL_LENGTH) : null
  const fileName = (file.name.split(/[\\/]/).pop() || `document${ext}`).slice(0, 200)

  const existing = typeDef.multiple
    ? []
    : await prisma.employeeDocument.findMany({
        where: { memberId: member.id, type: typeDef.id },
        select: { id: true, blobPathname: true, fileName: true },
      })

  const pathname = `employee-docs/${member.id}/${typeDef.id}/${randomUUID()}${ext}`
  let blob: { url: string; pathname: string }
  try {
    blob = await put(pathname, Buffer.from(bytes), {
      access: 'private',
      contentType: mimeType,
      addRandomSuffix: false,
    })
  } catch (error) {
    logger.error('Employee document upload to blob failed', error as Error, { memberId: member.id })
    return NextResponse.json(
      { error: 'Could not store the file. Document storage may not be configured correctly.' },
      { status: 503 },
    )
  }

  let created: DocumentRow
  try {
    created = await prisma.$transaction(async tx => {
      const doc = await tx.employeeDocument.create({
        data: {
          memberId: member.id,
          type: typeDef.id,
          label,
          fileName,
          blobPathname: blob.pathname,
          blobUrl: blob.url,
          mimeType,
          size: file.size,
          uploadedById: actor.id,
        },
        select: documentSelect,
      })
      if (existing.length) {
        await tx.employeeDocument.deleteMany({ where: { id: { in: existing.map(e => e.id) } } })
      }
      return doc
    })
  } catch (error) {
    logger.error('Employee document DB save failed', error as Error, { memberId: member.id })
    await del(blob.pathname).catch(() => undefined)
    return NextResponse.json({ error: 'Failed to save the document. Please try again.' }, { status: 500 })
  }

  // Old blobs are removed only after the new document is saved.
  if (existing.length) {
    await del(existing.map(e => e.blobPathname)).catch(error =>
      logger.error('Failed to delete replaced employee document blob(s)', error as Error, { memberId: member.id }),
    )
  }

  const fieldLabel = `Document: ${documentTypeLabel(typeDef.id)}${label ? ` (${label})` : ''}`
  await logAudit({
    action: 'updated',
    entityType: 'TeamMember',
    entityId: member.id,
    entityName: member.name,
    userId: actor.id,
    changes: { [fieldLabel]: { old: existing[0]?.fileName ?? null, new: fileName } },
    metadata: { document: { action: existing.length ? 'replaced' : 'uploaded', type: typeDef.id, id: created.id } },
    ...auditInfo(req),
  })

  return NextResponse.json({ document: toDocumentDTO(created) }, { status: 201 })
}

/** Deletes a document (row first, then blob) after the caller has checked access. */
export async function handleDocumentDelete(
  req: Request,
  doc: { id: string; type: string; label: string | null; fileName: string; blobPathname: string },
  member: { id: string; name: string },
  actor: { id: string },
): Promise<NextResponse> {
  if (!isDocumentStorageConfigured()) return storageNotConfiguredResponse()

  await prisma.employeeDocument.delete({ where: { id: doc.id } })
  await del(doc.blobPathname).catch(error =>
    logger.error('Failed to delete employee document blob', error as Error, { documentId: doc.id }),
  )

  const fieldLabel = `Document: ${documentTypeLabel(doc.type)}${doc.label ? ` (${doc.label})` : ''}`
  await logAudit({
    action: 'updated',
    entityType: 'TeamMember',
    entityId: member.id,
    entityName: member.name,
    userId: actor.id,
    changes: { [fieldLabel]: { old: doc.fileName, new: null } },
    metadata: { document: { action: 'deleted', type: doc.type, id: doc.id } },
    ...auditInfo(req),
  })

  return NextResponse.json({ success: true })
}

/** Loads a document with its owner (for access checks). */
export function findDocumentWithMember(docId: string) {
  return prisma.employeeDocument.findUnique({
    where: { id: docId },
    select: {
      id: true,
      memberId: true,
      type: true,
      label: true,
      fileName: true,
      blobPathname: true,
      mimeType: true,
      size: true,
      member: { select: { id: true, name: true, role: true } },
    },
  })
}

export { get as getBlob }
