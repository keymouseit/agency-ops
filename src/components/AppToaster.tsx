'use client'

import { Toaster } from 'react-hot-toast'

/** Single app-wide toast host (notifications + page actions). */
export default function AppToaster() {
  return (
    <Toaster
      position="top-center"
      toastOptions={{ duration: 5000 }}
      containerStyle={{ zIndex: 9999 }}
    />
  )
}
