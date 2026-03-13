export function clearShareHashPayloadFromLocation(location: Location): void {
  const normalizedHash = location.hash.startsWith('#') ? location.hash.slice(1) : location.hash
  if (!normalizedHash) {
    return
  }

  const params = new URLSearchParams(normalizedHash)
  if (!params.has('c')) {
    return
  }

  params.delete('c')
  const nextHash = params.toString()
  const nextUrl = `${location.pathname}${location.search}${nextHash ? `#${nextHash}` : ''}`
  window.history.replaceState(window.history.state, '', nextUrl)
}

export interface RunResetProjectFlowArgs {
  resetState: () => void
  clearSelectionState: () => void
  setRequestedHeatmapMode: (mode: 'live-shading') => void
  onSuccess: () => void
}

export function runResetProjectFlow({
  resetState,
  clearSelectionState,
  setRequestedHeatmapMode,
  onSuccess,
}: RunResetProjectFlowArgs): void {
  resetState()
  clearSelectionState()
  setRequestedHeatmapMode('live-shading')
  clearShareHashPayloadFromLocation(window.location)
  onSuccess()
}
