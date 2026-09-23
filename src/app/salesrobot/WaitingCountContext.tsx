'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'

type WaitingCountContextValue = {
  count: number
  decrement: () => void
}

const WaitingCountContext = createContext<WaitingCountContextValue | null>(null)

export function WaitingCountProvider({
  initialCount,
  children,
}: {
  initialCount: number
  children: ReactNode
}) {
  const [count, setCount] = useState(initialCount)

  useEffect(() => {
    setCount(initialCount)
  }, [initialCount])

  const decrement = useCallback(() => {
    setCount(current => Math.max(0, current - 1))
  }, [])

  return (
    <WaitingCountContext.Provider value={{ count, decrement }}>
      {children}
    </WaitingCountContext.Provider>
  )
}

export function useWaitingCount() {
  const context = useContext(WaitingCountContext)
  if (!context) {
    throw new Error('useWaitingCount must be used within WaitingCountProvider')
  }
  return context
}
