import type { RoofPlane } from './geometry'

export interface ImportedFootprintConfigEntry {
  footprintId: string
  polygon: Array<[number, number]>
  vertexHeights: Array<{ vertexIndex: number; heightM: number }>
}

export interface PlaceSearchResult {
  id: string
  label: string
  lat: number
  lon: number
}

export interface SelectedRoofSunInput {
  footprintId: string
  latDeg: number
  lonDeg: number
  kwp: number
  roofPitchDeg: number
  roofAzimuthDeg: number
  roofPlane: RoofPlane
}
