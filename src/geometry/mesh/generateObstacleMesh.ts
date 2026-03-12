import type { ObstacleStateEntry, RoofMeshData } from '../../types/geometry'
import { generateRoofMesh } from './generateRoofMesh'
import { cylinderToPolygon, toVisualObstacleModel } from '../obstacles/obstacleModels'

const DEFAULT_OBSTACLE_KWP = 0

export function generateObstacleMesh(obstacle: ObstacleStateEntry): RoofMeshData | null {
  const visualObstacle = toVisualObstacleModel(obstacle)
  const polygon =
    visualObstacle.shape === 'prism'
      ? visualObstacle.polygon
      : visualObstacle.shape === 'cylinder'
        ? cylinderToPolygon(visualObstacle.center, visualObstacle.radiusM)
        : cylinderToPolygon(visualObstacle.center, visualObstacle.crownRadiusM)
  if (!Array.isArray(polygon) || polygon.length < 3) {
    return null
  }

  try {
    return generateRoofMesh(
      {
        id: obstacle.id,
        vertices: polygon,
        kwp: DEFAULT_OBSTACLE_KWP,
      },
      polygon.map(() => visualObstacle.heightAboveGroundM),
    )
  } catch {
    return null
  }
}
