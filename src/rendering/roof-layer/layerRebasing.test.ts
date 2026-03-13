import { describe, expect, it } from 'vitest'
import { resolveLayerAnchor, toLayerRelativePoint } from './layerRebasing'

function toFloat32(value: number): number {
  return new Float32Array([value])[0]
}

describe('layerRebasing', () => {
  it('resolves layer anchor as average anchor position', () => {
    const anchor = resolveLayerAnchor([
      { anchorX: 0.2, anchorY: 0.4 },
      { anchorX: 0.6, anchorY: 0.8 },
    ])

    expect(anchor.x).toBeCloseTo(0.4, 12)
    expect(anchor.y).toBeCloseTo(0.6, 12)
  })

  it('keeps absolute world coordinates when converting to layer-relative points', () => {
    const point = toLayerRelativePoint(0.5, 0.3, { x: 0.01, y: -0.02, z: 2 }, { x: 0.4, y: 0.1 })

    expect(point.x).toBeCloseTo(0.11, 12)
    expect(point.y).toBeCloseTo(0.18, 12)
    expect(point.z).toBe(2)
  })

  it('exposes precision risk of legacy anchor-plus-vertex float32 path for 1m objects', () => {
    const anchorX = 0.5555555758209152
    const unitsPerMeter = 4.053072319851487e-8
    const halfWidthWorld = (1 * unitsPerMeter) / 2

    const legacyLeft = toFloat32(anchorX - halfWidthWorld)
    const legacyRight = toFloat32(anchorX + halfWidthWorld)
    const legacySpan = legacyRight - legacyLeft

    const rebasedLeft = toFloat32(-halfWidthWorld)
    const rebasedRight = toFloat32(halfWidthWorld)
    const rebasedSpan = rebasedRight - rebasedLeft

    expect(legacySpan).toBe(0)
    expect(rebasedSpan).toBeGreaterThan(0)
  })
})
