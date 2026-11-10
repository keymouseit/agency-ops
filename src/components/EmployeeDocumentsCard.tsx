'use client'

import { useCallback, useRef, useState } from 'react'
import {
  detectDocumentMime,
  DOCUMENT_ACCEPT,
  DOCUMENT_SNIFF_BYTES,
  documentTypeLabel,
  EMPLOYEE_DOCUMENT_TYPES,
  getDocumentType,
  invalidDocumentContentMessage,
  formatFileSize,
  validateDocumentFile,
  type EmployeeDocumentDTO,
  type EmployeeDocumentTypeDef,
} from '@/lib/employee-documents'
import { fmtDate } from '@/lib/utils'

type Props = {
  /** e.g. `/api/account/documents` or `/api/team/<id>/documents` (GET/POST; DELETE at `${apiBase}/<docId>`). */
  apiBase: string
  initialDocuments: EmployeeDocumentDTO[]
  storageConfigured: boolean
  title?: string
  description?: string
}

type UploadState = { typeId: string; progress: number } | null

function uploadWithProgress(
  url: string,
  form: FormData,
  onProgress: (pct: number) => void,
): Promise<{ ok: boolean; status: number; body: any }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', url)
    xhr.upload.onprogress = e => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100))
    }
    xhr.onload = () => {
      let body: any = null
      try {
        body = JSON.parse(xhr.responseText)
      } catch {
        /* non-JSON error page */
      }
      resolve({ ok: xhr.status >= 200 && xhr.status < 300, status: xhr.status, body })
    }
    xhr.onerror = () => reject(new Error('Network error while uploading. Please try again.'))
    xhr.send(form)
  })
}

export default function EmployeeDocumentsCard({
  apiBase,
  initialDocuments,
  storageConfigured,
  title = 'My documents',
  description = 'Upload your ID proofs, resume, letters and certificates. PDF, JPG or PNG, up to 4 MB each.',
}: Props) {
  const [documents, setDocuments] = useState<EmployeeDocumentDTO[]>(initialDocuments)
  const [upload, setUpload] = useState<UploadState>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [error, setError] = useState<{ typeId: string; message: string } | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [labels, setLabels] = useState<Record<string, string>>({})
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({})

  const busy = upload !== null || deletingId !== null

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(apiBase, { cache: 'no-store' })
      if (res.ok) {
        const data = await res.json()
        if (Array.isArray(data.documents)) setDocuments(data.documents)
      }
    } catch {
      /* keep current list */
    }
  }, [apiBase])

  async function handleFile(typeDef: EmployeeDocumentTypeDef, file: File | undefined) {
    const input = inputRefs.current[typeDef.id]
    if (input) input.value = ''
    if (!file) return
    setError(null)
    setSuccess(null)

    const validationError = validateDocumentFile(file)
    if (validationError) {
      setError({ typeId: typeDef.id, message: validationError })
      return
    }

    // Same content check as the server, so the user gets instant feedback.
    try {
      const head = new Uint8Array(await file.slice(0, DOCUMENT_SNIFF_BYTES).arrayBuffer())
      if (!detectDocumentMime(head)) {
        setError({ typeId: typeDef.id, message: invalidDocumentContentMessage(head) })
        return
      }
    } catch {
      /* couldn't read locally — let the server decide */
    }

    const form = new FormData()
    form.append('type', typeDef.id)
    form.append('file', file)
    const label = typeDef.multiple ? (labels[typeDef.id] || '').trim() : ''
    if (label) form.append('label', label)

    setUpload({ typeId: typeDef.id, progress: 0 })
    try {
      const res = await uploadWithProgress(apiBase, form, pct =>
        setUpload({ typeId: typeDef.id, progress: pct }),
      )
      if (!res.ok) {
        const message =
          res.body?.error ||
          (res.status === 413 ? 'File is too large. Maximum size is 4 MB.' : 'Upload failed. Please try again.')
        setError({ typeId: typeDef.id, message })
        return
      }
      setLabels(prev => ({ ...prev, [typeDef.id]: '' }))
      setSuccess(`${typeDef.label} uploaded.`)
      await refresh()
    } catch (e) {
      setError({ typeId: typeDef.id, message: e instanceof Error ? e.message : 'Upload failed.' })
    } finally {
      setUpload(null)
    }
  }

  async function handleDelete(typeDef: { id: string; label: string }, doc: EmployeeDocumentDTO) {
    const name = doc.label ? `${typeDef.label} (${doc.label})` : typeDef.label
    if (!window.confirm(`Delete ${name} — "${doc.fileName}"? This cannot be undone.`)) return
    setError(null)
    setSuccess(null)
    setDeletingId(doc.id)
    try {
      const res = await fetch(`${apiBase}/${doc.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        setError({ typeId: typeDef.id, message: body?.error || 'Delete failed. Please try again.' })
        return
      }
      setSuccess(`${name} deleted.`)
      await refresh()
    } catch {
      setError({ typeId: typeDef.id, message: 'Network error while deleting. Please try again.' })
    } finally {
      setDeletingId(null)
    }
  }

  const uploadedCount = new Set(documents.filter(d => getDocumentType(d.type)).map(d => d.type)).size
  // Documents whose type is no longer offered (e.g. removed Resume / Other ID proof):
  // still shown so they can be viewed or deleted, but nothing new can be uploaded there.
  const otherDocs = documents.filter(d => !getDocumentType(d.type))

  const renderDocRow = (doc: EmployeeDocumentDTO, typeDef: { id: string; label: string }, showType = false) => (
    <li key={doc.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
      <div className="min-w-0">
        <p className="truncate text-xs font-medium text-gray-800" title={doc.fileName}>
          {showType && <span className="text-gray-500">{typeDef.label} · </span>}
          {doc.label && <span className="text-gray-500">{doc.label} · </span>}
          {doc.fileName}
        </p>
        <p className="text-[11px] text-gray-400">
          {formatFileSize(doc.size)} · {fmtDate(doc.createdAt)}
          {doc.uploadedBy ? ` · by ${doc.uploadedBy.name}` : ''}
        </p>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <a
          href={`/api/documents/${doc.id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs font-semibold text-blue-600 hover:underline"
        >
          View
        </a>
        <button
          type="button"
          onClick={() => handleDelete(typeDef, doc)}
          disabled={busy || !storageConfigured}
          className="text-xs font-semibold text-red-600 hover:underline disabled:cursor-not-allowed disabled:opacity-50"
        >
          {deletingId === doc.id ? 'Deleting…' : 'Delete'}
        </button>
      </div>
    </li>
  )

  return (
    <section className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/60 flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white border border-gray-100 text-base shadow-sm">
            📁
          </div>
          <div>
            <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
            <p className="text-xs text-gray-500 mt-0.5">{description}</p>
          </div>
        </div>
        <p className="text-[11px] font-semibold text-gray-400 tabular-nums shrink-0 mt-1">
          {uploadedCount}/{EMPLOYEE_DOCUMENT_TYPES.length} types
        </p>
      </div>

      <div className="p-5 space-y-3">
        {!storageConfigured && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
            Document storage is not configured yet, so uploads are unavailable. Please contact Admin.
          </div>
        )}
        {success && (
          <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-2 text-xs text-green-800">
            {success}
          </div>
        )}

        <ul className="space-y-2">
          {EMPLOYEE_DOCUMENT_TYPES.map(typeDef => {
            const docs = documents.filter(d => d.type === typeDef.id)
            const uploadingHere = upload?.typeId === typeDef.id
            const typeError = error?.typeId === typeDef.id ? error.message : null
            const canAdd = typeDef.multiple || docs.length === 0
            const actionLabel = typeDef.multiple ? (docs.length ? 'Add another' : 'Upload') : docs.length ? 'Replace' : 'Upload'
            const placeholder =
              'labelPlaceholder' in typeDef && typeDef.labelPlaceholder ? typeDef.labelPlaceholder : 'Label (optional)'

            return (
              <li key={typeDef.id} className="rounded-lg border border-gray-200 bg-gray-50/50 px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900">
                      {typeDef.label}
                      {typeDef.multiple && (
                        <span className="ml-1.5 text-[11px] font-normal text-gray-400">multiple allowed</span>
                      )}
                    </p>
                    {docs.length === 0 && <p className="text-xs text-gray-400 mt-0.5">Not uploaded</p>}
                  </div>

                  <div className="flex items-center gap-2">
                    {typeDef.multiple && (
                      <input
                        type="text"
                        value={labels[typeDef.id] ?? ''}
                        onChange={e => setLabels(prev => ({ ...prev, [typeDef.id]: e.target.value }))}
                        placeholder={placeholder}
                        maxLength={80}
                        disabled={busy || !storageConfigured}
                        className="w-36 rounded-md border border-gray-300 bg-white px-2 py-1 text-xs text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none disabled:opacity-50"
                      />
                    )}
                    <input
                      ref={el => {
                        inputRefs.current[typeDef.id] = el
                      }}
                      type="file"
                      accept={DOCUMENT_ACCEPT}
                      className="hidden"
                      onChange={e => handleFile(typeDef, e.target.files?.[0])}
                    />
                    {(canAdd || !typeDef.multiple) && (
                      <button
                        type="button"
                        onClick={() => inputRefs.current[typeDef.id]?.click()}
                        disabled={busy || !storageConfigured}
                        className="rounded-md border border-gray-300 bg-white px-3 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {uploadingHere ? `Uploading… ${upload?.progress ?? 0}%` : actionLabel}
                      </button>
                    )}
                  </div>
                </div>

                {uploadingHere && (
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-gray-200">
                    <div
                      className="h-full rounded-full bg-blue-600 transition-all"
                      style={{ width: `${upload?.progress ?? 0}%` }}
                    />
                  </div>
                )}

                {docs.length > 0 && (
                  <ul className="mt-2 divide-y divide-gray-100 rounded-md border border-gray-100 bg-white">
                    {docs.map(doc => renderDocRow(doc, typeDef))}
                  </ul>
                )}

                {typeError && <p className="mt-2 text-xs text-red-600">{typeError}</p>}
              </li>
            )
          })}

          {otherDocs.length > 0 && (
            <li className="rounded-lg border border-gray-200 bg-gray-50/50 px-4 py-3">
              <p className="text-sm font-medium text-gray-900">Other documents</p>
              <p className="text-xs text-gray-400 mt-0.5">
                Uploaded under a document type that is no longer used. You can view or delete them.
              </p>
              <ul className="mt-2 divide-y divide-gray-100 rounded-md border border-gray-100 bg-white">
                {otherDocs.map(doc =>
                  renderDocRow(doc, { id: doc.type, label: documentTypeLabel(doc.type) }, true),
                )}
              </ul>
              {error && otherDocs.some(d => d.type === error.typeId) && (
                <p className="mt-2 text-xs text-red-600">{error.message}</p>
              )}
            </li>
          )}
        </ul>
      </div>
    </section>
  )
}
