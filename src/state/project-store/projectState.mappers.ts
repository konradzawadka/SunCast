import type { FootprintPolygon, StoredFootprint } from '../../types/geometry'
import { sanitizeVertexHeights } from './projectState.constraints'
import type { FootprintStateEntry } from './projectState.types'

export function fromStoredFootprint(stored: StoredFootprint, defaultFootprintKwp: number): FootprintStateEntry {
  const footprint: FootprintPolygon = {
    id: stored.id,
    vertices: stored.polygon,
    kwp: Number.isFinite(stored.kwp) ? Math.max(0, stored.kwp as number) : defaultFootprintKwp,
  }

  const vertexHeights = Object.entries(stored.vertexHeights)
    .map(([vertexIndexRaw, heightM]) => ({
      vertexIndex: Number(vertexIndexRaw),
      heightM,
    }))
    .filter((c) => Number.isInteger(c.vertexIndex) && Number.isFinite(c.heightM))

  return {
    footprint,
    constraints: {
      vertexHeights: sanitizeVertexHeights(vertexHeights, footprint.vertices.length),
    },
  }
}

export function toStoredFootprint(entry: FootprintStateEntry, defaultFootprintKwp: number): StoredFootprint {
  const vertexHeights: Record<string, number> = {}
  for (const constraint of entry.constraints.vertexHeights) {
    vertexHeights[String(constraint.vertexIndex)] = constraint.heightM
  }

  return {
    id: entry.footprint.id,
    polygon: entry.footprint.vertices,
    vertexHeights,
    kwp: Number.isFinite(entry.footprint.kwp) ? Math.max(0, entry.footprint.kwp) : defaultFootprintKwp,
  }
}
