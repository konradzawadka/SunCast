// @vitest-environment jsdom
import { act } from 'react'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
import { createRoot } from 'react-dom/client'
import { useKeyboardShortcuts } from './useKeyboardShortcuts'
import { describe, expect, it, vi } from 'vitest'

interface ShortcutProps {
  isDrawing: boolean
  onSelectAllFootprints: () => void
  onCancelDrawing: () => void
}

function renderShortcutHook(props: ShortcutProps) {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)

  function HookProbe() {
    useKeyboardShortcuts(props)
    return null
  }

  act(() => {
    root.render(<HookProbe />)
  })

  return {
    unmount: () => {
      act(() => {
        root.unmount()
      })
      container.remove()
    },
  }
}

describe('useKeyboardShortcuts', () => {
  it('selects all footprints on Ctrl+A when focus is not in input', () => {
    const onSelectAllFootprints = vi.fn()
    const onCancelDrawing = vi.fn()
    const hook = renderShortcutHook({
      isDrawing: false,
      onSelectAllFootprints,
      onCancelDrawing,
    })

    const event = new KeyboardEvent('keydown', {
      key: 'a',
      ctrlKey: true,
      cancelable: true,
    })

    window.dispatchEvent(event)
    expect(onSelectAllFootprints).toHaveBeenCalledTimes(1)
    expect(onCancelDrawing).not.toHaveBeenCalled()
    hook.unmount()
  })

  it('cancels drawing on Escape only while drawing', () => {
    const onSelectAllFootprints = vi.fn()
    const onCancelDrawing = vi.fn()
    const hook = renderShortcutHook({
      isDrawing: true,
      onSelectAllFootprints,
      onCancelDrawing,
    })

    const escapeEvent = new KeyboardEvent('keydown', {
      key: 'Escape',
      cancelable: true,
    })

    window.dispatchEvent(escapeEvent)
    expect(onCancelDrawing).toHaveBeenCalledTimes(1)
    expect(onSelectAllFootprints).not.toHaveBeenCalled()
    hook.unmount()
  })

  it('does not cancel drawing on Escape when not drawing', () => {
    const onSelectAllFootprints = vi.fn()
    const onCancelDrawing = vi.fn()
    const hook = renderShortcutHook({
      isDrawing: false,
      onSelectAllFootprints,
      onCancelDrawing,
    })

    const escapeEvent = new KeyboardEvent('keydown', {
      key: 'Escape',
      cancelable: true,
    })

    window.dispatchEvent(escapeEvent)
    expect(onCancelDrawing).not.toHaveBeenCalled()
    hook.unmount()
  })
})
