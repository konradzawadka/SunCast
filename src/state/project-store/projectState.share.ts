import type {
  ObstacleKind,
  ObstacleShape,
  ProjectSunProjectionSettings,
  ShadingSettings,
  StoredFootprint,
} from '../../types/geometry'
import { fromStoredFootprint } from './projectState.mappers'
import { sanitizeLoadedState } from './projectState.sanitize'
import type { ProjectState } from './projectState.types'

const CURRENT_SHARE_SCHEMA_VERSION = 3

export interface SharedFootprintPayload {
  id: string
  polygon: Array<[number, number]>
  vertexHeights: Record<string, number>
  kwp: number
  pitchAdjustmentPercent?: number
}

export interface SharedProjectPayloadV1 {
  version: 1
  footprints: SharedFootprintPayload[]
  activeFootprintId: string | null
  sunProjection?: {
    enabled: boolean
    datetimeIso: string | null
    dailyDateIso: string | null
  }
}

export interface SharedProjectPayloadV2 {
  schemaVersion: 2
  footprints: SharedFootprintPayload[]
  activeFootprintId: string | null
  sunProjection?: {
    enabled: boolean
    datetimeIso: string | null
    dailyDateIso: string | null
  }
}

export interface SharedObstaclePayload {
  id: string
  kind: ObstacleKind
  shape: ObstacleShape
  heightAboveGroundM: number
  label?: string
}

export interface SharedProjectPayloadV3 {
  schemaVersion: 3
  footprints: SharedFootprintPayload[]
  activeFootprintId: string | null
  obstacles: SharedObstaclePayload[]
  activeObstacleId: string | null
  sunProjection?: {
    enabled: boolean
    datetimeIso: string | null
    dailyDateIso: string | null
  }
}

export type SharedProjectPayload = SharedProjectPayloadV3

function isLngLatPoint(value: unknown): value is [number, number] {
  return Array.isArray(value) && value.length === 2 && Number.isFinite(value[0]) && Number.isFinite(value[1])
}

function isObstacleKind(value: unknown): value is ObstacleKind {
  return value === 'building' || value === 'tree' || value === 'pole' || value === 'custom'
}

function isObstacleShape(value: unknown): value is ObstacleShape {
  if (!isRecord(value) || typeof value.type !== 'string') {
    return false
  }

  if (value.type === 'polygon-prism') {
    if (!Array.isArray(value.polygon) || value.polygon.length < 3) {
      return false
    }
    return value.polygon.every((point) => isLngLatPoint(point))
  }

  if (value.type === 'cylinder') {
    return isLngLatPoint(value.center) && Number.isFinite(value.radiusM)
  }

  if (value.type === 'tree') {
    return (
      isLngLatPoint(value.center) && Number.isFinite(value.crownRadiusM) && Number.isFinite(value.trunkRadiusM)
    )
  }

  return false
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export function buildSharePayload(
  state: Pick<ProjectState, 'footprints' | 'activeFootprintId' | 'obstacles' | 'activeObstacleId' | 'sunProjection'>,
): SharedProjectPayload {
  return {
    schemaVersion: CURRENT_SHARE_SCHEMA_VERSION,
    footprints: Object.values(state.footprints).map((entry) => {
      const vertexHeights: Record<string, number> = {}
      for (const constraint of entry.constraints.vertexHeights) {
        vertexHeights[String(constraint.vertexIndex)] = constraint.heightM
      }

      return {
        id: entry.footprint.id,
        polygon: entry.footprint.vertices,
        vertexHeights,
        kwp: entry.footprint.kwp,
        pitchAdjustmentPercent: entry.pitchAdjustmentPercent,
      }
    }),
    activeFootprintId: state.activeFootprintId,
    obstacles: Object.values(state.obstacles),
    activeObstacleId: state.activeObstacleId,
    sunProjection: state.sunProjection,
  }
}

export function serializeSharePayload(payload: SharedProjectPayload): string {
  return JSON.stringify(payload)
}

function hasValidCommonShape(value: Record<string, unknown>): boolean {
  if (!Array.isArray(value.footprints)) {
    return false
  }

  const activeFootprintId = value.activeFootprintId
  if (activeFootprintId !== null && typeof activeFootprintId !== 'string') {
    return false
  }
  if (value.obstacles !== undefined && !Array.isArray(value.obstacles)) {
    return false
  }
  if (value.activeObstacleId !== undefined && value.activeObstacleId !== null && typeof value.activeObstacleId !== 'string') {
    return false
  }

  if (value.sunProjection !== undefined) {
    const sunProjection = value.sunProjection
    if (!isRecord(sunProjection) || typeof sunProjection.enabled !== 'boolean') {
      return false
    }
    if (sunProjection.datetimeIso !== null && typeof sunProjection.datetimeIso !== 'string') {
      return false
    }
    if (sunProjection.dailyDateIso !== null && typeof sunProjection.dailyDateIso !== 'string') {
      return false
    }
  }

  for (const footprint of value.footprints) {
    if (!isRecord(footprint) || typeof footprint.id !== 'string') {
      return false
    }

    if (!Array.isArray(footprint.polygon) || footprint.polygon.length < 3) {
      return false
    }

    for (const point of footprint.polygon) {
      if (!Array.isArray(point) || point.length !== 2) {
        return false
      }
      if (!Number.isFinite(point[0]) || !Number.isFinite(point[1])) {
        return false
      }
    }

    if (!isRecord(footprint.vertexHeights)) {
      return false
    }

    for (const [indexRaw, heightM] of Object.entries(footprint.vertexHeights)) {
      if (!Number.isInteger(Number(indexRaw)) || !Number.isFinite(heightM)) {
        return false
      }
    }

    if (!Number.isFinite(footprint.kwp)) {
      return false
    }
    if (footprint.pitchAdjustmentPercent !== undefined && !Number.isFinite(footprint.pitchAdjustmentPercent)) {
      return false
    }
  }

  if (Array.isArray(value.obstacles)) {
    for (const obstacle of value.obstacles) {
      if (!isRecord(obstacle)) {
        return false
      }
      if (typeof obstacle.id !== 'string' || !isObstacleKind(obstacle.kind)) {
        return false
      }
      if (!isObstacleShape(obstacle.shape) || !Number.isFinite(obstacle.heightAboveGroundM)) {
        return false
      }
      if (obstacle.label !== undefined && typeof obstacle.label !== 'string') {
        return false
      }
    }
  }

  return true
}

function migrateSharePayload(value: unknown): SharedProjectPayloadV3 | null {
  if (!isRecord(value) || !hasValidCommonShape(value)) {
    return null
  }

  if (value.schemaVersion === CURRENT_SHARE_SCHEMA_VERSION) {
    return value as unknown as SharedProjectPayloadV3
  }

  if (value.schemaVersion === 2) {
    const v2 = value as unknown as SharedProjectPayloadV2
    return {
      schemaVersion: CURRENT_SHARE_SCHEMA_VERSION,
      footprints: v2.footprints,
      activeFootprintId: v2.activeFootprintId,
      obstacles: [],
      activeObstacleId: null,
      sunProjection: v2.sunProjection,
    }
  }

  if (value.version === 1) {
    const legacy = value as unknown as SharedProjectPayloadV1
    return {
      schemaVersion: CURRENT_SHARE_SCHEMA_VERSION,
      footprints: legacy.footprints,
      activeFootprintId: legacy.activeFootprintId,
      obstacles: [],
      activeObstacleId: null,
      sunProjection: legacy.sunProjection,
    }
  }

  return null
}

export function validateSharePayload(value: unknown): value is SharedProjectPayload {
  return migrateSharePayload(value) !== null
}

export function deserializeSharePayload(
  raw: string,
  defaultSunProjection: ProjectSunProjectionSettings,
  defaultFootprintKwp: number,
  defaultShadingSettings: ShadingSettings,
): ProjectState {
  const parsed: unknown = JSON.parse(raw)
  const migrated = migrateSharePayload(parsed)
  if (!migrated) {
    throw new Error('Invalid share payload')
  }

  const footprints = Object.fromEntries(
    migrated.footprints.map((footprint) => {
      const stored: StoredFootprint = {
        id: footprint.id,
        polygon: footprint.polygon,
        vertexHeights: footprint.vertexHeights,
        kwp: footprint.kwp,
        pitchAdjustmentPercent: footprint.pitchAdjustmentPercent,
      }
      return [footprint.id, fromStoredFootprint(stored, defaultFootprintKwp)]
    }),
  )

  const loaded: ProjectState = {
    footprints,
    activeFootprintId: migrated.activeFootprintId,
    selectedFootprintIds: migrated.activeFootprintId ? [migrated.activeFootprintId] : [],
    drawDraft: [],
    isDrawing: false,
    obstacles: Object.fromEntries(migrated.obstacles.map((obstacle) => [obstacle.id, obstacle])),
    activeObstacleId: migrated.activeObstacleId,
    selectedObstacleIds: migrated.activeObstacleId ? [migrated.activeObstacleId] : [],
    obstacleDrawDraft: [],
    isDrawingObstacle: false,
    sunProjection: {
      enabled: migrated.sunProjection?.enabled ?? defaultSunProjection.enabled,
      datetimeIso: migrated.sunProjection?.datetimeIso ?? defaultSunProjection.datetimeIso,
      dailyDateIso: migrated.sunProjection?.dailyDateIso ?? defaultSunProjection.dailyDateIso,
    },
    shadingSettings: defaultShadingSettings,
  }

  return sanitizeLoadedState(loaded, defaultSunProjection, defaultFootprintKwp, defaultShadingSettings)
}
