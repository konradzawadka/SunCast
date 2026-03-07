import { useCallback, useEffect, useState } from 'react'
import type { FaceConstraints, FootprintPolygon } from '../../types/geometry'

export type ImportedFootprintConfigEntry = {
  footprintId: string
  polygon: Array<[number, number]>
  vertexHeights: Array<{ vertexIndex: number; heightM: number }>
}

interface FootprintDebugEntry {
  footprintId: string
  polygon: Array<[number, number]>
  vertexHeights: Array<{ vertexIndex: number; heightM: number }>
}

export interface DebugFootprintEntryData {
  footprint: FootprintPolygon
  constraints: FaceConstraints
}

interface DevToolsProps {
  footprintEntries: DebugFootprintEntryData[]
  onSelectVertex: (vertexIndex: number) => void
  onSelectEdge: (edgeIndex: number) => void
  onClearSelection: () => void
  onImportEntries: (entries: ImportedFootprintConfigEntry[]) => void
}

function parseImportedFootprintsConfig(raw: string): ImportedFootprintConfigEntry[] {
  const parsed = JSON.parse(raw) as unknown
  if (!Array.isArray(parsed)) {
    throw new Error('Configuration must be an array.')
  }

  const entries: ImportedFootprintConfigEntry[] = []
  for (const item of parsed) {
    if (!item || typeof item !== 'object') {
      continue
    }

    const footprintId = typeof item.footprintId === 'string' ? item.footprintId.trim() : ''
    const polygonRaw = Array.isArray(item.polygon) ? item.polygon : []
    const vertexHeightsRaw = Array.isArray(item.vertexHeights) ? item.vertexHeights : []
    if (!footprintId || polygonRaw.length < 3) {
      continue
    }

    const polygon: Array<[number, number]> = []
    for (const coordinate of polygonRaw) {
      if (!Array.isArray(coordinate) || coordinate.length !== 2) {
        continue
      }
      const lon = Number(coordinate[0])
      const lat = Number(coordinate[1])
      if (!Number.isFinite(lon) || !Number.isFinite(lat)) {
        continue
      }
      polygon.push([lon, lat])
    }

    const vertexHeights: Array<{ vertexIndex: number; heightM: number }> = []
    for (const constraint of vertexHeightsRaw) {
      if (!constraint || typeof constraint !== 'object') {
        continue
      }
      const vertexIndex = Number(constraint.vertexIndex)
      const heightM = Number(constraint.heightM)
      if (!Number.isInteger(vertexIndex) || !Number.isFinite(heightM)) {
        continue
      }
      vertexHeights.push({ vertexIndex, heightM })
    }

    if (polygon.length < 3) {
      continue
    }

    entries.push({ footprintId, polygon, vertexHeights })
  }

  if (entries.length === 0) {
    throw new Error('No valid footprint entries found in configuration.')
  }

  return entries
}

export function DevTools({
  footprintEntries,
  onSelectVertex,
  onSelectEdge,
  onClearSelection,
  onImportEntries,
}: DevToolsProps) {
  const [showImportConfig, setShowImportConfig] = useState(false)
  const [importConfigJson, setImportConfigJson] = useState('')
  const [importConfigError, setImportConfigError] = useState<string | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const debugEntries: FootprintDebugEntry[] = footprintEntries.map((entry) => ({
      footprintId: entry.footprint.id,
      polygon: entry.footprint.vertices,
      vertexHeights: entry.constraints.vertexHeights,
    }))

    const debugWindow = window as Window & {
      suncastDebug?: {
        getPolygonsAndHeights: () => FootprintDebugEntry[]
        selectVertex: (vertexIndex: number) => void
        selectEdge: (edgeIndex: number) => void
        clearSelection: () => void
        importPolygonsAndHeights: (rawConfig: string) => void
      }
    }

    debugWindow.suncastDebug = {
      getPolygonsAndHeights: () => debugEntries,
      selectVertex: (vertexIndex: number) => {
        if (!Number.isInteger(vertexIndex)) {
          return
        }
        onSelectVertex(vertexIndex)
      },
      selectEdge: (edgeIndex: number) => {
        if (!Number.isInteger(edgeIndex)) {
          return
        }
        onSelectEdge(edgeIndex)
      },
      clearSelection: onClearSelection,
      importPolygonsAndHeights: (rawConfig: string) => {
        const entries = parseImportedFootprintsConfig(rawConfig)
        onImportEntries(entries)
      },
    }

    return () => {
      if (debugWindow.suncastDebug) {
        delete debugWindow.suncastDebug
      }
    }
  }, [footprintEntries, onClearSelection, onImportEntries, onSelectEdge, onSelectVertex])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'i') {
        event.preventDefault()
        setShowImportConfig((value) => !value)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const onImportConfigSubmit = useCallback(() => {
    try {
      const entries = parseImportedFootprintsConfig(importConfigJson)
      onImportEntries(entries)
      onClearSelection()
      setImportConfigError(null)
    } catch (error) {
      setImportConfigError(error instanceof Error ? error.message : 'Invalid configuration JSON.')
    }
  }, [importConfigJson, onClearSelection, onImportEntries])

  return (
    <section style={{ display: showImportConfig ? 'block' : 'none', marginBottom: '0.8rem' }}>
      <h3>Hidden Polygon Import</h3>
      <p className="subtitle">Use Ctrl+Shift+I to toggle. Paste config JSON and inject polygons.</p>
      <textarea
        value={importConfigJson}
        onChange={(event) => {
          setImportConfigJson(event.target.value)
          setImportConfigError(null)
        }}
        rows={8}
        style={{ width: '100%', resize: 'vertical' }}
        placeholder='[{"footprintId":"fp-1","polygon":[[20,52],[20.1,52],[20.1,52.1]],"vertexHeights":[{"vertexIndex":0,"heightM":8}]}]'
      />
      {importConfigError ? <p style={{ color: '#b91c1c' }}>{importConfigError}</p> : null}
      <button type="button" onClick={onImportConfigSubmit}>
        Inject Polygons
      </button>
    </section>
  )
}
