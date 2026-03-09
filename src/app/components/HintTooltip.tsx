import type { ReactNode } from 'react'

interface HintTooltipProps {
  hint: string
  children: ReactNode
  className?: string
}

export function HintTooltip({ hint, children, className }: HintTooltipProps) {
  const combinedClassName = className ? `hint-tooltip-trigger ${className}` : 'hint-tooltip-trigger'

  return (
    <span className={combinedClassName} title={hint} aria-label={hint}>
      {children}
    </span>
  )
}
