import { useCallback, useState } from 'react'

export function useSelectionState() {
  const [selectedVertexIndex, setSelectedVertexIndex] = useState<number | null>(null)
  const [selectedEdgeIndex, setSelectedEdgeIndex] = useState<number | null>(null)

  const clearSelectionState = useCallback(() => {
    setSelectedVertexIndex(null)
    setSelectedEdgeIndex(null)
  }, [])

  const selectVertex = useCallback((vertexIndex: number) => {
    setSelectedVertexIndex(vertexIndex)
    setSelectedEdgeIndex(null)
  }, [])

  const selectEdge = useCallback((edgeIndex: number) => {
    setSelectedEdgeIndex(edgeIndex)
    setSelectedVertexIndex(null)
  }, [])

  const clearSelectionOnly = useCallback(() => {
    setSelectedVertexIndex(null)
    setSelectedEdgeIndex(null)
  }, [])

  return {
    selectedVertexIndex,
    selectedEdgeIndex,
    setSelectedVertexIndex,
    setSelectedEdgeIndex,
    clearSelectionOnly,
    clearSelectionState,
    selectVertex,
    selectEdge,
  }
}
