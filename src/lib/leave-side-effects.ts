/**
 * Leave email + calendar are external side effects.
 * Skip them automatically on local/dev so UI/DB testing does not create real mail or calendar noise.
 * Production on Vercel keeps current behavior — no extra env flags required.
 *
 * Detection mirrors existing patterns:
 * - NODE_ENV === 'development' (prisma, logger)
 * - process.env.VERCEL (salesrobot sync isVercelRuntime)
 */
export function shouldRunLeaveSideEffects(): boolean {
  if (process.env.NODE_ENV === 'development') return false

  // Staging check: handles 'true', 'TRUE', '1' safely without breaking if someone sets 'false'
  const isStaging =
    process.env.IS_STAGING?.toLowerCase() === 'true' ||
    process.env.IS_STAGING === '1'
  if (isStaging) return false

  if (!process.env.VERCEL) return false
  return true
}
