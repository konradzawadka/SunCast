/// <reference lib="webworker" />

import { buildRoofHeatmapOverlayGeometry } from './roofHeatmapOverlay'
import type {
  RoofHeatmapOverlayWorkerRequest,
  RoofHeatmapOverlayWorkerResponse,
} from './roofHeatmapOverlayWorker.types'

const workerScope = self as DedicatedWorkerGlobalScope

workerScope.onmessage = (event: MessageEvent<RoofHeatmapOverlayWorkerRequest>): void => {
  const { requestId, roofMeshes, heatmapFeatures, zExaggeration } = event.data

  try {
    const geometry = buildRoofHeatmapOverlayGeometry(roofMeshes, heatmapFeatures, zExaggeration)
    const response: RoofHeatmapOverlayWorkerResponse = {
      requestId,
      geometry,
    }

    if (!geometry) {
      workerScope.postMessage(response)
      return
    }

    workerScope.postMessage(response, [geometry.positions.buffer, geometry.colors.buffer, geometry.indices.buffer])
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown heatmap worker error'
    const response: RoofHeatmapOverlayWorkerResponse = {
      requestId,
      geometry: null,
      error: message,
    }
    workerScope.postMessage(response)
  }
}

export {}
