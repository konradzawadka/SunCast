export { computeRoofShadeGrid } from './computeRoofShadeGrid'
export { normalizeObstaclesToPrisms, createPrismTriangles } from './obstacleVolumes'
export { intersectRayPrism } from './rayCasting'
export { buildRoofSurfaceFromLocalVertices, pointInPolygon, sampleRoofGrid } from './roofSampling'
export { isPointShaded } from './shadeAtPoint'
export {
  bboxesIntersect,
  bboxFromPoints,
  computeMaxShadowDistanceM,
  expandBbox,
  sunDirectionFromAzimuthElevation,
} from './shadowProjection'
export type {
  BBox2,
  ComputeRoofShadeGridInput,
  ComputeRoofShadeGridResult,
  ObstaclePrism,
  RoofSamplePoint,
  RoofShadeCell,
  RoofShadeDiagnostics,
  RoofShadeResult,
  ShadingObstacleInput,
  ShadingRoofInput,
  SunDirection,
} from './types'
