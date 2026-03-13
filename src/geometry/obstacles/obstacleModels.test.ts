import { describe, expect, it } from 'vitest'
import type { ObstacleStateEntry } from '../../types/geometry'
import { toShadingObstacleVolume, toVisualObstacleModel } from './obstacleModels'

describe('obstacleModels', () => {
  it('maps building obstacles to prism models', () => {
    const obstacle: ObstacleStateEntry = {
      id: 'building-1',
      kind: 'building',
      shape: {
        type: 'polygon-prism',
        polygon: [
          [20, 52],
          [20.0001, 52],
          [20.0001, 52.0001],
        ],
      },
      heightAboveGroundM: 9,
    }

    expect(toVisualObstacleModel(obstacle).shape).toBe('prism')
    expect(toShadingObstacleVolume(obstacle).shape).toBe('prism')
  })

  it('maps tree obstacles to separate visual and shading cylinders', () => {
    const obstacle: ObstacleStateEntry = {
      id: 'tree-1',
      kind: 'tree',
      shape: {
        type: 'tree',
        center: [20.00005, 52.00005],
        crownRadiusM: 3,
        trunkRadiusM: 0.6,
      },
      heightAboveGroundM: 7,
    }

    const visual = toVisualObstacleModel(obstacle)
    const shading = toShadingObstacleVolume(obstacle)
    expect(visual.shape).toBe('tree')
    expect(shading.shape).toBe('cylinder')
    if (visual.shape !== 'tree' || shading.shape !== 'cylinder') {
      return
    }
    expect(visual.crownRadiusM).toBe(shading.radiusM)
  })
})
