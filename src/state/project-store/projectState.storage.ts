import type { ProjectData, ProjectSunProjectionSettings } from '../../types/geometry'
import { fromStoredFootprint, toStoredFootprint } from './projectState.mappers'
import type { ProjectState } from './projectState.types'

const STORAGE_KEY = 'suncast_project'

export function readStorage(
  defaultSunProjection: ProjectSunProjectionSettings,
  defaultFootprintKwp: number,
): ProjectState | null {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) {
    return null
  }

  try {
    const parsed = JSON.parse(raw) as ProjectData
    const entries = Object.values(parsed.footprints ?? {})
    const footprints = Object.fromEntries(
      entries.map((entry) => [entry.id, fromStoredFootprint(entry, defaultFootprintKwp)]),
    )

    return {
      footprints,
      activeFootprintId: parsed.activeFootprintId ?? null,
      selectedFootprintIds: [],
      drawDraft: [],
      isDrawing: false,
      sunProjection: {
        enabled: parsed.sunProjection?.enabled ?? defaultSunProjection.enabled,
        datetimeIso: parsed.sunProjection?.datetimeIso ?? defaultSunProjection.datetimeIso,
        dailyDateIso: parsed.sunProjection?.dailyDateIso ?? defaultSunProjection.dailyDateIso,
      },
    }
  } catch {
    return null
  }
}

export function writeStorage(
  state: Pick<ProjectState, 'footprints' | 'activeFootprintId' | 'sunProjection'>,
  solverConfigVersion: string,
  defaultFootprintKwp: number,
): void {
  const footprints = Object.fromEntries(
    Object.entries(state.footprints).map(([id, entry]) => [id, toStoredFootprint(entry, defaultFootprintKwp)]),
  )

  const data: ProjectData = {
    footprints,
    activeFootprintId: state.activeFootprintId,
    solverConfigVersion,
    sunProjection: state.sunProjection,
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}
