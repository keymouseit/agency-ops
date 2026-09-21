'use client'

import type { ReactNode } from 'react'
import {
  SalesRobotLoadingProvider,
  SalesRobotResultsLoader,
} from './SalesRobotLoading'

export default function SalesRobotClientShell({
  filters,
  children,
}: {
  filters: ReactNode
  children: ReactNode
}) {
  return (
    <SalesRobotLoadingProvider>
      {filters}
      <SalesRobotResultsLoader>{children}</SalesRobotResultsLoader>
    </SalesRobotLoadingProvider>
  )
}
