import { snapshot } from '@barelyhuman/node-snapshot'
import { after, before, describe, it } from 'node:test'
import assert from 'node:assert'

import { devServerURL, launchDemoDevServer } from './utils.js'

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
    snapshot(ctx, response)
  })

  await it('gives a static SSR response', async ctx => {
    const response2 = await fetch(new URL('/about', devServerURL)).then(d =>
      d.text()
    )
    snapshot(ctx, response2)
  })

  await it('has styles', async ctx => {
    const response = await fetch(
      new URL('/virtual:adex:global.css', devServerURL)
    ).then(d => d.text())
    assert.ok(response.includes('.text-red-500'))
  })
})
