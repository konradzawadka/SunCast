import { useEffect } from 'react'

interface UseKeyboardShortcutsParams {
  onSelectAllFootprints: () => void
}

export function useKeyboardShortcuts({ onSelectAllFootprints }: UseKeyboardShortcutsParams): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
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
  }, [onSelectAllFootprints])
}
