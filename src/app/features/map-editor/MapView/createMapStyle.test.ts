import { describe, expect, it } from 'vitest'
import { createMapStyle } from './createMapStyle'

describe('createMapStyle', () => {
  it('does not register ground shading heatmap source or layer', () => {
    const style = createMapStyle()

    expect(style.sources['shading-heatmap']).toBeUndefined()
    expect(style.layers.some((layer) => layer.type === 'heatmap')).toBe(false)
  })
})
