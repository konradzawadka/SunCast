import type { ObstacleStateEntry, RoofMeshData } from '../../types/geometry'
import { generateRoofMesh } from './generateRoofMesh'

const DEFAULT_OBSTACLE_KWP = 0

export function generateObstacleMesh(obstacle: ObstacleStateEntry): RoofMeshData | null {
  if (!Array.isArray(obstacle.polygon) || obstacle.polygon.length < 3) {
    return null
  }

  const heightAboveGroundM = Number.isFinite(obstacle.heightAboveGroundM)
    ? Math.max(0, obstacle.heightAboveGroundM)
    : 0

  try {
    return generateRoofMesh(
      {
        id: obstacle.id,
        vertices: obstacle.polygon,
        kwp: DEFAULT_OBSTACLE_KWP,
      },
      obstacle.polygon.map(() => heightAboveGroundM),
    )
  } catch {
    return null
  }
}
