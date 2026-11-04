/**
 * Employee document types and file rules. Client-safe (no server imports) so the
 * upload UI and the API routes validate against the same lists.
 */

export const EMPLOYEE_DOCUMENT_TYPES = [
  { id: 'aadhaar', label: 'Aadhaar card', multiple: false },
  { id: 'pan', label: 'PAN card', multiple: false },
  { id: 'passport', label: 'Passport', multiple: false },
  { id: 'id_proof', label: 'Other ID proof', multiple: false },
  { id: 'resume', label: 'Resume', multiple: false },
  { id: 'offer_letter', label: 'Offer letter', multiple: false },
  { id: 'relieving_letter', label: 'Relieving letter', multiple: false },
  { id: 'experience_letter', label: 'Experience letter', multiple: true },
  { id: 'education_certificate', label: 'Education certificate', multiple: true },
  { id: 'certificate', label: 'Other certificate', multiple: true },
  { id: 'salary_slip', label: 'Salary slip', multiple: true, labelPlaceholder: 'e.g. Oct 2026' },
] as const satisfies ReadonlyArray<{
  id: string
  label: string
  multiple: boolean
  labelPlaceholder?: string
}>

export type EmployeeDocumentTypeId = (typeof EMPLOYEE_DOCUMENT_TYPES)[number]['id']
export type EmployeeDocumentTypeDef = (typeof EMPLOYEE_DOCUMENT_TYPES)[number]

export function getDocumentType(id: string | null | undefined): EmployeeDocumentTypeDef | null {
  return EMPLOYEE_DOCUMENT_TYPES.find(t => t.id === id) ?? null
}

export function documentTypeLabel(id: string): string {
  return getDocumentType(id)?.label ?? id
}

/** 4 MB — keeps uploads under Vercel's ~4.5 MB function request body limit. */
export const MAX_DOCUMENT_BYTES = 4 * 1024 * 1024
export const MAX_DOCUMENT_LABEL_LENGTH = 80

/** Allowed extension → MIME type. */
export const ALLOWED_DOCUMENT_EXTENSIONS: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
}

/** `accept` attribute for file inputs. */
export const DOCUMENT_ACCEPT = '.pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png'

export function fileExtension(fileName: string): string {
  const i = fileName.lastIndexOf('.')
  return i >= 0 ? fileName.slice(i).toLowerCase() : ''
}

/**
 * Validates name/size/MIME. Returns an error message, or null when OK.
 * Some browsers send an empty MIME type; then the extension decides.
 */
export function validateDocumentFile(file: { name: string; size: number; type: string }): string | null {
  const ext = fileExtension(file.name)
  const expectedMime = ALLOWED_DOCUMENT_EXTENSIONS[ext]
  if (!expectedMime) return 'Only PDF, JPG, JPEG or PNG files are allowed.'
  const mime = (file.type || '').toLowerCase()
  const mimeOk = mime === '' || mime === expectedMime || (expectedMime === 'image/jpeg' && mime === 'image/jpg')
  if (!mimeOk) return 'File type does not match its extension. Only PDF, JPG, JPEG or PNG files are allowed.'
  if (file.size <= 0) return 'The file is empty.'
  if (file.size > MAX_DOCUMENT_BYTES) return 'File is too large. Maximum size is 4 MB.'
  return null
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/** Shape sent to the browser (never includes the blob URL / pathname). */
export type EmployeeDocumentDTO = {
  id: string
  type: string
  label: string | null
  fileName: string
  mimeType: string
  size: number
  createdAt: string
  updatedAt: string
  uploadedBy: { id: string; name: string } | null
}
