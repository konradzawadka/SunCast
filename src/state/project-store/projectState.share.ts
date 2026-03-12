import type { ProjectSunProjectionSettings, ShadingSettings, StoredFootprint } from '../../types/geometry'
import { fromStoredFootprint } from './projectState.mappers'
import { sanitizeLoadedState } from './projectState.sanitize'
import type { ProjectState } from './projectState.types'

const CURRENT_SHARE_SCHEMA_VERSION = 2

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

export type SharedProjectPayload = SharedProjectPayloadV2

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export function buildSharePayload(
  state: Pick<ProjectState, 'footprints' | 'activeFootprintId' | 'sunProjection'>,
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

  return true
}

function migrateSharePayload(value: unknown): SharedProjectPayloadV2 | null {
  if (!isRecord(value) || !hasValidCommonShape(value)) {
    return null
  }

  if (value.schemaVersion === CURRENT_SHARE_SCHEMA_VERSION) {
    return value as unknown as SharedProjectPayloadV2
  }

  if (value.version === 1) {
    const legacy = value as unknown as SharedProjectPayloadV1
    return {
      schemaVersion: CURRENT_SHARE_SCHEMA_VERSION,
      footprints: legacy.footprints,
      activeFootprintId: legacy.activeFootprintId,
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
    obstacles: {},
    activeObstacleId: null,
    selectedObstacleIds: [],
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
