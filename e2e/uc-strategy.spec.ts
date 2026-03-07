import { expect, test } from './fixtures/coverage'
import type { Locator, Page } from '@playwright/test'

interface StoredProject {
  footprints: Record<
    string,
    {
      id: string
      polygon: Array<[number, number]>
      vertexHeights: Record<string, number>
    }
  >
  activeFootprintId: string | null
  solverConfigVersion?: string
}

async function getMapBounds(page: Page) {
  const mapCanvas = page.getByTestId('map-canvas')
  await expect(mapCanvas).toBeVisible()
  const bounds = await mapCanvas.boundingBox()
  if (!bounds) {
    throw new Error('Map canvas bounds are not available')
  }
  return bounds
}

async function clickMapRatios(page: Page, points: Array<[number, number]>) {
  const bounds = await getMapBounds(page)
  for (const [xRatio, yRatio] of points) {
    await page.mouse.click(bounds.x + bounds.width * xRatio, bounds.y + bounds.height * yRatio)
  }
}

async function expectTutorialSpotlightAround(page: Page, target: Locator) {
  await expect(target).toBeVisible()
  await expect(page.getByTestId('tutorial-spotlight').first()).toBeVisible()

  const targetBox = await target.boundingBox()
  if (!targetBox) {
    throw new Error('Target bounding box is unavailable for tutorial spotlight check')
  }

  const spotlightBoxes = await page.locator('[data-testid="tutorial-spotlight"]').evaluateAll((nodes) =>
    nodes.map((node) => {
      const rect = node.getBoundingClientRect()
      return {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
      }
    }),
  )

  const centerX = targetBox.x + targetBox.width / 2
  const centerY = targetBox.y + targetBox.height / 2
  const matchesTarget = spotlightBoxes.some(
    (box) =>
      centerX >= box.x &&
      centerX <= box.x + box.width &&
      centerY >= box.y &&
      centerY <= box.y + box.height,
  )

  expect(matchesTarget).toBeTruthy()
}

async function selectVertexViaDebug(page: Page, vertexIndex: number) {
  const didSelect = await page.evaluate((index: number) => {
    type DebugApi = {
      selectVertex?: (vertexIndex: number) => void
    }
    const debugApi = (window as Window & { suncastDebug?: DebugApi }).suncastDebug
    if (!debugApi?.selectVertex) {
      return false
    }
    debugApi.selectVertex(index)
    return true
  }, vertexIndex)
  if (!didSelect) {
    throw new Error('suncastDebug.selectVertex is unavailable')
  }
}

async function ensureHeightGizmoVisible(page: Page) {
  await selectVertexViaDebug(page, 0)
  await expect(page.locator('.height-gizmo-button')).toHaveCount(2)
}

async function drawFootprint(page: Page, points: Array<[number, number]>) {
  await page.getByTestId('draw-footprint-button').click()
  await clickMapRatios(page, points)
  await expect(page.getByTestId('draw-finish-button')).toBeEnabled()
  await page.getByTestId('draw-finish-button').click()
  await expect(page.getByTestId('vertex-height-input-0')).toBeVisible()
}

async function expandEdgeHeightsIfCollapsed(page: Page) {
  const edgeInput = page.getByTestId('edge-height-input-0')
  if (await edgeInput.isVisible()) {
    return
  }
  await page.locator('summary').filter({ hasText: 'Edge Heights' }).click()
  await expect(edgeInput).toBeVisible()
}

async function setVertexHeight(page: Page, vertexIndex: number, heightM: number) {
  await page.getByTestId(`vertex-height-input-${vertexIndex}`).fill(String(heightM))
  await page.getByTestId(`vertex-height-set-${vertexIndex}`).click()
}

async function setSunDatetime(page: Page, datetimeIso: string) {
  await page.getByTestId('sun-datetime-input').fill(datetimeIso)
}

async function readStoredProject(page: Page): Promise<StoredProject> {
  return page.evaluate(() => {
    const raw = window.localStorage.getItem('suncast_project')
    if (!raw) {
      throw new Error('suncast_project is missing in localStorage')
    }
    return JSON.parse(raw) as StoredProject
  })
}

test('UC0: bootstrap and footprint validation flow', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByText('SunCast')).toBeVisible()
  await expect(page.getByTestId('map-canvas')).toBeVisible()

  await page.getByTestId('draw-footprint-button').click()
  await expect(page.getByTestId('draw-finish-button')).toBeDisabled()

  await clickMapRatios(page, [
    [0.26, 0.24],
    [0.56, 0.26],
  ])
  await expect(page.getByTestId('draw-finish-button')).toBeDisabled()

  await clickMapRatios(page, [[0.44, 0.58]])
  await expect(page.getByTestId('draw-finish-button')).toBeEnabled()

  await page.getByTestId('draw-undo-button').click()
  await expect(page.getByTestId('draw-finish-button')).toBeDisabled()

  await clickMapRatios(page, [[0.44, 0.58]])
  await page.getByTestId('draw-finish-button').click()
  await expect(page.getByTestId('vertex-height-input-0')).toBeVisible()
  await expect(page.getByText('CONSTRAINTS_INSUFFICIENT')).toBeVisible()
})

test('UC2 + UC0.1: edge and vertex constraints update solver status', async ({ page }) => {
  await page.goto('/')
  await drawFootprint(page, [
    [0.24, 0.22],
    [0.58, 0.24],
    [0.62, 0.58],
    [0.28, 0.62],
  ])

  await expect(page.getByText('CONSTRAINTS_INSUFFICIENT')).toBeVisible()
  await expandEdgeHeightsIfCollapsed(page)

  await page.getByTestId('edge-height-input-0').fill('3')
  await page.getByTestId('edge-height-set-0').click()
  await expect(page.getByText(/Active constraints:/)).toContainText('V0=3.00m')
  await expect(page.getByText(/Active constraints:/)).toContainText('V1=3.00m')

  await setVertexHeight(page, 0, 4)
  await expect(page.getByText(/Active constraints:/)).toContainText('V0=4.00m')

  await page.getByTestId('edge-height-input-0').fill('2')
  await page.getByTestId('edge-height-set-0').click()
  await expect(page.getByText(/Active constraints:/)).toContainText('V0=2.00m')
  await expect(page.getByText(/Active constraints:/)).toContainText('V1=2.00m')

  await setVertexHeight(page, 2, 8)
  await setVertexHeight(page, 3, 9)

  await expect(page.getByText('CONSTRAINTS_OVERDETERMINED')).toBeVisible()
  await expect(page.getByText(/^Pitch:/)).toBeVisible()

  await page.getByTestId('vertex-height-clear-3').click()
  await expect(page.getByText('CONSTRAINTS_OVERDETERMINED')).toHaveCount(0)
})

test('UC1 + UC4 + IP1: orbit mode, height gizmo, mesh toggle, and non-orbit drag', async ({ page }) => {
  await page.goto('/')
  await drawFootprint(page, [
    [0.30, 0.20],
    [0.62, 0.26],
    [0.46, 0.62],
  ])

  await setVertexHeight(page, 0, 2)
  await setVertexHeight(page, 1, 4)
  await setVertexHeight(page, 2, 30)

  await expect(page.getByText(/^Pitch:/)).toBeVisible()
  await expect(page.getByTestId('mesh-visibility-toggle-button')).toBeDisabled()

  await page.getByTestId('orbit-toggle-button').click()

  await expect(page.getByTestId('orbit-toggle-button')).toHaveText(/Exit orbit/i)
  await expect(page.getByTestId('mesh-visibility-toggle-button')).toHaveText(/Hide meshes/i)
  await ensureHeightGizmoVisible(page)
  await expect(page.locator('.height-gizmo-button')).toHaveCount(2)

  await page.locator('.height-gizmo-button').first().click()
  await expect(page.getByText(/Active constraints:/)).toContainText('V0=2.10m')

  await page.getByTestId('mesh-visibility-toggle-button').click()
  await expect(page.getByTestId('mesh-visibility-toggle-button')).toHaveText(/Show meshes/i)

  await page.getByTestId('orbit-toggle-button').click()
  await expect(page.getByTestId('orbit-toggle-button')).toHaveText(/^Orbit$/)

  const before = await readStoredProject(page)
  const beforeActive = before.activeFootprintId
  if (!beforeActive) {
    throw new Error('Expected an active footprint before drag')
  }
  const beforeFirstVertex = before.footprints[beforeActive].polygon[0]

  const bounds = await getMapBounds(page)
  const fromX = bounds.x + bounds.width * 0.30
  const fromY = bounds.y + bounds.height * 0.20
  await page.mouse.move(fromX, fromY)
  await page.mouse.down()
  await page.mouse.move(fromX + 45, fromY + 28, { steps: 8 })
  await page.mouse.up()

  const after = await readStoredProject(page)
  const afterFirstVertex = after.footprints[beforeActive].polygon[0]
  expect(afterFirstVertex[0]).not.toBe(beforeFirstVertex[0])
  expect(afterFirstVertex[1]).not.toBe(beforeFirstVertex[1])
})

test('UC3 + determinism: multiple footprints persist, reload, and delete', async ({ page }) => {
  await page.goto('/')

  await drawFootprint(page, [
    [0.22, 0.21],
    [0.44, 0.22],
    [0.34, 0.46],
  ])
  await setVertexHeight(page, 0, 3)
  await setVertexHeight(page, 1, 5)
  await setVertexHeight(page, 2, 8)

  const pitchBeforeReload = await page.getByText(/^Pitch:/).innerText()

  await drawFootprint(page, [
    [0.66, 0.34],
    [0.82, 0.35],
    [0.78, 0.58],
  ])

  await expect(page.locator('.footprint-list-item')).toHaveCount(2)

  await page.locator('.footprint-list-item').first().click()
  await expect(page.getByText(/Active constraints:/)).toContainText('V0=3.00m')

  await page.reload()

  await expect(page.locator('.footprint-list-item')).toHaveCount(2)
  await expect(page.getByText(/Active constraints:/)).toContainText('V0=3.00m')
  await expect(page.getByText(/^Pitch:/)).toHaveText(pitchBeforeReload)

  const stored = await readStoredProject(page)
  expect(Object.keys(stored.footprints)).toHaveLength(2)

  for (const footprint of Object.values(stored.footprints)) {
    expect(Array.isArray(footprint.polygon)).toBeTruthy()
    expect(typeof footprint.vertexHeights).toBe('object')
    expect((footprint as Record<string, unknown>).mesh).toBeUndefined()
  }

  await page.getByRole('button', { name: 'Delete Active Footprint' }).click()
  await expect(page.locator('.footprint-list-item')).toHaveCount(1)

  const storedAfterDelete = await readStoredProject(page)
  expect(Object.keys(storedAfterDelete.footprints)).toHaveLength(1)
})

test('UC5: datetime-driven clear-sky POA is shown and changes with datetime', async ({ page }) => {
  await page.goto('/')
  await drawFootprint(page, [
    [0.22, 0.24],
    [0.56, 0.23],
    [0.60, 0.56],
    [0.26, 0.60],
  ])

  await setVertexHeight(page, 0, 2)
  await setVertexHeight(page, 1, 4)
  await setVertexHeight(page, 2, 6)

  await expect(page.getByText(/^Pitch:/)).toBeVisible()
  await expect(page.getByTestId('sun-datetime-input')).not.toHaveValue('')

  await setSunDatetime(page, '2026-06-21T12:00:00-04:00')
  await expect(page.getByTestId('sun-poa-value')).toContainText('POA (clear-sky):')
  const noonPoa = await page.getByTestId('sun-poa-value').innerText()

  await setSunDatetime(page, '2026-06-21T18:00:00-04:00')
  await expect(page.getByTestId('sun-poa-value')).toContainText('POA (clear-sky):')
  const eveningPoa = await page.getByTestId('sun-poa-value').innerText()

  expect(eveningPoa).not.toBe(noonPoa)
})

test('UC6: daily production chart appears and changes with selected date', async ({ page }) => {
  await page.goto('/')
  await drawFootprint(page, [
    [0.22, 0.24],
    [0.56, 0.23],
    [0.60, 0.56],
    [0.26, 0.60],
  ])

  await setVertexHeight(page, 0, 2)
  await setVertexHeight(page, 1, 4)
  await setVertexHeight(page, 2, 6)

  await expect(page.getByText(/^Pitch:/)).toBeVisible()
  await expect(page.getByTestId('sun-daily-chart')).toBeVisible()

  await page.getByTestId('sun-datetime-input').fill('2026-06-21T12:00:00-04:00')
  await expect(page.getByTestId('sun-daily-chart')).toBeVisible()
  await expect(page.getByTestId('sun-daily-production-peak')).toContainText('Real production peak:')

  const junePeak = await page.getByTestId('sun-daily-production-peak').innerText()

  await page.getByTestId('sun-datetime-input').fill('2026-12-21T12:00:00-04:00')
  await expect(page.getByTestId('sun-daily-production-peak')).toContainText('Real production peak:')
  const decemberPeak = await page.getByTestId('sun-daily-production-peak').innerText()

  expect(decemberPeak).not.toBe(junePeak)
})

test('UC12: tutorial highlights workflow controls and stores completion', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.removeItem('suncast_uc12_tutorial_state')
  })
  await page.goto('/')

  await expect(page.getByTestId('map-canvas')).toBeVisible()
  await expect(page.getByRole('dialog', { name: /Tutorial step 1 of 6/i })).toBeVisible({ timeout: 30_000 })
  await expectTutorialSpotlightAround(page, page.getByTestId('draw-footprint-button'))

  await page.getByTestId('draw-footprint-button').click()
  await clickMapRatios(page, [
    [0.24, 0.22],
    [0.56, 0.23],
    [0.58, 0.56],
  ])

  await expect(page.getByRole('dialog', { name: /Tutorial step 2 of 6/i })).toBeVisible()
  await expectTutorialSpotlightAround(page, page.getByTestId('draw-finish-button'))
  await page.getByTestId('draw-finish-button').click()

  await expect(page.getByRole('dialog', { name: /Tutorial step 3 of 6/i })).toBeVisible()
  await expectTutorialSpotlightAround(page, page.getByTestId('active-footprint-kwp-input'))
  await page.getByTestId('active-footprint-kwp-input').fill('5.1')

  await expect(page.getByRole('dialog', { name: /Tutorial step 4 of 6/i })).toBeVisible()
  await expectTutorialSpotlightAround(page, page.getByTestId('vertex-heights-panel'))

  await setVertexHeight(page, 0, 2)
  await setVertexHeight(page, 1, 4)
  await setVertexHeight(page, 2, 6)

  await expect(page.getByRole('dialog', { name: /Tutorial step 5 of 6/i })).toBeVisible()
  await expectTutorialSpotlightAround(page, page.getByTestId('status-pitch-value'))
  await expectTutorialSpotlightAround(page, page.getByTestId('orbit-toggle-button'))

  await page.getByTestId('orbit-toggle-button').click()
  await expect(page.getByRole('dialog', { name: /Tutorial step 6 of 6/i })).toBeVisible()
  await expectTutorialSpotlightAround(page, page.getByTestId('sun-datetime-input'))
  await page.getByTestId('sun-datetime-input').fill('2026-06-21T12:00:00-04:00')
  await expect(page.getByRole('dialog', { name: /Tutorial step/i })).toHaveCount(0)

  const tutorialState = await page.evaluate(() => {
    const raw = window.localStorage.getItem('suncast_uc12_tutorial_state')
    return raw ? (JSON.parse(raw) as { completedSteps?: number; tutorialEnabled?: boolean }) : null
  })
  expect(tutorialState?.completedSteps).toBe(6)
  expect(tutorialState?.tutorialEnabled).toBeFalsy()

  await page.reload()
  await expect(page.getByRole('dialog', { name: /Tutorial step/i })).toHaveCount(0)
})
