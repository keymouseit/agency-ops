import type { ReactNode } from 'react'

export function FormLabel({
  children,
  required = false,
  htmlFor,
}: {
  children: ReactNode
  required?: boolean
  htmlFor?: string
}) {
  return (
    <label className="label" htmlFor={htmlFor}>
      {children}
      {required && <span className="text-red-500 ml-0.5">*</span>}
    </label>
  )
}
