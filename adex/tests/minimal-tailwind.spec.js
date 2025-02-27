import Snap from '@matteo.collina/snap'
import { after, before, describe, it } from 'node:test'
import assert, { deepEqual } from 'node:assert'

import { devServerURL, launchDemoDevServer } from './utils.js'
const snap = Snap(import.meta.url)

describe('devMode ssr minimal with styles', async () => {
  let devServerProc
  before(async () => {
    devServerProc = await launchDemoDevServer('tests/fixtures/minimal-tailwind')
  })
  after(async () => {
    devServerProc.kill()
  })

  await it('gives a non-static ssr response', async ctx => {
    const response = await fetch(devServerURL).then(d => d.text())
    const snapshot = await snap(response)
    deepEqual(response, snapshot)
  })

  await it('gives a static SSR response', async ctx => {
    const response2 = await fetch(new URL('/about', devServerURL)).then(d =>
      d.text()
    )
    const snapshot = await snap(response2)
    deepEqual(response2, snapshot)
  })

  await it('has styles', async ctx => {
    const response = await fetch(
      new URL('/virtual:adex:global.css', devServerURL)
    ).then(d => d.text())
    assert.ok(response.includes('.text-red-500'))
  })
})
