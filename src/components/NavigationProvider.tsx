'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { usePathname } from 'next/navigation'

type NavigationContextValue = {
  startNavigation: () => void
}

const NavigationContext = createContext<NavigationContextValue>({
  startNavigation: () => {},
})

export function useNavigationPending() {
  return useContext(NavigationContext)
}

export function NavigationProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const [pending, setPending] = useState(false)

  useEffect(() => {
    setPending(false)
  }, [pathname])

  return (
    <NavigationContext.Provider value={{ startNavigation: () => setPending(true) }}>
      {pending && (
        <div
          className="fixed top-0 left-0 right-0 z-[100] h-0.5 overflow-hidden bg-transparent"
          role="progressbar"
          aria-label="Loading page"
        >
          <div className="h-full w-1/3 bg-blue-600 animate-[nav-progress_0.9s_ease-in-out_infinite]" />
        </div>
      )}
      {children}
    </NavigationContext.Provider>
  )
}
