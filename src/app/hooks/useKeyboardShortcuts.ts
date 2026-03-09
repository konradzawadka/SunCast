import { useEffect } from 'react'

interface UseKeyboardShortcutsParams {
  onSelectAllFootprints: () => void
  isDrawing: boolean
  onCancelDrawing: () => void
}

export function useKeyboardShortcuts({ onSelectAllFootprints, isDrawing, onCancelDrawing }: UseKeyboardShortcutsParams): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isDrawing) {
        event.preventDefault()
        onCancelDrawing()
        return
      }

      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 'a') {
        return
      }
      const target = event.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return
      }
      event.preventDefault()
      onSelectAllFootprints()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isDrawing, onCancelDrawing, onSelectAllFootprints])
}
