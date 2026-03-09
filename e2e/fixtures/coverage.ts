import { mkdir, writeFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { expect, test as base } from '@playwright/test'
import type { Page } from '@playwright/test'

async function savePageCoverage(page: Page, pageIndex: number, testId: string) {
  const coverage = await page.evaluate(() => {
    type MaybeCoverageWindow = Window & { __coverage__?: unknown }
    return (window as MaybeCoverageWindow).__coverage__
  })

  if (!coverage) {
    return
  }

  await mkdir('.nyc_output', { recursive: true })
  await writeFile(`.nyc_output/${testId}-${pageIndex}-${randomUUID()}.json`, JSON.stringify(coverage), 'utf8')
}

export const test = base.extend({
  page: async ({ page }, fixtureDone, testInfo) => {
    await fixtureDone(page)

    if (process.env.PW_COVERAGE !== '1') {
      return
    }

    const pages = page.context().pages()
    await Promise.all(
      pages.map(async (openPage, index) => {
        try {
          await savePageCoverage(openPage, index, testInfo.testId)
        } catch {
          // Ignore pages that are already closed or inaccessible at teardown.
        }
      }),
    )
  },
})

export { expect }
