'use client'

import { Toaster } from 'react-hot-toast'

/** Single app-wide toast host (notifications + page actions). */
export default function AppToaster() {
  return <Toaster position="top-right" toastOptions={{ duration: 5000 }} />
}
