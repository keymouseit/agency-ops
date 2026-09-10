/** Refresh RSC data for the current route after a mutation. */
export function softRefresh(router: { refresh: () => void }) {
  // Call refresh directly. Wrapping only in startTransition was skipping updates
  // on the project detail page in Next 14 (UI stayed stale until a full reload).
  // Project detail has no loading.tsx, so this will not flash a skeleton.
  router.refresh()
}
