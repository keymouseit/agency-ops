'use client'

import {
  createContext,
  useCallback,
  useContext,
  useTransition,
  type ReactNode,
  type TransitionStartFunction,
} from 'react'

type SalesRobotLoadingContextValue = {
  pending: boolean
  startTransition: TransitionStartFunction
}

const SalesRobotLoadingContext = createContext<SalesRobotLoadingContextValue>({
  pending: false,
  startTransition: (cb) => cb(),
})

export function useSalesRobotLoading() {
  return useContext(SalesRobotLoadingContext)
}

export function SalesRobotLoadingProvider({ children }: { children: ReactNode }) {
  const [pending, startTransition] = useTransition()

  return (
    <SalesRobotLoadingContext.Provider value={{ pending, startTransition }}>
      {children}
    </SalesRobotLoadingContext.Provider>
  )
}

export function SalesRobotResultsLoader({ children }: { children: ReactNode }) {
  const { pending } = useSalesRobotLoading()

  return (
    <div className="relative">
      {pending && (
        <div
          className="absolute inset-0 z-30 flex flex-col items-center justify-start pt-24 sm:pt-32 bg-white/80 backdrop-blur-[2px]"
          role="status"
          aria-live="polite"
          aria-busy="true"
        >
          <div className="flex flex-col items-center gap-3 rounded-xl border border-gray-200 bg-white px-6 py-5 shadow-lg">
            <span className="h-8 w-8 rounded-full border-2 border-gray-200 border-t-gray-900 animate-spin" />
            <div className="text-center">
              <div className="text-sm font-medium text-gray-900">Updating results</div>
              <div className="text-xs text-gray-500 mt-0.5">Applying filters…</div>
            </div>
          </div>
        </div>
      )}
      <div
        className={
          pending ? 'pointer-events-none select-none' : undefined
        }
        aria-hidden={pending || undefined}
      >
        {children}
      </div>
    </div>
  )
}

/** Stable callback wrapper so filters can trigger navigations inside the shared transition. */
export function useSalesRobotTransition() {
  const { pending, startTransition } = useSalesRobotLoading()
  const run = useCallback(
    (fn: () => void) => {
      startTransition(fn)
    },
    [startTransition]
  )
  return { pending, run }
}
