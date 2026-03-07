import type { ReactNode } from 'react'

type SunCastSlotProps = {
  children: ReactNode
}

export function SunCastLayout({ children }: SunCastSlotProps) {
  return <div className="sun-cast-layout">{children}</div>
}
