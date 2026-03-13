import type { RoofPlane } from './geometry'

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
