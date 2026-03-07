import { expect, test } from './fixtures/coverage'
import type { Page } from '@playwright/test'

async function drawTriangleFootprint(page: Page) {
  const skipTutorialButton = page.getByRole('button', { name: 'Skip tutorial' })
  if (await skipTutorialButton.isVisible()) {
    await skipTutorialButton.click()
  }
  await page.getByTestId('draw-footprint-button').click()
  const mapCanvas = page.getByTestId('map-canvas')
  await expect(mapCanvas).toBeVisible()

  const bounds = await mapCanvas.boundingBox()
  if (!bounds) {
    throw new Error('Map canvas bounds are not available')
  }

  const points: Array<[number, number]> = [
    [0.3, 0.2],
    [0.62, 0.26],
    [0.46, 0.62],
  ]
  const clickPoints = async () => {
    for (const [xRatio, yRatio] of points) {
      await mapCanvas.click({
        position: { x: bounds.width * xRatio, y: bounds.height * yRatio },
        force: true,
      })
      await page.waitForTimeout(50)
    }
  }

  for (let attempt = 0; attempt < 4; attempt += 1) {
    await clickPoints()
    if (await page.getByTestId('draw-finish-button').isEnabled()) {
      break
    }
  }

  await expect(page.getByTestId('draw-finish-button')).toBeEnabled()
  await page.getByTestId('draw-finish-button').click()
  await expect(page.getByTestId('vertex-height-input-0')).toBeVisible()
}

test('sets 3 vertex heights and rotates orbit map', async ({ page }, testInfo) => {
  const mapPitchValues: number[] = []
  const rotateValues: number[] = []

  page.on('console', async (msg) => {
    for (const arg of msg.args()) {
      try {
        const value = await arg.jsonValue()
        if (
          value &&
          typeof value === 'object' &&
          'mapPitchDeg' in value &&
          typeof (value as { mapPitchDeg: unknown }).mapPitchDeg === 'number'
        ) {
          mapPitchValues.push((value as { mapPitchDeg: number }).mapPitchDeg)
        }
        if (value && typeof value === 'object' && 'rotateDeg' in value && typeof (value as { rotateDeg: unknown }).rotateDeg === 'number') {
          rotateValues.push((value as { rotateDeg: number }).rotateDeg)
        }
      } catch {
        // Ignore values that cannot be serialized from browser context.
      }
    }
  })

  await page.goto('/')
  await drawTriangleFootprint(page)

  const heights = [2, 4, 30]
  for (let i = 0; i < heights.length; i += 1) {
    const input = page.getByTestId(`vertex-height-input-${i}`)
    const setButton = page.getByTestId(`vertex-height-set-${i}`)
    const clearButton = page.getByTestId(`vertex-height-clear-${i}`)
    for (let attempt = 0; attempt < 3; attempt += 1) {
      await input.fill(String(heights[i]))
      await setButton.click()
      if (await clearButton.isEnabled()) {
        break
      }
    }
    await expect(clearButton).toBeEnabled()
  }
  await expect(page.getByText(/Active constraints:/)).toContainText('V0=2.00m')
  await expect(page.getByText(/Active constraints:/)).toContainText('V1=4.00m')
  await expect(page.getByText(/Active constraints:/)).toContainText('V2=30.00m')

  await expect(page.getByText('CONSTRAINTS_INSUFFICIENT')).toHaveCount(0)

  const orbitButton = page.getByTestId('orbit-toggle-button')
  if ((await orbitButton.innerText()) === 'Orbit') {
    await orbitButton.click()
  }
  await expect(orbitButton).toHaveText(/Exit orbit/i)
  await expect(page.getByTestId('map-rotate-left-button')).toBeVisible()
  await expect(page.getByTestId('map-rotate-right-button')).toBeVisible()

  await page.getByTestId('map-rotate-right-button').click()
  await page.getByTestId('map-rotate-right-button').click()
  await page.getByTestId('map-pitch-up-button').click()

  await expect
    .poll(() => mapPitchValues.some((value) => Math.abs(value) > 0.5), { timeout: 10_000 })
    .toBeTruthy()
  await expect
    .poll(() => {
      const rotateSpan = rotateValues.length > 0 ? Math.max(...rotateValues) - Math.min(...rotateValues) : 0
      return Math.abs(rotateSpan)
    }, { timeout: 10_000 })
    .toBeGreaterThan(3)

  const meshToggle = page.getByTestId('mesh-visibility-toggle-button')
  await expect(meshToggle).toHaveText(/Hide meshes|Show meshes/i)
  const meshesOnScreenshot = await page.getByTestId('map-canvas').screenshot({ animations: 'disabled' })
  await testInfo.attach('debug-on-map', {
    body: meshesOnScreenshot,
    contentType: 'image/png',
  })

  const meshLabelBefore = (await meshToggle.innerText()).trim()
  await meshToggle.click()
  const meshLabelAfter = (await meshToggle.innerText()).trim()
  expect(meshLabelAfter).not.toBe(meshLabelBefore)
  await page.waitForTimeout(250)

  const meshesOffScreenshot = await page.getByTestId('map-canvas').screenshot({ animations: 'disabled' })
  await testInfo.attach('debug-off-map', {
    body: meshesOffScreenshot,
    contentType: 'image/png',
  })
})

test('draw finish should not depend on map network becoming idle', async ({ page }) => {
  await page.route('**/__roof-debug-keepalive__', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1_500))
    await route.fulfill({ status: 204, body: '' })
  })
  await page.addInitScript(() => {
    window.setInterval(() => {
      void fetch('/__roof-debug-keepalive__', { cache: 'no-store' }).catch(() => undefined)
    }, 100)
  })

  await page.goto('/')
  await drawTriangleFootprint(page)
  await expect(page.getByTestId('vertex-height-input-0')).toBeVisible()
})
