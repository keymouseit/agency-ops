import { mkdir, writeFile } from 'fs/promises'
import path from 'path'
import { randomUUID } from 'crypto'

const MAX_BYTES = 4 * 1024 * 1024 // 4 MB
const ALLOWED_EXT = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.pdf', '.mp4', '.mov', '.webm']

export async function saveQaBugAttachment(file: File): Promise<string> {
  if (file.size <= 0) throw new Error('Empty file')
  if (file.size > MAX_BYTES) throw new Error('Attachment must be 4 MB or smaller')

  const ext = path.extname(file.name).toLowerCase()
  if (!ALLOWED_EXT.includes(ext)) {
    throw new Error('Unsupported attachment type. Use an image, PDF, or short video.')
  }

  const filename = `${randomUUID()}${ext}`
  const dir = path.join(process.cwd(), 'public', 'uploads', 'qa-bugs')
  await mkdir(dir, { recursive: true })
  await writeFile(path.join(dir, filename), Buffer.from(await file.arrayBuffer()))
  return `/uploads/qa-bugs/${filename}`
}
