import { waitUntil } from '@vercel/functions'

/**
 * Run a side-effect without blocking the API response.
 * On Vercel, waitUntil keeps the function alive until the work finishes.
 */
export function runInBackground(task: Promise<unknown>, label = 'task'): void {
  const tracked = Promise.resolve(task).catch(err => {
    console.error(`[background:${label}]`, err)
  })
  waitUntil(tracked)
}
