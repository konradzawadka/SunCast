import * as React from 'react'

export type LabelProps = React.ComponentProps<'label'>

export function Label({ className = '', ...props }: LabelProps) {
  const merged = className.trim() === '' ? 'ui-label' : `ui-label ${className}`
  return <label className={merged} {...props} />
}
