/**
 * Employee document types and file rules. Client-safe (no server imports) so the
 * upload UI and the API routes validate against the same lists.
 */

export const EMPLOYEE_DOCUMENT_TYPES = [
  { id: 'aadhaar', label: 'Aadhaar card', multiple: false },
  { id: 'pan', label: 'PAN card', multiple: false },
  { id: 'passport', label: 'Passport', multiple: false },
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

/**
 * Types that were removed from the upload list. Existing rows with these types are
 * still listed (under "Other documents"), viewable and deletable, but new uploads
 * are rejected because they are not in EMPLOYEE_DOCUMENT_TYPES.
 */
export const LEGACY_DOCUMENT_TYPE_LABELS: Record<string, string> = {
  resume: 'Resume',
  id_proof: 'Other ID proof',
}

export function documentTypeLabel(id: string): string {
  return getDocumentType(id)?.label ?? LEGACY_DOCUMENT_TYPE_LABELS[id] ?? 'Other document'
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

/** MIME types browsers/OSes are known to send for the allowed formats ('' = unknown). */
const ACCEPTED_BROWSER_MIME: Record<string, string[]> = {
  'application/pdf': ['application/pdf', 'application/x-pdf', 'application/acrobat'],
  'image/jpeg': ['image/jpeg', 'image/jpg', 'image/pjpeg'],
  'image/png': ['image/png', 'image/x-png', 'image/apng'],
}
const GENERIC_BROWSER_MIME = ['', 'application/octet-stream', 'binary/octet-stream']

export const INVALID_DOCUMENT_CONTENT_MESSAGE =
  "This file doesn't look like a valid PDF, JPG or PNG. Please re-save or export it as PDF, JPG or PNG and try again."

/**
 * Quick checks on name/size/MIME (no file content). Returns an error message, or null when OK.
 * Extension check is case-insensitive (.PNG, .JPG …). The browser MIME is advisory only:
 * the server decides the real type from the file bytes (see detectDocumentMime).
 */
export function validateDocumentFile(file: { name: string; size: number; type: string }): string | null {
  const ext = fileExtension(file.name)
  const expectedMime = ALLOWED_DOCUMENT_EXTENSIONS[ext]
  if (!expectedMime) return 'Only PDF, JPG, JPEG or PNG files are allowed.'
  const mime = (file.type || '').toLowerCase().split(';')[0].trim()
  const mimeOk =
    GENERIC_BROWSER_MIME.includes(mime) ||
    Object.values(ACCEPTED_BROWSER_MIME).some(list => list.includes(mime))
  if (!mimeOk) return 'Only PDF, JPG, JPEG or PNG files are allowed.'
  if (file.size <= 0) return 'The file is empty.'
  if (file.size > MAX_DOCUMENT_BYTES) return 'File is too large. Maximum size is 4 MB.'
  return null
}

/** Number of leading bytes needed by detectDocumentMime. */
export const DOCUMENT_SNIFF_BYTES = 1024

function startsWith(bytes: Uint8Array, sig: number[], offset = 0): boolean {
  if (bytes.length < offset + sig.length) return false
  return sig.every((b, i) => bytes[offset + i] === b)
}

/**
 * Detects the real format from the file's leading bytes.
 * - PNG:  89 50 4E 47 0D 0A 1A 0A
 * - JPEG: FF D8 FF
 * - PDF:  "%PDF-" anywhere in the first 1024 bytes (allows BOM / leading junk, as PDF readers do)
 */
export function detectDocumentMime(bytes: Uint8Array): 'application/pdf' | 'image/jpeg' | 'image/png' | null {
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png'
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return 'image/jpeg'
  const limit = Math.min(bytes.length, DOCUMENT_SNIFF_BYTES) - 5
  for (let i = 0; i <= limit; i++) {
    if (bytes[i] === 0x25 && bytes[i + 1] === 0x50 && bytes[i + 2] === 0x44 && bytes[i + 3] === 0x46 && bytes[i + 4] === 0x2d) {
      return 'application/pdf'
    }
  }
  return null
}

/** Names common look-alike formats so the error can say what the file really is. */
export function describeUnsupportedFormat(bytes: Uint8Array): string | null {
  const ascii = (from: number, to: number) => String.fromCharCode(...Array.from(bytes.slice(from, to)))
  if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return 'WEBP'
  if (ascii(4, 8) === 'ftyp') {
    const brand = ascii(8, 12).toLowerCase()
    if (brand.startsWith('hei') || brand.startsWith('hev') || brand === 'mif1' || brand === 'msf1') return 'HEIC'
    if (brand.startsWith('avi')) return 'AVIF'
  }
  if (ascii(0, 3) === 'GIF') return 'GIF'
  if (ascii(0, 2) === 'BM') return 'BMP'
  if (startsWith(bytes, [0x49, 0x49, 0x2a, 0x00]) || startsWith(bytes, [0x4d, 0x4d, 0x00, 0x2a])) return 'TIFF'
  return null
}

/** User-facing error for content that is not PDF/JPEG/PNG. */
export function invalidDocumentContentMessage(bytes: Uint8Array): string {
  const actual = describeUnsupportedFormat(bytes)
  return actual
    ? `This file is actually a ${actual} image, which isn't supported. Please convert it to JPG or PNG (or PDF) and try again.`
    : INVALID_DOCUMENT_CONTENT_MESSAGE
}

/** Canonical extension for a detected MIME type. */
export const EXTENSION_FOR_MIME: Record<string, string> = {
  'application/pdf': '.pdf',
  'image/jpeg': '.jpg',
  'image/png': '.png',
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
