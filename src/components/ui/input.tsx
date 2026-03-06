import * as React from 'react'

export type InputProps = React.ComponentProps<'input'>

export const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className = '', type = 'text', ...props }, ref) => {
  const merged = className.trim() === '' ? 'ui-input' : `ui-input ${className}`
  return <input ref={ref} type={type} className={merged} {...props} />
})
Input.displayName = 'Input'
