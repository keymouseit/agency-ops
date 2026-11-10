import { revalidatePath } from 'next/cache'

/** Pages that read the Holiday table. */
export function revalidateHolidayPages() {
  for (const path of ['/leaves/holidays', '/leaves', '/me', '/', '/daily', '/daily/analytics', '/reports/team']) {
    try {
      revalidatePath(path)
    } catch {
      // revalidatePath can throw outside a request scope — never fail the write for it.
    }
  }
}
